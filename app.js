/**
 * app.js — UI controller for Velocity.
 * All pure logic (normalization, stats, scoring) lives in engine.js.
 */
(function () {
  'use strict';

  var E = window.TypingEngine;
  if (!E) return;

  /* ------------------------------ Constants ----------------------------- */

  var MODES = [
    { id: 'text', label: 'Text', seconds: 0 },
    { id: '15', label: '15s', seconds: 15 },
    { id: '30', label: '30s', seconds: 30 },
    { id: '60', label: '60s', seconds: 60 }
  ];

  var KEYS = {
    scores: 'velocity.scores.v1',
    custom: 'velocity.custom.v1',
    prefs: 'velocity.prefs.v1'
  };

  var STREAM_LENGTH = 1800; // chars of runway for countdown modes
  var MAX_CUSTOM = 8;
  var MIN_SAVED_CHARS = 8; // ignore runs that are too short to be meaningful
  var MIN_SAVED_SECONDS = 2;

  /* ------------------------------- Elements ----------------------------- */

  var els = {};
  [
    'modeSwitch', 'wpmValue', 'wpmSub', 'accValue', 'accSub', 'timeValue', 'timeSub',
    'progressFill', 'progressLabel', 'stage', 'display', 'focusPill', 'pausedOverlay',
    'btnResume', 'input', 'hintText', 'btnRestart', 'btnNew', 'btnCustom', 'customBadge',
    'btnClearCustom', 'scoreFilters', 'scoreList', 'btnClearScores', 'resultsModal',
    'resRibbon', 'resWpm', 'resAcc', 'resTime', 'resChars', 'resMode', 'resNet',
    'resErrors', 'resChart', 'resNote', 'btnTryAgain', 'btnResNew', 'customModal',
    'customInput', 'customCount', 'btnCustomClear', 'customSavedWrap',
    'customList', 'btnCustomStart', 'toast', 'liveRegion'
  ].forEach(function (id) {
    els[id] = document.getElementById(id);
  });
  var displayWrap = els.display.parentElement;
  var modeButtons = Array.prototype.slice.call(els.modeSwitch.querySelectorAll('.modes__btn'));
  var filterChips = Array.prototype.slice.call(els.scoreFilters.querySelectorAll('.chip'));

  /* -------------------------------- State ------------------------------- */

  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  var state = {
    mode: 'text',
    scoreFilter: 'all',
    target: '',
    typed: '',
    paragraphIndex: -1,
    customText: '',
    customLibrary: [],
    scores: [],
    startedAt: null,
    finishedAt: null,
    pausedAt: null,
    running: false,
    finished: false,
    totalKeystrokes: 0,
    correctKeystrokes: 0,
    samples: [],
    lastSampleAt: 0,
    live: null
  };

  var spans = []; // { el, start, end, nl }
  var spanIndexAt = []; // target index -> index into spans
  var rafId = 0;
  var typingTimer = 0;
  var toastTimer = 0;
  var lastFocused = null;
  var lastPaintedText = {};

  /* ------------------------------ Utilities ----------------------------- */

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  function currentMode() {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === state.mode) return MODES[i];
    return MODES[0];
  }

  function setText(el, value) {
    if (!el) return;
    var key = el.id || el.className;
    if (lastPaintedText[key] === value) return;
    lastPaintedText[key] = value;
    el.textContent = value;
  }

  var store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        return false; // private mode / quota — the app still works, just not persistent
      }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (err) { /* ignore */ }
    }
  };

  function announce(message) {
    if (els.liveRegion) els.liveRegion.textContent = message;
  }

  function toast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { els.toast.hidden = true; }, 2400);
  }

  function elapsedSeconds() {
    // `startedAt` is a timestamp, so compare against null — a 0 origin is legal.
    if (state.startedAt === null) return 0;
    var end = state.finishedAt || state.pausedAt || performance.now();
    return Math.max(0, (end - state.startedAt) / 1000);
  }

  function cappedElapsed() {
    var mode = currentMode();
    var elapsed = elapsedSeconds();
    return mode.seconds ? Math.min(elapsed, mode.seconds) : elapsed;
  }

  function liveStats() {
    return E.computeStats({
      typed: state.typed,
      target: state.target,
      elapsed: cappedElapsed(),
      totalKeystrokes: state.totalKeystrokes,
      correctKeystrokes: state.correctKeystrokes
    });
  }

  /* --------------------------- Display rendering ------------------------ */

  /** Build one span per character (surrogate pairs share a span). */
  function buildDisplay() {
    var target = state.target;
    var frag = document.createDocumentFragment();
    spans = [];
    spanIndexAt = new Array(target.length);

    var lineEl = document.createElement('div');
    lineEl.className = 'line';

    function pushSpan(text, start, end, isNl) {
      var el = document.createElement('span');
      el.className = 'ch' + (text === ' ' ? ' space' : '') + (isNl ? ' nl' : '');
      el.textContent = isNl ? '\u23CE' : text; // ⏎ return marker for newline chars
      var si = spans.length;
      spans.push({ el: el, start: start, end: end, nl: !!isNl, base: el.className });
      for (var i = start; i < end && i < target.length; i++) spanIndexAt[i] = si;
      lineEl.appendChild(el);
    }

    function closeLine() {
      if (!lineEl.childNodes.length) lineEl.appendChild(document.createTextNode('\u200B'));
      frag.appendChild(lineEl);
      lineEl = document.createElement('div');
      lineEl.className = 'line';
    }

    for (var i = 0; i < target.length; i++) {
      var code = target.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < target.length) {
        var next = target.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          pushSpan(target.substr(i, 2), i, i + 2, false);
          i++;
          continue;
        }
      }
      if (target[i] === '\n') {
        pushSpan('\n', i, i + 1, true);
        closeLine();
        continue;
      }
      pushSpan(target[i], i, i + 1, false);
    }

    closeLine();
    var endCaret = document.createElement('span');
    endCaret.className = 'end-caret';
    lineEl.appendChild(endCaret);

    els.display.textContent = '';
    els.display.appendChild(frag);
  }

  /** Repaint classes for the spans covering target indices [lo, hi]. */
  function paint(lo, hi) {
    var target = state.target;
    var typed = state.typed;
    var n = target.length;
    if (!n || !spans.length) return;

    var caret = typed.length;
    var a = spanIndexAt[clamp(lo, 0, n - 1)];
    var b = spanIndexAt[clamp(hi, 0, n - 1)];
    if (a === undefined || b === undefined) return;

    for (var s = a; s <= b; s++) {
      var sp = spans[s];
      var got = typed.slice(sp.start, sp.end);
      var want = target.slice(sp.start, sp.end);
      var cls = sp.base;
      if (got.length) cls += got === want ? ' ok' : ' bad';
      if (sp.start === caret) cls += ' caret';
      if (sp.el.className !== cls) sp.el.className = cls;
    }

    els.display.classList.toggle('is-done', caret >= n);
  }

  function paintRange(oldLen, newLen) {
    var lo = Math.max(0, Math.min(oldLen, newLen) - 1);
    var hi = Math.max(oldLen, newLen) + 1;
    paint(lo, hi);
  }

  function scrollCaretIntoView() {
    var target = state.target;
    if (!target.length) return;
    var idx = clamp(state.typed.length, 0, target.length - 1);
    var sp = spans[spanIndexAt[idx]];
    if (!sp) return;

    var box = els.display;
    var top = sp.el.offsetTop;
    var height = sp.el.offsetHeight || 26;
    var viewTop = box.scrollTop;
    var viewBottom = viewTop + box.clientHeight;

    if (top < viewTop + height * 1.1 || top + height > viewBottom - height * 0.5) {
      var to = Math.max(0, top - box.clientHeight * 0.38);
      if (reducedMotion || typeof box.scrollTo !== 'function') box.scrollTop = to;
      else box.scrollTo({ top: to, behavior: 'smooth' });
    }
    updateFades();
  }

  function updateFades() {
    var box = els.display;
    var scrollable = box.scrollHeight > box.clientHeight + 4;
    displayWrap.classList.toggle('is-scrollable', scrollable);
    displayWrap.classList.toggle('is-scrolled', box.scrollTop > 8);
    displayWrap.classList.toggle('is-at-end', box.scrollTop + box.clientHeight >= box.scrollHeight - 8);
  }

  /* ------------------------------ Test setup ---------------------------- */

  function buildTargetText() {
    if (state.mode === 'text') {
      if (state.customText) return state.customText;
      state.paragraphIndex = E.pickParagraphIndex(E.PARAGRAPHS.length, state.paragraphIndex);
      return E.PARAGRAPHS[state.paragraphIndex] || '';
    }
    // Countdown modes need a runway no one can outrun.
    return E.buildStream({
      paragraphs: E.PARAGRAPHS,
      minLength: STREAM_LENGTH,
      customText: state.customText
    });
  }

  function loadTest(options) {
    options = options || {};
    if (rafId) cancelAnimationFrame(rafId);

    if (options.newText !== false) state.target = E.normalizeTarget(buildTargetText());

    state.typed = '';
    state.startedAt = null;
    state.finishedAt = null;
    state.pausedAt = null;
    state.running = false;
    state.finished = false;
    state.totalKeystrokes = 0;
    state.correctKeystrokes = 0;
    state.samples = [];
    state.lastSampleAt = 0;
    state.live = null;
    lastPaintedText = {};

    els.input.value = '';
    els.input.readOnly = false;
    els.input.maxLength = Math.max(1, state.target.length);
    els.pausedOverlay.hidden = true;
    els.display.classList.remove('is-done', 'is-typing');
    els.display.scrollTop = 0;

    buildDisplay();
    paint(0, state.target.length);
    updateFades();
    renderLive();
    if (options.focus) els.input.focus();
  }

  function restart() {
    loadTest({ newText: false });
    toast('Same text — go again');
  }

  function nextParagraph() {
    if (state.mode === 'text' && state.customText) {
      toast('Custom text is pinned — clear it to draw from the library');
      loadTest({ newText: false });
      return;
    }
    loadTest({ newText: true });
    toast(state.mode === 'text' ? 'New paragraph loaded' : 'New text stream loaded');
  }

  function setMode(id, options) {
    options = options || {};
    var known = MODES.some(function (m) { return m.id === id; });
    if (!known) return;
    var changed = state.mode !== id;
    state.mode = id;
    modeButtons.forEach(function (btn) {
      var on = btn.dataset.mode === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    savePrefs();
    if (changed || options.force) loadTest({ newText: true, focus: options.focus });
  }

  /* ------------------------------ Input path ---------------------------- */

  function countKeystrokes(prev, next) {
    var target = state.target;
    if (next.length > prev.length) {
      for (var i = prev.length; i < next.length; i++) {
        state.totalKeystrokes++;
        if (next[i] === target[i]) state.correctKeystrokes++;
      }
    } else if (next.length === prev.length && next !== prev) {
      for (var j = 0; j < next.length; j++) {
        if (next[j] !== prev[j]) {
          state.totalKeystrokes++;
          if (next[j] === target[j]) state.correctKeystrokes++;
        }
      }
    }
  }

  function onInput() {
    if (state.finished) {
      els.input.value = state.typed;
      return;
    }

    var raw = els.input.value;
    var selStart = typeof els.input.selectionStart === 'number' ? els.input.selectionStart : raw.length;

    // 1. fold smart punctuation, 2. undo iOS's "space space -> . " trick,
    // 3. never let the buffer grow past the text.
    var next = E.normalizeTyped(raw, state.target);
    if (next.length > state.target.length) next = next.slice(0, state.target.length);

    if (next !== raw) {
      els.input.value = next;
      var caret = clamp(selStart + (next.length - raw.length), 0, next.length);
      try { els.input.setSelectionRange(caret, caret); } catch (err) { /* not focusable */ }
    }

    var prev = state.typed;
    if (next !== prev) {
      countKeystrokes(prev, next);
      state.typed = next;
      if (state.startedAt === null && next.length > 0) startTest();
      paintRange(prev.length, next.length);
      scrollCaretIntoView();
      markTyping();
    }

    renderLive();

    if (!currentMode().seconds && state.typed.length >= state.target.length && state.target.length > 0) {
      finish('complete');
    }
  }

  function markTyping() {
    els.display.classList.add('is-typing');
    window.clearTimeout(typingTimer);
    typingTimer = window.setTimeout(function () {
      els.display.classList.remove('is-typing');
    }, 900);
  }

  function startTest() {
    state.startedAt = performance.now();
    state.running = true;
    state.lastSampleAt = 0;
    rafId = requestAnimationFrame(loop);
  }

  function loop() {
    if (!state.running) return;
    var mode = currentMode();
    var elapsed = elapsedSeconds();

    if (mode.seconds && elapsed >= mode.seconds) {
      finish('time');
      return;
    }

    renderLive();

    if (elapsed - state.lastSampleAt >= 1) {
      state.lastSampleAt = elapsed;
      var stats = state.live || liveStats();
      state.samples.push({ t: elapsed, wpm: stats.wpm });
    }

    rafId = requestAnimationFrame(loop);
  }

  /* ------------------------------ Live stats ---------------------------- */

  function renderLive(statsArg) {
    var mode = currentMode();
    var stats = statsArg || liveStats();
    state.live = stats;

    setText(els.wpmValue, String(Math.round(stats.wpm)));
    setText(els.wpmSub, stats.typedChars ? 'net ' + Math.round(stats.netWpm) + ' wpm' : 'chars ÷ 5 ÷ min');

    setText(els.accValue, stats.typedChars ? stats.accuracy.toFixed(1) : '100');
    setText(els.accSub, stats.keystrokeErrors
      ? stats.keystrokeErrors + (stats.keystrokeErrors === 1 ? ' mistake made' : ' mistakes made')
      : 'no mistakes yet');

    if (mode.seconds) {
      var left = Math.max(0, mode.seconds - stats.elapsed);
      setText(els.timeValue, String(Math.ceil(left)));
      setText(els.timeSub, 'seconds left');
    } else {
      setText(els.timeValue, E.formatClock(stats.elapsed));
      setText(els.timeSub, state.startedAt !== null ? 'seconds elapsed' : 'starts on first key');
    }

    var pct = mode.seconds
      ? (mode.seconds ? (stats.elapsed / mode.seconds) * 100 : 0)
      : stats.progress * 100;
    els.progressFill.style.width = clamp(pct, 0, 100).toFixed(2) + '%';

    setText(els.progressLabel, mode.seconds
      ? Math.round(stats.elapsed) + 's of ' + mode.seconds + 's'
      : stats.typedChars + ' / ' + stats.targetChars + ' characters');
  }

  /* -------------------------------- Finish ------------------------------ */

  function finish(reason) {
    if (state.finished) return;
    state.finished = true;
    state.running = false;
    state.finishedAt = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    window.clearTimeout(typingTimer);
    els.display.classList.remove('is-typing');
    els.display.classList.add('is-done');

    var mode = currentMode();
    var elapsed = elapsedSeconds();
    if (mode.seconds) elapsed = Math.min(elapsed, mode.seconds);
    state.samples.push({ t: elapsed, wpm: state.live ? state.live.wpm : 0 });

    var stats = E.computeStats({
      typed: state.typed,
      target: state.target,
      elapsed: elapsed,
      totalKeystrokes: state.totalKeystrokes,
      correctKeystrokes: state.correctKeystrokes
    });
    state.live = stats;
    renderLive(stats);

    els.input.readOnly = true;
    els.input.blur();
    if (!coarsePointer) els.focusPill.hidden = true;

    var wpm = Math.round(stats.wpm * 10) / 10;
    var previousBest = E.bestWpm(state.scores, mode.id);
    var isPb = stats.typedChars >= MIN_SAVED_CHARS && elapsed >= MIN_SAVED_SECONDS && wpm > previousBest;
    var saved = false;

    if (stats.typedChars >= MIN_SAVED_CHARS && elapsed >= MIN_SAVED_SECONDS) {
      state.scores = E.recordScore(state.scores, {
        wpm: wpm,
        accuracy: stats.accuracy,
        mode: mode.id,
        date: Date.now(),
        chars: stats.typedChars,
        source: state.customText ? 'custom' : 'library'
      }, 5);
      saved = store.set(KEYS.scores, state.scores);
      renderScores();
    }

    renderResults(stats, { mode: mode, isPb: isPb, saved: saved, previousBest: previousBest, reason: reason });
    openModal(els.resultsModal, els.btnTryAgain);

    announce('Test complete. ' + Math.round(stats.wpm) + ' words per minute at ' +
      stats.accuracy.toFixed(1) + ' percent accuracy' + (isPb ? '. New personal best!' : '.'));
    if (navigator.vibrate) { try { navigator.vibrate(isPb ? [18, 40, 26] : 16); } catch (err) { /* ignore */ } }
  }

  function renderResults(stats, info) {
    var mode = info.mode;
    els.resRibbon.hidden = !info.isPb;
    setText(els.resWpm, String(Math.round(stats.wpm)));
    setText(els.resAcc, stats.accuracy.toFixed(1) + '%');
    setText(els.resTime, mode.seconds ? mode.seconds + 's' : E.formatClock(stats.elapsed) + 's');
    setText(els.resChars, stats.correctChars + ' / ' + stats.typedChars);
    setText(els.resMode, mode.label + (state.customText ? ' · custom' : ''));
    setText(els.resNet, String(Math.round(stats.netWpm)));
    setText(els.resErrors, String(stats.keystrokeErrors));

    if (info.isPb) {
      setText(els.resNote, 'Personal best beaten — previous record ' + Math.round(info.previousBest) + ' WPM. Saved locally.');
    } else if (info.saved) {
      setText(els.resNote, 'Saved to your local high scores.');
    } else {
      setText(els.resNote, 'Too short to save — keep typing for at least ' + MIN_SAVED_SECONDS + ' seconds to set a score.');
    }

    drawChart(state.samples);
  }

  /** Tiny dependency-free WPM sparkline. */
  function drawChart(samples) {
    var canvas = els.resChart;
    var caption = canvas.nextElementSibling;
    var usable = (samples || []).filter(function (s) { return s.wpm > 0; });

    if (usable.length < 2) {
      canvas.style.display = 'none';
      if (caption) caption.style.display = 'none';
      return;
    }
    canvas.style.display = '';
    if (caption) caption.style.display = '';

    var dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    var w = canvas.clientWidth || canvas.parentNode.clientWidth || 300;
    var h = 64;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';

    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var max = 10;
    usable.forEach(function (s) { if (s.wpm > max) max = s.wpm; });
    max = Math.ceil(max / 10) * 10;

    var padX = 4;
    var padTop = 8;
    var padBottom = 8;
    var spanW = w - padX * 2;
    var spanH = h - padTop - padBottom;

    function px(i) { return padX + (usable.length === 1 ? spanW / 2 : (i / (usable.length - 1)) * spanW); }
    function py(v) { return padTop + spanH - (v / max) * spanH; }

    // baseline
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, h - padBottom + 0.5);
    ctx.lineTo(w - padX, h - padBottom + 0.5);
    ctx.stroke();

    // area
    var grad = ctx.createLinearGradient(0, padTop, 0, h);
    grad.addColorStop(0, 'rgba(110,231,255,0.34)');
    grad.addColorStop(1, 'rgba(110,231,255,0)');
    ctx.beginPath();
    ctx.moveTo(px(0), py(usable[0].wpm));
    for (var i = 1; i < usable.length; i++) ctx.lineTo(px(i), py(usable[i].wpm));
    ctx.lineTo(px(usable.length - 1), h - padBottom);
    ctx.lineTo(px(0), h - padBottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    ctx.moveTo(px(0), py(usable[0].wpm));
    for (var j = 1; j < usable.length; j++) ctx.lineTo(px(j), py(usable[j].wpm));
    ctx.strokeStyle = '#6ee7ff';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // last point
    var lx = px(usable.length - 1);
    var ly = py(usable[usable.length - 1].wpm);
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  /* ------------------------------- Scores ------------------------------- */

  function renderScores() {
    var list = E.topScores(state.scores, state.scoreFilter, 5);
    var ol = els.scoreList;
    ol.textContent = '';

    if (!list.length) {
      var empty = document.createElement('li');
      empty.className = 'scores__empty';
      empty.textContent = state.scores.length
        ? 'No scores for this mode yet.'
        : 'Finish a run and your top five land here — stored only in this browser.';
      ol.appendChild(empty);
      return;
    }

    list.forEach(function (entry, i) {
      var li = document.createElement('li');
      li.className = 'score' + (i === 0 ? ' score--first' : '');

      var rank = document.createElement('span');
      rank.className = 'score__rank';
      rank.textContent = String(i + 1);

      var wpm = document.createElement('span');
      wpm.className = 'score__wpm';
      wpm.textContent = String(Math.round(entry.wpm * 10) / 10);
      var unit = document.createElement('small');
      unit.textContent = 'WPM';
      wpm.appendChild(unit);

      var meta = document.createElement('span');
      meta.className = 'score__meta';
      meta.textContent = (entry.accuracy || 0).toFixed(1) + '% accuracy · ' +
        (entry.chars || 0) + ' chars · ' + (entry.source === 'custom' ? 'custom text' : 'library');

      var date = document.createElement('span');
      date.className = 'score__date';
      date.textContent = E.formatDate(entry.date, Date.now());

      li.appendChild(rank);
      li.appendChild(wpm);
      li.appendChild(meta);
      li.appendChild(date);
      ol.appendChild(li);
    });
  }

  /* ---------------------------- Custom text ----------------------------- */

  function renderCustomLibrary() {
    var wrap = els.customSavedWrap;
    var list = els.customList;
    list.textContent = '';
    if (!state.customLibrary.length) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;

    state.customLibrary.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'custom__savedItem';

      var label = document.createElement('span');
      label.className = 'custom__savedText';
      label.textContent = item.text.slice(0, 72) + (item.text.length > 72 ? '…' : '');
      label.title = item.text.length + ' characters';

      var use = document.createElement('button');
      use.type = 'button';
      use.className = 'btn btn--sm';
      use.textContent = 'Use';
      use.addEventListener('click', function () {
        els.customInput.value = item.text;
        updateCustomCount();
        els.customInput.focus();
      });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn--sm btn--ghost';
      del.setAttribute('aria-label', 'Delete saved text');
      del.textContent = '×';
      del.addEventListener('click', function () {
        state.customLibrary = state.customLibrary.filter(function (x) { return x.id !== item.id; });
        store.set(KEYS.custom, state.customLibrary);
        renderCustomLibrary();
        toast('Saved text removed');
      });

      li.appendChild(label);
      li.appendChild(use);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  function updateCustomCount() {
    var text = E.normalizeTarget(els.customInput.value);
    var chars = text.length;
    var seconds = Math.max(1, Math.round(chars / 5)); // 60 WPM ≈ 5 chars/second
    els.customCount.textContent = chars
      ? chars + ' characters · about ' + seconds + 's at 60 WPM'
      : '0 characters · about 0s at 60 WPM';
  }

  function openCustomModal() {
    if (!els.customInput.value) {
      els.customInput.value = state.customText || (state.customLibrary[0] && state.customLibrary[0].text) || '';
    }
    updateCustomCount();
    renderCustomLibrary();
    openModal(els.customModal, els.customInput);
  }

  function applyCustomText() {
    var text = E.normalizeTarget(els.customInput.value);
    if (text.length < 20) {
      toast('Paste at least a sentence (20+ characters)');
      els.customInput.focus();
      return;
    }

    state.customText = text;
    var existing = state.customLibrary.some(function (item) { return item.text === text; });
    if (!existing) {
      state.customLibrary.unshift({ id: Date.now().toString(36), text: text });
      state.customLibrary = state.customLibrary.slice(0, MAX_CUSTOM);
      store.set(KEYS.custom, state.customLibrary);
    }

    els.customBadge.hidden = false;
    setMode('text');
    loadTest({ newText: true, focus: true });
    closeModal(els.customModal);
    toast('Custom text loaded — good luck');
  }

  function clearCustomText() {
    state.customText = '';
    els.customBadge.hidden = true;
    loadTest({ newText: true });
    toast('Back to the built-in library');
  }

  /* -------------------------------- Modals ------------------------------ */

  function focusables(root) {
    return Array.prototype.slice
      .call(root.querySelectorAll('button, textarea, input, select, a[href], [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
  }

  function openModalEl() {
    var modals = document.querySelectorAll('.modal');
    for (var i = 0; i < modals.length; i++) if (!modals[i].hidden) return modals[i];
    return null;
  }

  function openModal(el, focusTarget) {
    if (openModalEl()) return;
    lastFocused = document.activeElement;
    el.hidden = false;
    document.body.classList.add('no-scroll');
    window.requestAnimationFrame(function () {
      var target = focusTarget || focusables(el)[0];
      if (target && target.focus) target.focus({ preventScroll: true });
      if (el === els.resultsModal) drawChart(state.samples); // now that it has a width
    });
  }

  function closeModal(el) {
    el = el || openModalEl();
    if (!el) return;
    el.hidden = true;
    if (!openModalEl()) document.body.classList.remove('no-scroll');
    if (lastFocused && lastFocused.focus) {
      try { lastFocused.focus({ preventScroll: true }); } catch (err) { lastFocused.focus(); }
    }
    lastFocused = null;
    // Dismissing the summary should never leave a read-only, finished run behind.
    if (el === els.resultsModal && state.finished) loadTest({ newText: false, focus: true });
  }

  function trapTab(e, modal) {
    if (e.key !== 'Tab') return;
    var list = focusables(modal);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------- Pause -------------------------------- */

  function pause() {
    if (!state.running || state.finished) return;
    state.pausedAt = performance.now();
    state.running = false;
    if (rafId) cancelAnimationFrame(rafId);
    els.pausedOverlay.hidden = false;
  }

  function resume() {
    if (state.finished || !state.pausedAt) return;
    state.startedAt += performance.now() - state.pausedAt;
    state.pausedAt = null;
    state.running = true;
    els.pausedOverlay.hidden = true;
    els.input.focus();
    rafId = requestAnimationFrame(loop);
  }

  /* --------------------------- Keyboard inset --------------------------- */

  /**
   * Track the on-screen keyboard through the visual viewport so the input box,
   * stats and buttons never slide under it on iPad / iPhone / Android.
   */
  function initViewport() {
    var vv = window.visualViewport;
    function update() {
      var inset = 0;
      if (vv) inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      document.documentElement.style.setProperty('--kb-inset', inset + 'px');
      document.documentElement.classList.toggle('kb-open', inset > 120);
      updateFades();
    }
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', function () { setTimeout(update, 250); });
    update();
  }

  /* ------------------------------ Prefs --------------------------------- */

  function savePrefs() {
    store.set(KEYS.prefs, { mode: state.mode, scoreFilter: state.scoreFilter });
  }

  function loadPrefs() {
    var prefs = store.get(KEYS.prefs, null);
    if (!prefs) return;
    if (prefs.scoreFilter) state.scoreFilter = prefs.scoreFilter;
    if (prefs.mode && MODES.some(function (m) { return m.id === prefs.mode; })) {
      state.mode = prefs.mode;
    }
  }

  /* ------------------------------- Wiring ------------------------------- */

  function bind() {
    els.input.addEventListener('input', onInput);
    els.input.addEventListener('paste', function () { window.setTimeout(onInput, 0); });

    els.input.addEventListener('focus', function () {
      els.stage.classList.add('is-focused');
      els.focusPill.hidden = true;
      if (document.documentElement.classList.contains('kb-open')) {
        window.setTimeout(function () {
          try { els.input.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' }); }
          catch (err) { els.input.scrollIntoView(false); }
        }, 240);
      }
    });
    els.input.addEventListener('blur', function () {
      els.stage.classList.remove('is-focused');
      if (!state.finished && (coarsePointer || state.startedAt !== null)) els.focusPill.hidden = false;
    });
    // Block the return key from submitting anything weird; newlines are allowed.
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        restart();
      }
    });

    els.display.addEventListener('click', function () {
      if (!state.finished) els.input.focus();
    });
    els.display.addEventListener('keydown', function (e) {
      if (e.key === ' ') e.preventDefault(); // don't scroll the page from the panel
    });
    els.display.addEventListener('scroll', updateFades, { passive: true });
    els.focusPill.addEventListener('click', function () { els.input.focus(); });

    els.btnRestart.addEventListener('click', function () { restart(); els.input.focus(); });
    els.btnNew.addEventListener('click', function () { nextParagraph(); els.input.focus(); });
    els.btnCustom.addEventListener('click', openCustomModal);
    els.btnResume.addEventListener('click', resume);
    els.btnClearCustom.addEventListener('click', clearCustomText);

    modeButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        // Tapping the mode you are already in is a shortcut for "restart".
        if (btn.dataset.mode === state.mode && !state.finished) {
          restart();
          els.input.focus();
          return;
        }
        setMode(btn.dataset.mode, { focus: state.startedAt !== null || state.finished });
      });
    });

    filterChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.scoreFilter = chip.dataset.filter;
        filterChips.forEach(function (c) { c.classList.toggle('is-active', c === chip); });
        savePrefs();
        renderScores();
      });
    });

    els.btnClearScores.addEventListener('click', function () {
      if (!state.scores.length) { toast('Nothing to clear'); return; }
      state.scores = [];
      store.remove(KEYS.scores);
      renderScores();
      toast('High scores cleared');
    });

    els.btnTryAgain.addEventListener('click', function () {
      closeModal(els.resultsModal); // resets the same text and refocuses
    });
    els.btnResNew.addEventListener('click', function () {
      closeModal(els.resultsModal);
      if (!(state.mode === 'text' && state.customText)) loadTest({ newText: true, focus: true });
    });

    els.customInput.addEventListener('input', updateCustomCount);
    els.btnCustomStart.addEventListener('click', applyCustomText);
    els.btnCustomClear.addEventListener('click', function () {
      els.customInput.value = '';
      updateCustomCount();
      els.customInput.focus();
    });
    els.customInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        applyCustomText();
      }
    });

    document.addEventListener('click', function (e) {
      var closer = e.target.closest ? e.target.closest('[data-close]') : null;
      if (closer) {
        var modal = openModalEl();
        if (modal) closeModal(modal);
      }
    });

    document.addEventListener('keydown', function (e) {
      var modal = openModalEl();

      if (e.key === 'Escape') {
        if (modal) { e.preventDefault(); closeModal(modal); }
        else if (document.activeElement === els.input) els.input.blur();
        return;
      }

      if (modal) {
        trapTab(e, modal);
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && modal === els.customModal) {
          e.preventDefault();
          applyCustomText();
        }
        return;
      }

      // Alt+R restart · Alt+N new paragraph · Alt+C custom · Alt+1..4 modes
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        var key = e.key.toLowerCase();
        if (key === 'r') { e.preventDefault(); restart(); els.input.focus(); }
        else if (key === 'n') { e.preventDefault(); nextParagraph(); els.input.focus(); }
        else if (key === 'c') { e.preventDefault(); openCustomModal(); }
        else if (key >= '1' && key <= '4') { e.preventDefault(); setMode(MODES[Number(key) - 1].id, { focus: true }); }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        restart();
        return;
      }

      // "Just start typing": any printable key focuses the input, unless the
      // user is already in a field or the run is over. (Space is excluded so
      // page scrolling still works when a button has focus.)
      if (state.finished || e.metaKey || e.ctrlKey) return;
      var ae = document.activeElement;
      var alreadyTyping = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT' || ae.isContentEditable);
      if (!alreadyTyping && e.key && e.key.length === 1 && e.key !== ' ') {
        els.input.focus();
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
    });

    window.addEventListener('resize', function () {
      if (!els.resultsModal.hidden) drawChart(state.samples);
    });

    // Stop iOS from offering to zoom when double-tapping the controls.
    document.addEventListener('dblclick', function (e) {
      if (e.target.closest && e.target.closest('.btn, .chip, .modes__btn')) e.preventDefault();
    }, { passive: false });
  }

  /* -------------------------------- Init -------------------------------- */

  function init() {
    state.scores = store.get(KEYS.scores, []);
    if (!Array.isArray(state.scores)) state.scores = [];
    state.customLibrary = store.get(KEYS.custom, []);
    if (!Array.isArray(state.customLibrary)) state.customLibrary = [];
    loadPrefs();

    modeButtons.forEach(function (btn) {
      var on = btn.dataset.mode === state.mode;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    filterChips.forEach(function (chip) {
      chip.classList.toggle('is-active', chip.dataset.filter === state.scoreFilter);
    });

    initViewport();
    bind();
    loadTest({ newText: true });
    renderScores();
    renderCustomLibrary();
    els.customBadge.hidden = !state.customText;

    // Probe localStorage once so private-mode users get told the truth.
    if (!store.set(KEYS.prefs, { mode: state.mode, scoreFilter: state.scoreFilter })) {
      els.hintText.textContent = 'Local storage is blocked, so scores will not persist in this browser.';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
