/**
 * UI smoke tests — boots index.html + engine.js + app.js in jsdom and drives
 * the app the way a user (and an iPad keyboard) would.
 *
 * jsdom is a dev-only convenience; the app itself has zero dependencies.
 * These tests skip themselves when jsdom is not installed.
 *
 * Run with:  node --test tests/
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = require('jsdom'));
} catch (err) {
  test('jsdom UI smoke tests', { skip: 'jsdom not installed — run `npm install` first' }, () => {});
  return;
}

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function boot(seedStorage) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (/Not implemented/i.test(e.message)) return; // canvas.getContext etc.
    throw e;
  });
  virtualConsole.on('error', () => {});

  const dom = new JSDOM(read('index.html'), {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    virtualConsole
  });
  const win = dom.window;

  if (seedStorage) {
    Object.keys(seedStorage).forEach((k) => win.localStorage.setItem(k, JSON.stringify(seedStorage[k])));
  }

  win.eval(read('engine.js'));
  win.eval(read('app.js'));
  return { dom, win, doc: win.document, $: (id) => win.document.getElementById(id) };
}

/** The target text, rebuilt from the rendered character spans. */
function targetOf(doc) {
  return Array.from(doc.querySelectorAll('#display .ch'))
    .map((s) => (s.classList.contains('nl') ? '\n' : s.textContent))
    .join('');
}

function classesAt(doc, index) {
  const spans = doc.querySelectorAll('#display .ch');
  return spans[index] ? spans[index].className : '';
}

function type(win, value) {
  const input = win.document.getElementById('input');
  input.value = value;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
}

function click(win, el) {
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** Load custom text through the real modal flow. */
function setCustomText(ctx, text) {
  click(ctx.win, ctx.$('btnCustom'));
  ctx.$('customInput').value = text;
  ctx.$('customInput').dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
  click(ctx.win, ctx.$('btnCustomStart'));
}

/* ---------------------------- initial render ---------------------------- */

test('boots with a library paragraph rendered character by character', () => {
  const ctx = boot();
  try {
    const target = targetOf(ctx.doc);
    assert.ok(target.length > 120, 'expected a real paragraph, got ' + target.length);
    assert.equal(ctx.doc.querySelectorAll('#display .ch').length >= target.length, true);
    assert.equal(ctx.$('wpmValue').textContent, '0');
    assert.equal(ctx.$('accValue').textContent, '100');
    assert.equal(ctx.$('timeSub').textContent, 'starts on first key');
    assert.match(ctx.$('progressLabel').textContent, /^0 \/ \d+ characters$/);
    assert.equal(parseFloat(ctx.$('progressFill').style.width) || 0, 0);
    assert.equal(ctx.$('input').readOnly, false);
    assert.equal(ctx.$('scoreList').querySelectorAll('.scores__empty').length, 1);
  } finally {
    ctx.win.close();
  }
});

test('correct characters turn green and the caret tracks progress', () => {
  const ctx = boot();
  try {
    const target = targetOf(ctx.doc);
    type(ctx.win, target.slice(0, 6));
    for (let i = 0; i < 6; i++) assert.match(classesAt(ctx.doc, i), /\bok\b/, `char ${i} should be ok`);
    assert.match(classesAt(ctx.doc, 6), /\bcaret\b/, 'caret should sit on the next char');
    assert.doesNotMatch(classesAt(ctx.doc, 7), /\bcaret\b/);
    assert.equal(ctx.$('accValue').textContent, '100.0');
    assert.match(ctx.$('progressLabel').textContent, /^6 \/ \d+ characters$/);
    assert.notEqual(ctx.$('progressFill').style.width, '0.00%');
  } finally {
    ctx.win.close();
  }
});

test('wrong characters are flagged bad, underlined and counted', () => {
  const ctx = boot();
  try {
    const target = targetOf(ctx.doc);
    type(ctx.win, target.slice(0, 3) + 'ZZ' + target.slice(5, 9));
    assert.match(classesAt(ctx.doc, 3), /\bbad\b/);
    assert.match(classesAt(ctx.doc, 4), /\bbad\b/);
    assert.match(classesAt(ctx.doc, 5), /\bok\b/);
    assert.equal(ctx.$('accValue').textContent, ((target.slice(0, 3).length + 4) / 9 * 100).toFixed(1));
    assert.match(ctx.$('accSub').textContent, /mistake/);
  } finally {
    ctx.win.close();
  }
});

test('backspacing clears the highlight again', () => {
  const ctx = boot();
  try {
    const target = targetOf(ctx.doc);
    type(ctx.win, target.slice(0, 8));
    type(ctx.win, target.slice(0, 3));
    assert.match(classesAt(ctx.doc, 2), /\bok\b/);
    assert.doesNotMatch(classesAt(ctx.doc, 3), /\bok\b|\bbad\b/);
    assert.match(classesAt(ctx.doc, 3), /\bcaret\b/);
  } finally {
    ctx.win.close();
  }
});

/* ------------------------- iPad / iOS behaviour ------------------------- */

test('curly quotes typed on iPadOS are accepted as straight quotes', () => {
  const ctx = boot();
  try {
    setCustomText(ctx, 'He said "hello" and she said \'fine\' before leaving.');
    const target = targetOf(ctx.doc);
    assert.ok(target.includes('"hello"'), 'target should keep straight quotes');

    type(ctx.win, 'He said \u201Chello\u201D and she said \u2018fine\u2019 before leaving.');
    assert.equal(ctx.$('input').value, target, 'input should be folded to ASCII');
    assert.match(classesAt(ctx.doc, target.length - 1), /\bok\b/);
    assert.equal(ctx.$('accValue').textContent, '100.0');
  } finally {
    ctx.win.close();
  }
});

test('em dashes and ellipses are folded too', () => {
  const ctx = boot();
  try {
    setCustomText(ctx, 'Wait - then go... quickly, before the light changes again.');
    const target = targetOf(ctx.doc);
    type(ctx.win, 'Wait \u2014 then go\u2026 quickly, before the light changes again.');
    assert.equal(ctx.$('input').value, target);
    assert.equal(ctx.$('accValue').textContent, '100.0');
  } finally {
    ctx.win.close();
  }
});

test('the iOS double-space period shortcut is undone', () => {
  const ctx = boot();
  try {
    setCustomText(ctx, 'Stop.  Then keep going for a while longer.');
    const target = targetOf(ctx.doc);
    assert.ok(target.includes('Stop.  Then'), 'double space must survive normalization');

    // iPadOS rewrote the two spaces into ". "
    type(ctx.win, 'Stop.. Then keep going for a while longer.');
    assert.equal(ctx.$('input').value, target);
    assert.equal(ctx.$('accValue').textContent, '100.0');
    assert.match(classesAt(ctx.doc, 6), /\bok\b/);
  } finally {
    ctx.win.close();
  }
});

test('custom text cannot smuggle in invisible trailing spaces', () => {
  const ctx = boot();
  try {
    setCustomText(ctx, '  Indented and padded   \n\n\n\nSecond paragraph here.  ');
    const target = targetOf(ctx.doc);
    assert.equal(target, 'Indented and padded\n\nSecond paragraph here.');
    // the newline is a real character the user can type
    assert.match(classesAt(ctx.doc, target.indexOf('\n')), /\bch\b|\bnl\b/);
  } finally {
    ctx.win.close();
  }
});

test('typing cannot overrun the end of the text', () => {
  const ctx = boot();
  try {
    const target = targetOf(ctx.doc);
    type(ctx.win, target + 'EXTRA JUNK');
    assert.equal(ctx.$('input').value, target);
  } finally {
    ctx.win.close();
  }
});

/* --------------------------- finishing a run ---------------------------- */

test('completing the text opens the results summary and saves a score', async () => {
  const ctx = boot();
  try {
    const target = targetOf(ctx.doc);
    let clock = 5000;
    ctx.win.performance.now = () => clock;

    type(ctx.win, target.slice(0, 4)); // starts the clock at t=5000
    clock = 35000; // 30 seconds later
    type(ctx.win, target); // finishes

    const expectedWpm = Math.round((target.length / 5) / 0.5);
    assert.equal(ctx.$('resultsModal').hidden, false, 'results modal should be open');
    assert.equal(ctx.$('resWpm').textContent, String(expectedWpm));
    assert.equal(ctx.$('resAcc').textContent, '100.0%');
    assert.equal(ctx.$('resChars').textContent, target.length + ' / ' + target.length);
    assert.equal(ctx.$('resTime').textContent, '30.0s');
    assert.equal(ctx.$('resRibbon').hidden, false, 'first run is always a personal best');
    assert.equal(ctx.$('input').readOnly, true);

    const saved = JSON.parse(ctx.win.localStorage.getItem('velocity.scores.v1'));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].mode, 'text');
    assert.equal(Math.round(saved[0].wpm), expectedWpm);
    assert.equal(ctx.$('scoreList').querySelectorAll('.score').length, 1);
    assert.match(ctx.$('scoreList').textContent, /WPM/);
  } finally {
    ctx.win.close();
  }
});

test('a too-short run is not saved as a high score', () => {
  const ctx = boot();
  try {
    const text = 'A very tiny little run here.';
    let clock = 1000;
    ctx.win.performance.now = () => clock;
    setCustomText(ctx, text);
    assert.equal(targetOf(ctx.doc), text);

    type(ctx.win, 'A');
    clock = 1400; // only 0.4s of typing — below the 2s floor
    type(ctx.win, text);

    assert.equal(ctx.$('resultsModal').hidden, false);
    assert.match(ctx.$('resNote').textContent, /Too short to save/);
    assert.equal(ctx.win.localStorage.getItem('velocity.scores.v1'), null);
    assert.equal(ctx.$('scoreList').querySelectorAll('.score').length, 0);
  } finally {
    ctx.win.close();
  }
});

test('dismissing the results summary revives the page instead of leaving it read-only', () => {
  const ctx = boot();
  try {
    const target = targetOf(ctx.doc);
    let clock = 1000;
    ctx.win.performance.now = () => clock;
    type(ctx.win, target.slice(0, 5));
    clock = 21000;
    type(ctx.win, target);

    assert.equal(ctx.$('resultsModal').hidden, false);
    assert.equal(ctx.$('input').readOnly, true);

    click(ctx.win, ctx.$('btnTryAgain'));
    assert.equal(ctx.$('resultsModal').hidden, true);
    assert.equal(ctx.$('input').readOnly, false, 'input must be usable again');
    assert.equal(ctx.$('input').value, '');
    assert.equal(targetOf(ctx.doc), target, 'Try again keeps the same text');
    assert.equal(ctx.doc.activeElement, ctx.$('input'));
    assert.equal(ctx.$('display').classList.contains('is-done'), false);
  } finally {
    ctx.win.close();
  }
});

test('Try again resets the same text and re-enables the input', () => {
  const ctx = boot();
  try {
    const target = targetOf(ctx.doc);
    type(ctx.win, target.slice(0, 10));
    click(ctx.win, ctx.$('btnRestart'));
    assert.equal(ctx.$('input').value, '');
    assert.equal(ctx.$('input').readOnly, false);
    assert.equal(targetOf(ctx.doc), target, 'restart keeps the same paragraph');
    assert.doesNotMatch(classesAt(ctx.doc, 0), /\bok\b/);
    assert.equal(ctx.$('wpmValue').textContent, '0');

    click(ctx.win, ctx.$('btnNew'));
    assert.notEqual(targetOf(ctx.doc), target, 'new paragraph should differ');
  } finally {
    ctx.win.close();
  }
});

/* ------------------------------- modes --------------------------------- */

test('countdown modes load a long runway and count down', () => {
  const ctx = boot();
  try {
    click(ctx.win, ctx.doc.querySelector('[data-mode="60"]'));
    const target = targetOf(ctx.doc);
    assert.ok(target.length >= 1800, 'stream should be long, got ' + target.length);
    assert.equal(ctx.doc.querySelector('[data-mode="60"]').getAttribute('aria-selected'), 'true');
    assert.equal(ctx.doc.querySelector('[data-mode="text"]').getAttribute('aria-selected'), 'false');

    let clock = 0;
    ctx.win.performance.now = () => clock;
    type(ctx.win, 'hello world');
    assert.equal(ctx.$('timeValue').textContent, '60');
    clock = 20000;
    type(ctx.win, 'hello world!');
    assert.equal(ctx.$('timeValue').textContent, '40');
    assert.equal(ctx.$('timeSub').textContent, 'seconds left');
    assert.match(ctx.$('progressLabel').textContent, /20s of 60s/);
    assert.equal(ctx.$('resultsModal').hidden, true);
  } finally {
    ctx.win.close();
  }
});

test('the countdown ends the run when time runs out', async () => {
  const ctx = boot();
  try {
    click(ctx.win, ctx.doc.querySelector('[data-mode="15"]'));
    let clock = 0;
    ctx.win.performance.now = () => clock;
    type(ctx.win, 'typing fast now');
    assert.equal(ctx.$('resultsModal').hidden, true);
    clock = 16000;
    await sleep(60); // let a frame or two run the timer
    assert.equal(ctx.$('resultsModal').hidden, false, 'should finish when the clock expires');
    assert.equal(ctx.$('resTime').textContent, '15s');
  } finally {
    ctx.win.close();
  }
});

test('custom text is pinned and can be released', () => {
  const ctx = boot();
  try {
    setCustomText(ctx, 'A custom paragraph that is definitely long enough to use.');
    assert.equal(ctx.$('customBadge').hidden, false);
    const before = targetOf(ctx.doc);

    click(ctx.win, ctx.$('btnNew')); // should not throw the custom text away
    assert.equal(targetOf(ctx.doc), before);

    click(ctx.win, ctx.$('btnClearCustom'));
    assert.equal(ctx.$('customBadge').hidden, true);
    assert.notEqual(targetOf(ctx.doc), before, 'library paragraph restored');
  } finally {
    ctx.win.close();
  }
});

test('custom texts are remembered between sessions', () => {
  const ctx = boot();
  try {
    setCustomText(ctx, 'Remember me for later practice sessions, please.');
    const saved = JSON.parse(ctx.win.localStorage.getItem('velocity.custom.v1'));
    assert.equal(saved.length, 1);
    assert.match(saved[0].text, /^Remember me/);

    // Second boot with the saved library present
    const ctx2 = boot({ 'velocity.custom.v1': saved });
    try {
      click(ctx2.win, ctx2.$('btnCustom'));
      assert.equal(ctx2.$('customSavedWrap').hidden, false);
      assert.equal(ctx2.$('customList').querySelectorAll('.custom__savedItem').length, 1);
      assert.match(ctx2.$('customList').textContent, /Remember me/);
    } finally {
      ctx2.win.close();
    }
  } finally {
    ctx.win.close();
  }
});

test('the custom modal rejects stubs and closes on Escape', () => {
  const ctx = boot();
  try {
    click(ctx.win, ctx.$('btnCustom'));
    assert.equal(ctx.$('customModal').hidden, false);
    ctx.$('customInput').value = 'short';
    ctx.$('customInput').dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
    click(ctx.win, ctx.$('btnCustomStart'));
    assert.equal(ctx.$('customModal').hidden, false, 'still open — too short');
    assert.equal(ctx.$('toast').hidden, false);

    ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(ctx.$('customModal').hidden, true);
  } finally {
    ctx.win.close();
  }
});

/* ---------------------------- persistence ------------------------------ */

test('saved high scores are rendered on load and can be filtered and cleared', () => {
  const seeded = [
    { wpm: 91.4, accuracy: 98.2, mode: '60', date: Date.now(), chars: 480, source: 'library' },
    { wpm: 84, accuracy: 96, mode: 'text', date: Date.now() - 86400000, chars: 320, source: 'library' },
    { wpm: 77.5, accuracy: 99, mode: '60', date: Date.now() - 172800000, chars: 470, source: 'custom' }
  ];
  const ctx = boot({ 'velocity.scores.v1': seeded, 'velocity.prefs.v1': { mode: 'text', scoreFilter: 'all' } });
  try {
    const rows = ctx.$('scoreList').querySelectorAll('.score');
    assert.equal(rows.length, 3);
    assert.match(rows[0].textContent, /91\.4/);
    assert.match(rows[0].className, /score--first/);
    assert.match(ctx.$('scoreList').textContent, /custom text/);

    click(ctx.win, ctx.doc.querySelector('[data-filter="text"]'));
    assert.equal(ctx.$('scoreList').querySelectorAll('.score').length, 1);
    assert.match(ctx.$('scoreList').textContent, /84/);

    click(ctx.win, ctx.doc.querySelector('[data-filter="15"]'));
    assert.match(ctx.$('scoreList').textContent, /No scores for this mode yet/);

    click(ctx.win, ctx.doc.querySelector('[data-filter="all"]'));
    click(ctx.win, ctx.$('btnClearScores'));
    assert.equal(ctx.$('scoreList').querySelectorAll('.score').length, 0);
    assert.equal(ctx.win.localStorage.getItem('velocity.scores.v1'), null);
  } finally {
    ctx.win.close();
  }
});

test('mode and filter preferences survive a reload', () => {
  const ctx = boot();
  try {
    click(ctx.win, ctx.doc.querySelector('[data-mode="30"]'));
    click(ctx.win, ctx.doc.querySelector('[data-filter="30"]'));
    const prefs = JSON.parse(ctx.win.localStorage.getItem('velocity.prefs.v1'));
    assert.equal(prefs.mode, '30');
    assert.equal(prefs.scoreFilter, '30');

    const ctx2 = boot({ 'velocity.prefs.v1': prefs });
    try {
      assert.equal(ctx2.doc.querySelector('[data-mode="30"]').getAttribute('aria-selected'), 'true');
      assert.equal(ctx2.doc.querySelector('[data-filter="30"]').className.includes('is-active'), true);
      assert.equal(ctx2.$('timeSub').textContent, 'seconds left');
    } finally {
      ctx2.win.close();
    }
  } finally {
    ctx.win.close();
  }
});

/* ------------------------------ shortcuts ------------------------------ */

test('Alt+R restarts and Alt+C opens the custom text modal', () => {
  const ctx = boot();
  try {
    type(ctx.win, 'some typed text');
    ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true, cancelable: true }));
    assert.equal(ctx.$('input').value, '');

    ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'c', altKey: true, bubbles: true, cancelable: true }));
    assert.equal(ctx.$('customModal').hidden, false);
  } finally {
    ctx.win.close();
  }
});

test('Alt+3 switches to the 30 second mode', () => {
  const ctx = boot();
  try {
    ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: '3', altKey: true, bubbles: true, cancelable: true }));
    assert.equal(ctx.doc.querySelector('[data-mode="30"]').getAttribute('aria-selected'), 'true');
    assert.equal(ctx.$('timeSub').textContent, 'seconds left');
  } finally {
    ctx.win.close();
  }
});

test('clicking the text panel focuses the hidden-but-visible input', () => {
  const ctx = boot();
  try {
    click(ctx.win, ctx.$('display'));
    assert.equal(ctx.doc.activeElement, ctx.$('input'));
  } finally {
    ctx.win.close();
  }
});

/* --------------------------- accessibility ----------------------------- */

test('the markup exposes the basics assistive tech needs', () => {
  const ctx = boot();
  try {
    const { doc } = ctx;
    assert.equal(doc.querySelector('#resultsModal').getAttribute('aria-modal'), 'true');
    assert.equal(doc.querySelector('#customModal').getAttribute('role'), 'dialog');
    assert.equal(doc.querySelector('#modeSwitch').getAttribute('role'), 'tablist');
    assert.equal(doc.querySelectorAll('label[for="input"]').length, 1);
    assert.equal(doc.querySelector('#input').getAttribute('spellcheck'), 'false');
    assert.equal(doc.querySelector('#input').getAttribute('autocorrect'), 'off');
    assert.equal(doc.querySelector('#input').getAttribute('autocapitalize'), 'off');
    assert.equal(doc.querySelector('#liveRegion').getAttribute('aria-live'), 'polite');
    assert.equal(doc.querySelector('html').getAttribute('lang'), 'en');
  } finally {
    ctx.win.close();
  }
});

test('the stylesheet ships the tokens the layout relies on', () => {
  const css = read('styles.css');
  assert.match(css, /--kb-inset/);
  assert.match(css, /html\.kb-open/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /@media \(max-height: 620px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.ch\.ok/);
  assert.match(css, /\.ch\.bad/);
  assert.ok(!/@import|https?:\/\/fonts\./.test(css), 'no external font or CSS requests');
});

test('the page has no third-party network dependencies', () => {
  const html = read('index.html');
  const externals = html.match(/(src|href)="(https?:)?\/\/[^"]+"/g) || [];
  assert.deepEqual(externals, [], 'only local assets allowed, found: ' + externals.join(', '));
});
