# Velocity — Speed Typing Test

A responsive, single-page typing test built for **both** touch keyboards (iPad / iPhone / Android) and
desktop keyboards. Plain HTML, CSS and vanilla JavaScript — no build step, no framework, no backend,
no external requests of any kind.

## Run it

Any static file server works:

```bash
python3 -m http.server 3000 --bind 0.0.0.0   # or: npm start
# open http://localhost:3000
```

Or just open `index.html` directly — the app has no server-side dependency.

## Features

**Text**

- 14 built-in practice paragraphs covering tech, science, travel, music, craft and more.
- **Custom text** modal: paste or type anything. Saved texts are kept in `localStorage` (up to 8) so you
  can reuse them; each one can be re-loaded or deleted.
- Countdown modes — **15s / 30s / 60s** — get a 1,800-character runway so a fast typist can never run out
  of words before the clock does.

**Live feedback**

- Per-character highlighting: correct = green, incorrect = red with an underline (the underline is an inset
  box-shadow, so it also renders on a wrongly typed *space*).
- A caret bar on the current character: solid while you type, breathing when idle.
- The text panel auto-scrolls to keep the caret in view and fades at its edges when there is more to read.

**Stats**

| Stat | Formula |
| --- | --- |
| WPM | `(typed characters / 5) / (elapsed seconds / 60)` |
| Accuracy | `(correct characters / typed characters) * 100` |
| Net WPM | `(correct characters / 5) / (elapsed seconds / 60)` — shown live and in the summary |

The clock starts on the **first keystroke** and stops the moment the last character is typed (or the
countdown expires). Progress bar, character counts and a "mistakes made" counter update in real time.

**Results & records**

- Summary card with WPM, accuracy, time, characters, net WPM, mistakes, and a dependency-free canvas
  sparkline of WPM across the run.
- A **New personal best** ribbon when you beat your record for that mode.
- Top 5 scores per mode (WPM, accuracy, mode, character count, library/custom, date) persisted in
  `localStorage`, filterable by mode and clearable in one tap.
- One-tap **Try again**; dismissing the summary always leaves the page ready to type again.

## iPad / iOS specifics

This is where most typing tests quietly punish mobile users, so it is handled explicitly:

- **Smart punctuation folding.** `‘ ’ ‛ “ ” ‟ ‹ › « » ′ ″` → `' "`, `— – ― − ‐ ‑` → `-`, `…` → `...`,
  non-breaking/thin/figure/ideographic spaces → plain space, zero-width characters dropped. Applied to the
  *target text* as well as the *typed input*, so both sides always agree.
- **The double-space shortcut.** iPadOS rewrites `space space` into `. `. That substitution is undone — but
  only where the target genuinely expects two spaces, so a real full stop is never touched. It is
  length-preserving, so the caret never jumps.
- **Auto-capitalisation** that iOS applies after its injected period is undone under the same tight guard.
- **Keyboard-aware layout.** The visual viewport is tracked and the keyboard height is written to
  `--kb-inset`; `html.kb-open` then compresses the page so the text, input box, stat cards and buttons all
  stay above the on-screen keyboard (sized to fit an iPad in landscape).
- Inputs carry `spellcheck="false" autocorrect="off" autocapitalize="off" autocomplete="off"` and are
  `16px`+ so Safari never zooms the page on focus.
- 44px touch targets, `touch-action: manipulation`, no double-tap zoom on the controls, and the test
  auto-pauses when the tab/app is backgrounded.
- Pasted text is sanitised: indentation, trailing spaces and runs of blank lines are removed so nothing
  invisible can be demanded of the typist.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| any letter | focuses the input — just start typing |
| `Alt/⌥ + R`, `Ctrl/⌘ + Enter` | restart the same text |
| `Alt/⌥ + N` | new paragraph |
| `Alt/⌥ + C` | custom text |
| `Alt/⌥ + 1…4` | Text / 15s / 30s / 60s |
| `Esc` | close a modal, or unfocus the input |

## Project layout

```
index.html          markup: stats, stage, actions, scores, two modals
styles.css          dark theme, tokens, responsive + keyboard-inset rules
engine.js           DOM-free logic: normalization, stats, scoring, text selection
app.js              UI controller: rendering, input pipeline, timer, storage
tests/engine.test.js     unit tests for the engine
tests/ui.smoke.test.js   jsdom smoke tests that drive the real app
```

`engine.js` is deliberately pure (UMD-style: `window.TypingEngine` in the browser, `module.exports` in
Node) so the tricky parts — punctuation folding, iOS repairs, WPM/accuracy, score ranking — are testable
without a browser.

## Tests

```bash
npm install     # dev-only: jsdom, used by the UI smoke tests
npm test        # 47 tests: engine unit tests + jsdom-driven UI tests
```

The UI tests boot the actual `index.html`, type into it (including curly quotes, em dashes and the iOS
`. ` substitution), finish runs against a faked clock, and assert on the rendered DOM, the results modal
and `localStorage`. They skip themselves if jsdom is not installed — the app itself has zero dependencies.

## Notes

- Scores, custom texts and preferences live only in the browser. If `localStorage` is blocked (private
  mode), the app still works and says so in the hint line.
- Runs shorter than 2 seconds or 8 characters are not saved, so accidental finishes do not pollute the
  leaderboard.
- Honours `prefers-reduced-motion` and `forced-colors`.
