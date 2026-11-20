/**
 * Unit tests for the DOM-free engine.
 * Run with:  node --test tests/
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

/* ------------------------- normalization ------------------------- */

test('curly quotes and em dashes fold to ASCII', () => {
  assert.equal(E.normalizeInput('“Hello,” she said — ‘fine’'), '"Hello," she said - \'fine\'');
});

test('ellipsis, nbsp and zero-width characters are handled', () => {
  assert.equal(E.normalizeInput('wait\u2026 ok'), 'wait... ok');
  assert.equal(E.normalizeInput('a\u00A0b\u200Bc'), 'a bc');
});

test('target normalization strips invisible traps from pasted text', () => {
  const pasted = '   Indented start  \n\n\n\n\ntrailing spaces   \nlast line';
  assert.equal(E.normalizeTarget(pasted), 'Indented start\n\ntrailing spaces\nlast line');
});

test('normalizeTarget keeps interior spacing but drops trailing spaces', () => {
  assert.equal(E.normalizeTarget('keep  inner   space \nnext line  '), 'keep  inner   space\nnext line');
});

test('iOS double-space period shortcut is repaired only when the target wants two spaces', () => {
  // iPadOS turns "space space" into ". "
  assert.equal(E.repairIOSDoubleSpace('hello. world', 'hello  world'), 'hello  world');
  assert.equal(E.repairIOSDoubleSpace('Done.. Next.', 'Done.  Next.'), 'Done.  Next.');
  // A real sentence period must survive untouched.
  assert.equal(E.repairIOSDoubleSpace('Done. Next', 'Done. Next'), 'Done. Next');
  assert.equal(E.repairIOSDoubleSpace('end. of it', 'the end. of'), 'end. of it');
});

test('iOS auto-capitalisation after its injected period is undone', () => {
  assert.equal(E.repairIOSAutoCaps('hello. World', 'hello  world'), 'hello. world');
  // Real capital at the start of a sentence is never touched.
  assert.equal(E.repairIOSAutoCaps('Hello world', 'Hello world'), 'Hello world');
});

test('normalizeTyped is the full iPad pipeline and stays length-preserving', () => {
  const target = E.normalizeTarget('Stop.  Then keep going \u2014 see?');
  assert.equal(target, 'Stop.  Then keep going - see?');

  // iPadOS typed the double space as ". " and the em dash as a real em dash.
  const ipadTyped = 'Stop.. Then keep going \u2014 see?';
  const typed = E.normalizeTyped(ipadTyped, target);
  assert.equal(typed, target);
  assert.equal(typed.length, ipadTyped.length, 'repairs must never shift the caret');
});

/* ---------------------------- stats ------------------------------ */

test('WPM uses (chars / 5) / (minutes)', () => {
  const s = E.computeStats({ typed: 'a'.repeat(250), target: 'a'.repeat(250), elapsed: 30 });
  assert.equal(Math.round(s.wpm), 100); // 250/5 = 50 words in 0.5 min
});

test('accuracy is correct chars / typed chars', () => {
  const s = E.computeStats({ typed: 'hello world', target: 'hello worlt', elapsed: 10 });
  assert.equal(Math.round(s.accuracy * 10) / 10, 90.9);
  assert.equal(s.correctChars, 10);
  assert.equal(s.incorrectChars, 1);
  assert.equal(s.progress, 1);
});

test('no divide-by-zero fireworks before the first half second', () => {
  const s = E.computeStats({ typed: 'abc', target: 'abcdef', elapsed: 0.1 });
  assert.equal(s.wpm, 0);
  assert.equal(s.accuracy, 100);
  assert.equal(s.progress, 0.5);
});

test('keystroke errors count mistakes that were later fixed', () => {
  const s = E.computeStats({ typed: 'cat', target: 'cat', elapsed: 5, totalKeystrokes: 6, correctKeystrokes: 3 });
  assert.equal(s.keystrokeErrors, 3);
  assert.equal(s.keystrokeAccuracy, 50);
  assert.equal(s.accuracy, 100);
});

test('formatClock switches to m:ss past a minute', () => {
  assert.equal(E.formatClock(12.34), '12.3');
  assert.equal(E.formatClock(59.96), '60.0');
  assert.equal(E.formatClock(75), '1:15');
});

/* ---------------------- text selection --------------------------- */

test('library has 12+ paragraphs and is quote-normalized already', () => {
  assert.ok(E.PARAGRAPHS.length >= 12, `expected 12+ paragraphs, got ${E.PARAGRAPHS.length}`);
  for (const p of E.PARAGRAPHS) {
    assert.equal(E.normalizeTarget(p), p, 'paragraph should already be in normalized form');
    assert.ok(p.length >= 120, 'paragraphs should be long enough to be useful');
  }
});

test('pickParagraphIndex never repeats the excluded index', () => {
  let seed = 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 500; i++) {
    const idx = E.pickParagraphIndex(E.PARAGRAPHS.length, 3, rnd);
    assert.notEqual(idx, 3);
    assert.ok(idx >= 0 && idx < E.PARAGRAPHS.length);
  }
});

test('buildStream is long enough for a 60s sprint and honours custom text', () => {
  const stream = E.buildStream({ paragraphs: E.PARAGRAPHS, minLength: 1800, random: () => 0.42 });
  assert.ok(stream.length >= 1800, `stream too short: ${stream.length}`);

  const withCustom = E.buildStream({ paragraphs: E.PARAGRAPHS, customText: 'MY OWN TEXT.', minLength: 400 });
  assert.ok(withCustom.startsWith('MY OWN TEXT. '));
});

test('buildStream cannot hang on an empty library', () => {
  assert.equal(E.buildStream({ paragraphs: [], customText: 'solo' }), 'solo');
});

/* -------------------------- high scores -------------------------- */

const score = (wpm, mode, date, accuracy = 97) => ({ wpm, accuracy, mode, date, chars: 200 });

test('recordScore keeps the top 5 and stays sorted', () => {
  let list = [];
  [40, 88, 61, 73, 55, 92, 47].forEach((w, i) => {
    list = E.recordScore(list, score(w, 'text', 1000 + i));
  });
  assert.equal(list.length, 5);
  assert.deepEqual(list.map((s) => s.wpm), [92, 88, 73, 61, 55]);
});

test('recordScore keeps a per-mode leaderboard alive', () => {
  let list = [];
  for (let i = 0; i < 8; i++) list = E.recordScore(list, score(90 + i, '60', 1000 + i));
  list = E.recordScore(list, score(30, '15', 2000));
  assert.ok(list.some((s) => s.mode === '15'), 'slow mode must not be evicted');
  assert.equal(E.topScores(list, '15').length, 1);
  assert.equal(E.topScores(list, '60').length, 5);
});

test('topScores filters and orders by wpm then accuracy', () => {
  const list = [score(70, 'text', 1, 90), score(70, 'text', 2, 99), score(80, '30', 3), score(60, 'text', 4)];
  assert.deepEqual(E.topScores(list, 'text', 5).map((s) => s.wpm), [70, 70, 60]);
  assert.equal(E.topScores(list, 'text', 5)[0].accuracy, 99);
  assert.deepEqual(E.topScores(list, 'all', 2).map((s) => s.wpm), [80, 70]);
});

test('bestWpm ignores other modes', () => {
  const list = [score(80, '30', 1), score(60, 'text', 2)];
  assert.equal(E.bestWpm(list, 'text'), 60);
  assert.equal(E.bestWpm(list, '15'), 0);
});

test('formatDate is locale-safe', () => {
  const out = E.formatDate(Date.UTC(2026, 10, 20, 12), Date.UTC(2026, 10, 20, 12));
  assert.match(out, /20/);
});
