/**
 * engine.js — DOM-free core logic for the Velocity typing test.
 *
 * Everything in here is pure (no document/window access) so it can be unit
 * tested in Node (`node --test tests/`) and reused by the UI layer (app.js).
 * Exposed as `window.TypingEngine` in the browser and `module.exports` in Node.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TypingEngine = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Practice library
   * ------------------------------------------------------------------ */

  var PARAGRAPHS = [
    "The best interfaces disappear. When a tool fits the hand, the user stops thinking about the tool and starts thinking about the work, which is the only compliment a designer should ever want to receive.",
    "Orbit is not a place where you float; it is a place where you fall forever and keep missing the ground. Every spacecraft above us is a stone thrown so hard that the curve of its fall matches the curve of the planet.",
    "She kept the letter in a tin box with a broken hinge, and once a year she read it aloud to nobody in particular, surprised each time by how a few sentences could still hold so much weather.",
    "Rain arrived after midnight, and the forest answered in layers: first the broad leaves, then the needles, then the soft percussion of drops reaching the floor where a season of decay had gathered.",
    "Good coffee is mostly patience wearing an apron. Grind just before you brew, weigh the water, and resist the urge to hurry the bloom; the cup rewards the person who is willing to stand still for four minutes.",
    "The printing press did not invent curiosity, but it made curiosity cheap. Once a page could be copied a thousand times, an idea stopped belonging to the room where it was spoken and started traveling on its own.",
    "A bassline is an argument you feel before you hear. It walks into the room, moves the furniture, and by the second chorus you have agreed to everything without being asked a single question.",
    "The city at six in the morning belongs to delivery vans, bakers, and runners. By eight the streets have changed owners again, and the quiet hours fold themselves away like scaffolding after a wedding.",
    "Most of the ocean remains unmapped in detail, which is a strange thing to admit about our own planet. We know the shape of certain distant craters better than we know the canyons beneath our own ships.",
    "Craft is what is left after enthusiasm runs out. It is the second draft, the sanded edge, the error message rewritten three times so that a stranger at midnight knows exactly what to do next.",
    "Distance running is a negotiation with discomfort. The body asks to stop somewhere around the eighth kilometer, and the training is really about learning to answer politely, then keep going anyway.",
    "Attention is the only currency that cannot be printed. Whatever you spend it on today becomes, in small and stubborn ways, the shape of the person you are next year.",
    "Debugging is applied humility. You state what you believe the program does, the program states what it actually does, and one of those two statements is about to become very embarrassing.",
    "Winter in the mountains is a study in subtraction. Color leaves, then sound, then the trails themselves, until the valley is only white geometry and the long blue shadow of early afternoon."
  ];

  /* ------------------------------------------------------------------ *
   * Smart punctuation normalization
   *
   * iPadOS / iOS keyboards silently substitute typographic characters:
   *   '  ->  \u2018 \u2019      "  ->  \u201C \u201D
   *   -  ->  \u2013 \u2014      ... -> \u2026
   *   space -> \u00A0 (after some autocorrect passes)
   *   space + space -> ". " (the double-space period shortcut)
   * Mobile users must not be penalised for their keyboard's habits, so we
   * fold all of these to their plain ASCII equivalents on BOTH sides of the
   * comparison (target text and typed input).
   * ------------------------------------------------------------------ */

  var SMART_CHAR_MAP = {
    '\u2018': "'", // ' left single quote
    '\u2019': "'", // ' right single quote / apostrophe
    '\u201B': "'", // ‛
    '\u2032': "'", // ′ prime
    '\u201C': '"', // “ left double quote
    '\u201D': '"', // ” right double quote
    '\u201F': '"', // ‟
    '\u2033': '"', // ″ double prime
    '\u2039': "'", // ‹
    '\u203A': "'", // ›
    '\u00AB': '"', // «
    '\u00BB': '"', // »
    '\u2013': '-', // – en dash
    '\u2014': '-', // — em dash
    '\u2015': '-', // ― horizontal bar
    '\u2212': '-', // − minus sign
    '\u2010': '-', // ‐ hyphen
    '\u2011': '-', // ‑ non-breaking hyphen
    '\u2026': '...', // … ellipsis
    '\u00A0': ' ', // non-breaking space
    '\u2007': ' ', // figure space
    '\u202F': ' ', // narrow nbsp
    '\u2009': ' ', // thin space
    '\u200A': ' ', // hair space
    '\u3000': ' ', // ideographic space
    '\u200B': '', // zero width space
    '\u200C': '', // zero width non-joiner
    '\u200D': '', // zero width joiner
    '\uFEFF': '', // BOM
    '\u0301': '', // stray combining acute (defensive)
    '\u0308': '' // stray combining diaeresis (defensive)
  };

  var SMART_CHAR_RE = /[\u2018\u2019\u201B\u2032\u201C\u201D\u201F\u2033\u2039\u203A\u00AB\u00BB\u2013\u2014\u2015\u2212\u2010\u2011\u2026\u00A0\u2007\u202F\u2009\u200A\u3000\u200B\u200C\u200D\uFEFF\u0301\u0308]/g;

  /** Fold smart punctuation to ASCII. Length-preserving except for ellipsis. */
  function normalizeChars(str) {
    return String(str == null ? '' : str)
      .replace(/\r\n?/g, '\n')
      .replace(SMART_CHAR_RE, function (ch) {
        var mapped = SMART_CHAR_MAP[ch];
        return mapped === undefined ? ch : mapped;
      })
      .replace(/\t/g, '  ');
  }

  /**
   * Normalize a target paragraph: fold punctuation, then tidy whitespace so a
   * pasted text can never demand invisible characters the user cannot see
   * (trailing spaces, 5 blank lines in a row, leading indent, etc).
   */
  function normalizeTarget(str) {
    return normalizeChars(str)
      .replace(/[ \u00a0]+$/gm, '') // strip trailing spaces on every line
      .replace(/^[ \u00a0]+/gm, '') // strip leading indentation
      .replace(/\n{3,}/g, '\n\n') // collapse blank-line runs
      .trim();
  }

  /** Normalize what the user actually typed (no whitespace tidying). */
  function normalizeInput(str) {
    return normalizeChars(str);
  }

  /**
   * Undo the iOS/iPadOS "space space -> period space" shortcut.
   *
   * Typing a second space rewrites the pair into ". " (same length, so the
   * caret stays put). We only rewrite a period when the target genuinely
   * expects two spaces at that offset, so a legitimately typed full stop is
   * never touched.
   */
  function repairIOSDoubleSpace(typed, target) {
    if (!typed || typed.indexOf('.') === -1) return typed;
    var out = '';
    for (var i = 0; i < typed.length; i++) {
      var ch = typed[i];
      var isIOSPattern =
        ch === '.' && // the injected period...
        typed[i + 1] === ' ' && // ...plus its automatic trailing space
        target[i] === ' ' && // while the text really wants
        target[i + 1] === ' '; // two spaces right here
      out += isIOSPattern ? ' ' : ch;
    }
    return out;
  }

  /**
   * Companion to the above: iOS capitalises the letter that follows its
   * injected period. Guarded tightly — it only fires when the target wants
   * two spaces at the ". " and the very next character is the upper-case
   * version of the expected lower-case one.
   */
  function repairIOSAutoCaps(typed, target) {
    if (!typed || typed.indexOf('.') === -1) return typed;
    var out = '';
    for (var i = 0; i < typed.length; i++) {
      var ch = typed[i];
      var lower = ch.toLowerCase();
      var isInjectedCap =
        i >= 2 &&
        ch !== lower && // an upper-case letter...
        lower === target[i] && // ...where the target wants its lower-case form
        typed[i - 2] === '.' && // preceded by iOS's ". " substitution
        typed[i - 1] === ' ' &&
        target[i - 2] === ' ' &&
        target[i - 1] === ' ';
      out += isInjectedCap ? lower : ch;
    }
    return out;
  }

  /** Full input pipeline: fold smart punctuation, then repair iOS spacing. */
  function normalizeTyped(typed, target) {
    var safeTarget = target || '';
    var folded = repairIOSDoubleSpace(repairIOSAutoCaps(normalizeInput(typed), safeTarget), safeTarget);
    return folded;
  }

  /* ------------------------------------------------------------------ *
   * Stats
   * ------------------------------------------------------------------ */

  /** Below this many seconds a live WPM number is noise, so we report 0. */
  var MIN_WPM_SECONDS = 0.5;

  /**
   * @param {object} o
   * @param {string} o.typed               normalized text typed so far
   * @param {string} o.target              normalized target text
   * @param {number} o.elapsed             seconds since the first keystroke
   * @param {number} [o.totalKeystrokes]   every character-producing keystroke
   * @param {number} [o.correctKeystrokes] keystrokes that matched on arrival
   */
  function computeStats(o) {
    o = o || {};
    var typed = String(o.typed == null ? '' : o.typed);
    var target = String(o.target == null ? '' : o.target);
    var elapsed = Math.max(0, Number(o.elapsed) || 0);
    var minutes = elapsed / 60;
    var usable = elapsed >= MIN_WPM_SECONDS;

    var shared = Math.min(typed.length, target.length);
    var correctChars = 0;
    for (var i = 0; i < shared; i++) {
      if (typed[i] === target[i]) correctChars++;
    }
    var incorrectChars = typed.length - correctChars;

    // Standard formulas, exactly as specified:
    //   WPM      = (total typed characters / 5) / (elapsed seconds / 60)
    //   Accuracy = (correct characters / total typed characters) * 100
    var wpm = usable ? typed.length / 5 / minutes : 0;
    var netWpm = usable ? correctChars / 5 / minutes : 0;
    var accuracy = typed.length ? (correctChars / typed.length) * 100 : 100;

    var totalKeys = Math.max(0, Number(o.totalKeystrokes) || 0);
    var correctKeys = Math.max(0, Number(o.correctKeystrokes) || 0);

    return {
      elapsed: elapsed,
      typedChars: typed.length,
      targetChars: target.length,
      correctChars: correctChars,
      incorrectChars: incorrectChars,
      wpm: wpm,
      netWpm: netWpm,
      accuracy: accuracy,
      keystrokes: totalKeys,
      keystrokeErrors: Math.max(0, totalKeys - correctKeys),
      keystrokeAccuracy: totalKeys ? (correctKeys / totalKeys) * 100 : 100,
      progress: target.length ? Math.min(1, typed.length / target.length) : 0
    };
  }

  /* ------------------------------------------------------------------ *
   * Formatting
   * ------------------------------------------------------------------ */

  /** 12.4 below a minute, 1:07 above it. */
  function formatClock(seconds) {
    var s = Math.max(0, Number(seconds) || 0);
    if (s < 60) return (Math.round(s * 10) / 10).toFixed(1);
    var m = Math.floor(s / 60);
    var rest = Math.floor(s % 60);
    return m + ':' + String(rest).padStart(2, '0');
  }

  /** "Nov 20" / "Nov 20, 2024" — stable, locale-aware, no dependencies. */
  function formatDate(ts, now) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    var ref = now ? new Date(now) : new Date();
    var sameYear = d.getFullYear() === ref.getFullYear();
    var opts = sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' };
    try {
      return new Intl.DateTimeFormat(undefined, opts).format(d);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  /* ------------------------------------------------------------------ *
   * Text selection helpers
   * ------------------------------------------------------------------ */

  function shuffle(list, random) {
    var rnd = typeof random === 'function' ? random : Math.random;
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** Random paragraph index that is different from `excludeIndex`. */
  function pickParagraphIndex(count, excludeIndex, random) {
    if (count <= 0) return -1;
    if (count === 1) return 0;
    var rnd = typeof random === 'function' ? random : Math.random;
    var idx = Math.floor(rnd() * count);
    if (idx === excludeIndex) idx = (idx + 1 + Math.floor(rnd() * (count - 1))) % count;
    return idx;
  }

  /**
   * Build a long, uninterrupted stream of text for countdown modes so a fast
   * typist can never run out of words before the clock does.
   */
  function buildStream(options) {
    var o = options || {};
    var paragraphs = o.paragraphs || [];
    var minLength = o.minLength || 1800;
    var customText = o.customText || '';
    var rnd = typeof o.random === 'function' ? o.random : Math.random;

    var parts = customText ? [customText] : [];
    if (!paragraphs.length) return parts.join(' ');

    var pool = shuffle(paragraphs, rnd);
    var guard = 0;
    while (parts.join(' ').length < minLength && guard++ < 500) {
      if (!pool.length) pool = shuffle(paragraphs, rnd);
      parts.push(pool.pop());
    }
    return parts.join(' ');
  }

  /* ------------------------------------------------------------------ *
   * High scores
   * ------------------------------------------------------------------ */

  var MAX_STORED_SCORES = 200;

  /**
   * Add a run to the score list and keep the best `topN` per mode plus an
   * overall cap, so localStorage can never grow without bound.
   */
  function recordScore(entries, entry, topN) {
    var list = Array.isArray(entries) ? entries.slice() : [];
    var n = topN || 5;
    list.push({
      wpm: Math.round(entry.wpm * 10) / 10,
      accuracy: Math.round(entry.accuracy * 10) / 10,
      mode: entry.mode,
      date: entry.date,
      chars: entry.chars,
      source: entry.source || 'library'
    });
    list.sort(function (a, b) {
      if (b.wpm !== a.wpm) return b.wpm - a.wpm;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return (a.date || 0) - (b.date || 0);
    });

    // Keep the global top N overall plus the top N of every mode, so a slower
    // mode's leaderboard never gets wiped out by a faster one.
    var keep = [];
    var perMode = {};
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var modeCount = perMode[item.mode] || 0;
      if (keep.length < n || modeCount < n) {
        keep.push(item);
        perMode[item.mode] = modeCount + 1;
      }
      if (keep.length >= MAX_STORED_SCORES) break;
    }
    return keep;
  }

  /** Sorted top-N view used by the leaderboard (mode = 'all' or a mode id). */
  function topScores(entries, mode, topN) {
    var list = (Array.isArray(entries) ? entries : []).filter(function (e) {
      return e && typeof e.wpm === 'number';
    });
    if (mode && mode !== 'all') {
      list = list.filter(function (e) {
        return e.mode === mode;
      });
    }
    list.sort(function (a, b) {
      if (b.wpm !== a.wpm) return b.wpm - a.wpm;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return (a.date || 0) - (b.date || 0);
    });
    return list.slice(0, topN || 5);
  }

  /** Best WPM for a mode, optionally ignoring a run that has not been saved yet. */
  function bestWpm(entries, mode) {
    var best = 0;
    (Array.isArray(entries) ? entries : []).forEach(function (e) {
      if (e && e.mode === mode && e.wpm > best) best = e.wpm;
    });
    return best;
  }

  return {
    PARAGRAPHS: PARAGRAPHS,
    MIN_WPM_SECONDS: MIN_WPM_SECONDS,
    normalizeChars: normalizeChars,
    normalizeTarget: normalizeTarget,
    normalizeInput: normalizeInput,
    normalizeTyped: normalizeTyped,
    repairIOSDoubleSpace: repairIOSDoubleSpace,
    repairIOSAutoCaps: repairIOSAutoCaps,
    computeStats: computeStats,
    formatClock: formatClock,
    formatDate: formatDate,
    shuffle: shuffle,
    pickParagraphIndex: pickParagraphIndex,
    buildStream: buildStream,
    recordScore: recordScore,
    topScores: topScores,
    bestWpm: bestWpm
  };
});
