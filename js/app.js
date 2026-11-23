/**
 * IELTS Prep Hub — Main SPA Controller (ES6+)
 * Zero-backend static application powered by JSON + Browser localStorage.
 */
(function () {
  const Store = window.IELTSStorage;
  const Charts = window.IELTSCharts;
  const { icon } = window.IELTSIcons;

  const AppState = {
    data: null,
    route: "dashboard",
    dailyIdiomIndex: 0,

    // Module 1: Practice & Quiz Engine
    quizFilterModule: "All",
    activeQuiz: null, // null or quiz object (can be custom mock simulation)
    quizTimedMode: true,
    quizSecondsLeft: 0,
    quizTimerId: null,
    quizAnswers: {}, // { [qId]: value }
    quizCheckedSingle: {}, // { [qId]: true }
    quizSubmitted: false,
    quizFlagged: {},
    audioTranscriptOpen: false,
    audioPlaying: false,
    audioLineIdx: -1,
    audioRate: 1.0,

    // Module 2: Speaking Simulator
    speakingTab: "part2", // 'part1' | 'part2' | 'part3'
    part1Category: "All",
    activePart1Idx: 0,
    part1ModelOpen: false,
    part1SelfCheck: { fc: false, lr: false, gra: false, p: false },

    activeCueIdx: 0,
    cueModelOpen: false,
    cueTimerPhase: "prep", // 'prep' (60s) | 'speak' (120s)
    cueSecondsLeft: 60,
    cueTimerRunning: false,
    cueTimerId: null,

    activePart3Idx: 0,
    part3ModelOpen: false,

    // Voice recorder state (client-side memory only)
    recState: "idle", // 'idle' | 'recording' | 'ready' | 'error'
    recAudioUrl: null,
    recErrorMsg: "",
    mediaRecorder: null,
    recChunks: [],

    // Module 3: Writing Sample Bank
    writingTaskFilter: "All",
    activeWritingId: "w_bar_property",
    activeVersionIdx: 0,
    commentaryOn: true,
    selectedInlineNote: "Click or hover any highlighted phrase in the essay below to inspect why the examiner rewarded—or penalised—it.",
    practicePadOpen: false,

    // Module 4: Idioms & Collocations Vault
    vaultQuery: "",
    vaultTopic: "All",
    vaultBand: "All",
    vaultSavedOnly: false,
    vaultFlashcardMode: false,
    flashcardIdx: 0,
    flashcardFlipped: false
  };

  /* --------------------------- Utility Helpers --------------------------- */

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMMSS(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  /**
   * Official IELTS word count logic:
   * Hyphenated words like "forty-two" or "next-day" count as 1 word.
   */
  function countIeltsWords(raw) {
    const cleaned = String(raw || "").trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).filter(Boolean).length;
  }

  function normalizeGapAnswer(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/^[£$€]+|[%]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function evaluateQuestion(q, userVal) {
    if (q.type === "mcq" || q.type === "tfng") {
      if (userVal === undefined || userVal === null || userVal === "") {
        return { answered: false, isCorrect: false, reason: "Unanswered" };
      }
      const isCorrect = Number(userVal) === Number(q.correct_index);
      return { answered: true, isCorrect, reason: isCorrect ? "Correct" : "Incorrect choice" };
    }

    if (q.type === "gap_fill") {
      const raw = String(userVal || "").trim();
      if (!raw) {
        return { answered: false, isCorrect: false, wordCount: 0, reason: "Blank response" };
      }
      const wc = countIeltsWords(raw);
      if (q.word_limit && wc > q.word_limit) {
        return {
          answered: true,
          isCorrect: false,
          wordCount: wc,
          exceededLimit: true,
          reason: `Exceeded strict IELTS word limit (${wc} words typed; max allowed is ${q.word_limit}).`
        };
      }
      const norm = normalizeGapAnswer(raw);
      const accepted = (q.accepted_answers || []).map((a) => normalizeGapAnswer(a));
      const isCorrect = accepted.includes(norm);
      return {
        answered: true,
        isCorrect,
        wordCount: wc,
        exceededLimit: false,
        reason: isCorrect ? "Exact match" : "Does not match accepted answer"
      };
    }

    return { answered: false, isCorrect: false };
  }

  function estimateBandFromRatio(ratio) {
    if (ratio >= 0.92) return "9.0";
    if (ratio >= 0.85) return "8.5";
    if (ratio >= 0.76) return "8.0";
    if (ratio >= 0.68) return "7.5";
    if (ratio >= 0.58) return "7.0";
    if (ratio >= 0.48) return "6.5";
    if (ratio >= 0.38) return "6.0";
    return "5.5";
  }

  function stopAllTimersAndAudio() {
    if (AppState.quizTimerId) {
      clearInterval(AppState.quizTimerId);
      AppState.quizTimerId = null;
    }
    if (AppState.cueTimerId) {
      clearInterval(AppState.cueTimerId);
      AppState.cueTimerId = null;
      AppState.cueTimerRunning = false;
    }
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
    AppState.audioPlaying = false;
    AppState.audioLineIdx = -1;
  }

  /* --------------------------- Data Initialization --------------------------- */

  async function loadData() {
    try {
      const res = await fetch("./data/ielts-data.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (err) {
      if (window.__IELTS_FALLBACK_DATA__) {
        return window.__IELTS_FALLBACK_DATA__;
      }
      throw err;
    }
  }

  /* --------------------------- Top Nav & Header KPIs --------------------------- */

  function syncNavChrome() {
    document.querySelectorAll("[data-nav-route]").forEach((btn) => {
      const target = btn.getAttribute("data-nav-route");
      const active = target === AppState.route;
      btn.classList.toggle("bg-ink", active);
      btn.classList.toggle("text-white", active);
      btn.classList.toggle("shadow-sm", active);
      btn.classList.toggle("text-ink-muted", !active);
      btn.classList.toggle("hover:text-ink", !active);
      btn.classList.toggle("hover:bg-paper-warm", !active);
      btn.setAttribute("aria-current", active ? "page" : "false");
    });

    const streakEl = document.getElementById("header-streak-val");
    if (streakEl) {
      streakEl.textContent = `${Store.state.streakDays}d`;
    }
    const accEl = document.getElementById("header-accuracy-val");
    if (accEl) {
      const acc = Store.getAccuracyPercent();
      accEl.textContent = acc === null ? "—" : `${acc}%`;
    }
    const savedEl = document.getElementById("header-saved-val");
    if (savedEl) {
      savedEl.textContent = String(Store.state.savedIdioms.length);
    }
  }

  function navigate(route, skipHashUpdate = false) {
    const valid = ["dashboard", "practice", "speaking", "writing", "vault"];
    const next = valid.includes(route) ? route : "dashboard";
    if (AppState.route !== next) {
      stopAllTimersAndAudio();
    }
    AppState.route = next;
    if (!skipHashUpdate && window.location.hash !== `#${next}`) {
      history.replaceState(null, "", `#${next}`);
    }
    syncNavChrome();
    renderMain();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ============================================================================
     VIEW 1: DASHBOARD (HOME)
     ============================================================================ */

  function renderDashboard() {
    const d = AppState.data;
    const idioms = d.idioms_vault;
    const dailyIdiom = idioms[AppState.dailyIdiomIndex % idioms.length];
    const isSaved = Store.isIdiomSaved(dailyIdiom.id);

    const acc = Store.getAccuracyPercent();
    const quizDoneCount = Object.keys(Store.state.quizAttempts).length;
    const totalSets = d.quiz_sets.length;
    const roadmapDone = Store.state.completedDays.length;
    const roadmapTotal = d.study_plan_14_days.length;
    const roadmapPct = Math.round((roadmapDone / roadmapTotal) * 100);

    return `
      <div class="view-animate space-y-8">
        <!-- Editorial Hero & Live Progress Strip -->
        <section class="bg-white rounded-2xl border border-paper-subtle shadow-desk overflow-hidden">
          <div class="p-6 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div class="lg:col-span-7 space-y-4">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-oxford-50 border border-oxford-200 text-oxford-700 text-xs font-semibold tracking-wide">
                <span class="w-2 h-2 rounded-full bg-oxford-600"></span>
                100% Client-Side Study Desk • Saved Automatically in Your Browser
              </div>
              <h1 class="font-serif text-3xl sm:text-4xl font-bold text-ink tracking-tight leading-tight">
                Master IELTS without sounding like a memorised textbook.
              </h1>
              <p class="text-ink-muted text-sm sm:text-base leading-relaxed max-w-2xl">
                Practise under real timed conditions across Listening, Reading, Writing, and Speaking. Inspect authentic Band 7–9 VIP scripts, plan 60-second Cue Cards, and build high-band lexical precision.
              </p>
              <div class="flex flex-wrap gap-3 pt-1">
                <button data-action="launch-mock-sim" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-oxford-600 hover:bg-oxford-700 text-white text-sm font-semibold shadow-sm transition">
                  ${icon("zap", "w-4 h-4")}<span>Start 12-Min Mock Simulation</span>
                </button>
                <button data-action="go-route" data-target="speaking" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-paper-warm hover:bg-paper-subtle text-ink text-sm font-semibold border border-paper-subtle transition">
                  ${icon("mic", "w-4 h-4")}<span>Open 60s Cue Card Planner</span>
                </button>
                <button data-action="go-route" data-target="writing" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-paper text-ink-muted hover:text-ink text-sm font-medium border border-paper-subtle transition">
                  ${icon("barChart", "w-4 h-4")}<span>Band 7–9 Sample Bank</span>
                </button>
              </div>
            </div>

            <!-- 4 KPI Cards -->
            <div class="lg:col-span-5 grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-paper p-4 border border-paper-subtle">
                <div class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Study Streak</div>
                <div class="mt-1 flex items-baseline gap-1.5">
                  <span class="text-2xl sm:text-3xl font-bold text-ink">${Store.state.streakDays}</span>
                  <span class="inline-flex items-center gap-1 text-xs font-medium text-amberband-600">day${Store.state.streakDays === 1 ? "" : "s"} ${icon("flame", "w-3.5 h-3.5")}</span>
                </div>
                <p class="text-[11px] text-ink-muted mt-1">Active today • local browser log</p>
              </div>

              <div class="rounded-xl bg-paper p-4 border border-paper-subtle">
                <div class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Quiz Accuracy</div>
                <div class="mt-1 flex items-baseline gap-1.5">
                  <span class="text-2xl sm:text-3xl font-bold text-oxford-600">${acc === null ? "—" : acc + "%"}</span>
                  ${
                    acc !== null
                      ? `<span class="text-xs font-semibold text-ink-muted">≈ Band ${estimateBandFromRatio(acc / 100)}</span>`
                      : `<span class="text-xs text-ink-soft">No quiz yet</span>`
                  }
                </div>
                <p class="text-[11px] text-ink-muted mt-1">${Store.state.totalQuestionsCorrect}/${Store.state.totalQuestionsAnswered} items correct</p>
              </div>

              <div class="rounded-xl bg-paper p-4 border border-paper-subtle">
                <div class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Sets Completed</div>
                <div class="mt-1 flex items-baseline gap-1.5">
                  <span class="text-2xl sm:text-3xl font-bold text-ink">${quizDoneCount}</span>
                  <span class="text-xs font-medium text-ink-muted">/ ${totalSets} banks</span>
                </div>
                <p class="text-[11px] text-ink-muted mt-1">${Store.state.practicedCueCards.length} Cue Cards rehearsed</p>
              </div>

              <div class="rounded-xl bg-paper p-4 border border-paper-subtle">
                <div class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Lexical Vault</div>
                <div class="mt-1 flex items-baseline gap-1.5">
                  <span class="text-2xl sm:text-3xl font-bold text-amberband-600">${Store.state.savedIdioms.length}</span>
                  <span class="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">saved ${icon("bookmarkFilled", "w-3 h-3 text-amberband-600")}</span>
                </div>
                <p class="text-[11px] text-ink-muted mt-1">Out of ${idioms.length} high-band entries</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Daily Idiom Spotlight + Quick Module Launchers -->
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Daily Idiom Card -->
          <div class="lg:col-span-5 bg-white rounded-2xl border border-paper-subtle shadow-card p-6 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold uppercase tracking-wider text-oxford-600">Daily Idiom & Collocation Spotlight</span>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amberband-50 text-amberband-700 border border-amberband-100">Band ${esc(dailyIdiom.band_target)}</span>
              </div>
              <h2 class="font-serif text-2xl font-bold text-ink mt-3">“${esc(dailyIdiom.phrase)}”</h2>
              <div class="flex flex-wrap gap-2 mt-2">
                <span class="text-[11px] font-medium px-2 py-0.5 rounded bg-paper-warm text-ink-muted">${esc(dailyIdiom.topic)}</span>
                <span class="text-[11px] font-medium px-2 py-0.5 rounded bg-navyband-50 text-navyband-700">${esc(dailyIdiom.register)}</span>
              </div>
              <p class="text-sm text-ink mt-3 leading-relaxed">${esc(dailyIdiom.definition)}</p>
              <div class="mt-3 p-3 rounded-xl bg-paper border-l-4 border-oxford-600 text-xs text-ink-muted italic leading-relaxed">
                “${esc(dailyIdiom.example)}”
              </div>
              <div class="mt-3 p-3 rounded-xl bg-coralwarn-50 border border-coralwarn-100 text-xs text-coralwarn-700 leading-relaxed flex items-start gap-2">
                ${icon("alertTriangle", "w-4 h-4 mt-0.5 text-coralwarn-600")}
                <div><strong>Examiner Overuse Warning:</strong> ${esc(dailyIdiom.overuse_warning)}</div>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-paper-subtle">
              <button data-action="toggle-idiom" data-idiom-id="${dailyIdiom.id}" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                isSaved
                  ? "bg-amberband-50 border-amberband-500 text-amberband-700"
                  : "bg-white border-paper-subtle text-ink-muted hover:text-ink"
              }">
                ${isSaved ? icon("bookmarkFilled", "w-3.5 h-3.5") : icon("bookmark", "w-3.5 h-3.5")}
                <span>${isSaved ? "Bookmarked in Vault" : "Save to My Vault"}</span>
              </button>
              <div class="flex items-center gap-2">
                <button data-action="shuffle-daily-idiom" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-paper-warm hover:bg-paper-subtle text-ink transition">
                  ${icon("refresh", "w-3.5 h-3.5")}<span>Next Phrase</span>
                </button>
                <button data-action="go-route" data-target="vault" class="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-oxford-600 hover:underline">
                  <span>All ${idioms.length}</span>${icon("arrowRight", "w-3.5 h-3.5")}
                </button>
              </div>
            </div>
          </div>

          <!-- 4 Core Module Cards -->
          <div class="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button data-action="go-route" data-target="practice" class="text-left group bg-white hover:border-oxford-500 rounded-2xl border border-paper-subtle shadow-card p-5 transition flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <span class="w-10 h-10 rounded-xl bg-oxford-50 text-oxford-700 flex items-center justify-center text-lg font-bold">01</span>
                  <span class="text-xs font-semibold text-oxford-600 group-hover:translate-x-0.5 transition">Open Engine →</span>
                </div>
                <h3 class="font-serif text-lg font-bold text-ink mt-3">Interactive Quiz Engine</h3>
                <p class="text-xs text-ink-muted mt-1.5 leading-relaxed">
                  Listening audio dialogues, Reading True/False/Not Given passages, strict word-limit Gap-Fills, and Timed Mock Simulations with instant explanations.
                </p>
              </div>
              <div class="mt-4 pt-3 border-t border-paper-subtle flex items-center justify-between text-[11px] font-medium text-ink-soft">
                <span>6 Curated Sets • 29 Items</span>
                <span class="text-ink font-semibold">All 4 Skills</span>
              </div>
            </button>

            <button data-action="go-route" data-target="speaking" class="text-left group bg-white hover:border-oxford-500 rounded-2xl border border-paper-subtle shadow-card p-5 transition flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <span class="w-10 h-10 rounded-xl bg-amberband-50 text-amberband-700 flex items-center justify-center text-lg font-bold">02</span>
                  <span class="text-xs font-semibold text-oxford-600 group-hover:translate-x-0.5 transition">Start Speaking →</span>
                </div>
                <h3 class="font-serif text-lg font-bold text-ink mt-3">Speaking Simulator & Planner</h3>
                <p class="text-xs text-ink-muted mt-1.5 leading-relaxed">
                  Part 1 randomiser + voice recorder, Part 2 60-second countdown + 4-box digital scratchpad, and Part 3 Opinion→Reason→Example→Qualification builder.
                </p>
              </div>
              <div class="mt-4 pt-3 border-t border-paper-subtle flex items-center justify-between text-[11px] font-medium text-ink-soft">
                <span>Part 1 • Part 2 • Part 3</span>
                <span class="text-ink font-semibold">Live Timers + Mic</span>
              </div>
            </button>

            <button data-action="go-route" data-target="writing" class="text-left group bg-white hover:border-oxford-500 rounded-2xl border border-paper-subtle shadow-card p-5 transition flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <span class="w-10 h-10 rounded-xl bg-navyband-50 text-navyband-700 flex items-center justify-center text-lg font-bold">03</span>
                  <span class="text-xs font-semibold text-oxford-600 group-hover:translate-x-0.5 transition">Inspect Essays →</span>
                </div>
                <h3 class="font-serif text-lg font-bold text-ink mt-3">Writing Task 1 & 2 Sample Bank</h3>
                <p class="text-xs text-ink-muted mt-1.5 leading-relaxed">
                  Compare real VIP student scripts (Bands 7.0, 8.5 & 9.0) across Line, Bar, Pie, Table, Process, Map, Letters, and Task 2 Essays with Examiner Commentary toggles.
                </p>
              </div>
              <div class="mt-4 pt-3 border-t border-paper-subtle flex items-center justify-between text-[11px] font-medium text-ink-soft">
                <span>10 Tasks • SVG Visuals</span>
                <span class="text-ink font-semibold">Inline Highlights</span>
              </div>
            </button>

            <button data-action="go-route" data-target="vault" class="text-left group bg-white hover:border-oxford-500 rounded-2xl border border-paper-subtle shadow-card p-5 transition flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <span class="w-10 h-10 rounded-xl bg-coralwarn-50 text-coralwarn-600 flex items-center justify-center text-lg font-bold">04</span>
                  <span class="text-xs font-semibold text-oxford-600 group-hover:translate-x-0.5 transition">Explore Vault →</span>
                </div>
                <h3 class="font-serif text-lg font-bold text-ink mt-3">Idioms & Collocations Vault</h3>
                <p class="text-xs text-ink-muted mt-1.5 leading-relaxed">
                  Searchable lexical database filtered by topic, register, and band target—complete with natural examples, anti-cramming warnings, and Flashcard Drill mode.
                </p>
              </div>
              <div class="mt-4 pt-3 border-t border-paper-subtle flex items-center justify-between text-[11px] font-medium text-ink-soft">
                <span>24 Curated Entries</span>
                <span class="text-ink font-semibold">Flashcard Mode</span>
              </div>
            </button>
          </div>
        </section>

        <!-- Interactive 14-Day Study Schedule -->
        <section class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 sm:p-8">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-oxford-600">Structured Study Sprint</span>
              <h2 class="font-serif text-2xl font-bold text-ink mt-0.5">14-Day IELTS Mastery Roadmap</h2>
              <p class="text-xs sm:text-sm text-ink-muted mt-1">Tick off each milestone as you complete it—saved automatically in browser storage.</p>
            </div>
            <div class="sm:text-right">
              <div class="text-xs font-semibold text-ink">${roadmapDone} of ${roadmapTotal} milestones completed (${roadmapPct}%)</div>
              <div class="w-full sm:w-48 h-2 rounded-full bg-paper-warm overflow-hidden mt-1.5">
                <div class="h-full bg-oxford-600 transition-all duration-300" style="width:${roadmapPct}%"></div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            ${d.study_plan_14_days
              .map((item) => {
                const done = Store.state.completedDays.includes(item.id);
                return `
                  <label class="cursor-pointer rounded-xl p-3.5 border transition flex items-start gap-3 ${
                    done
                      ? "bg-oxford-50/70 border-oxford-200"
                      : "bg-paper hover:bg-paper-warm/70 border-paper-subtle"
                  }">
                    <input type="checkbox" data-action="toggle-study-day" data-day-id="${esc(item.id)}" ${
                      done ? "checked" : ""
                    } class="mt-1 h-4 w-4 rounded border-ink-soft text-oxford-600 focus:ring-oxford-500" />
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-[11px] font-bold uppercase tracking-wide text-oxford-700">${esc(item.day)}</span>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-white border border-paper-subtle text-ink-muted">${esc(
                          item.module
                        )}</span>
                      </div>
                      <div class="text-xs font-bold text-ink mt-1 ${done ? "line-through opacity-75" : ""}">${esc(
                        item.title
                      )}</div>
                      <p class="text-[11px] text-ink-muted mt-0.5 leading-relaxed">${esc(item.task)}</p>
                    </div>
                  </label>
                `;
              })
              .join("")}
          </div>
        </section>
      </div>
    `;
  }

  /* ============================================================================
     VIEW 2: MODULE 1 — INTERACTIVE QUIZ & PRACTICE ENGINE
     ============================================================================ */

  function startQuizById(quizId, timed = true) {
    stopAllTimersAndAudio();
    const found = AppState.data.quiz_sets.find((q) => q.id === quizId);
    if (!found) return;
    AppState.activeQuiz = found;
    AppState.quizTimedMode = timed;
    AppState.quizSecondsLeft = found.duration_seconds || 360;
    AppState.quizAnswers = {};
    AppState.quizCheckedSingle = {};
    AppState.quizSubmitted = false;
    AppState.quizFlagged = {};
    AppState.audioTranscriptOpen = false;
    if (timed) {
      startQuizCountdown();
    }
    renderMain();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function launchMockSimulation() {
    stopAllTimersAndAudio();
    // Assemble a curated 12-question 4-Skill Mock Test across Listening, Reading, Writing & Speaking
    const picked = [];
    AppState.data.quiz_sets.forEach((set) => {
      // Skip audio-dependent items only if needed? No, include context note or pick self-contained + reading snippet!
      if (set.module === "Reading" && set.id === "quiz_reading_tfng") {
        set.questions.slice(0, 3).forEach((q) =>
          picked.push(
            Object.assign({}, q, {
              section_badge: "Reading • T/F/NG",
              context_excerpt: set.passage_text.split("\n\n").slice(0, 2).join("\n\n")
            })
          )
        );
      } else if (set.id === "quiz_listening_s1") {
        set.questions.slice(0, 2).forEach((q) =>
          picked.push(
            Object.assign({}, q, {
              section_badge: "Listening • Section 1",
              context_excerpt:
                "Audio Excerpt — Receptionist: 'Peak evening access is £65 a month, whereas our Off-Peak Saver tier is £42... Pool lanes, sauna, and yoga classes are included free of charge, though racquet courts like badminton carry a £4 booking fee.'"
            })
          )
        );
      } else if (set.id === "quiz_writing_mastery") {
        set.questions.slice(0, 4).forEach((q) =>
          picked.push(Object.assign({}, q, { section_badge: "Writing • Task 1 & 2" }))
        );
      } else if (set.id === "quiz_speaking_fluency") {
        set.questions.slice(0, 3).forEach((q) =>
          picked.push(Object.assign({}, q, { section_badge: "Speaking • Parts 1–3" }))
        );
      }
    });

    AppState.activeQuiz = {
      id: "mock_4skill_sim",
      module: "Full Mock",
      title: "12-Minute 4-Skill IELTS Rapid Mock Simulation",
      subtitle: "Listening • Reading (T/F/NG) • Writing Accuracy • Speaking Register",
      duration_seconds: 720,
      difficulty: "Official Exam Conditions",
      questions: picked
    };
    AppState.quizTimedMode = true;
    AppState.quizSecondsLeft = 720;
    AppState.quizAnswers = {};
    AppState.quizCheckedSingle = {};
    AppState.quizSubmitted = false;
    AppState.quizFlagged = {};

    if (AppState.route !== "practice") {
      AppState.route = "practice";
      history.replaceState(null, "", "#practice");
      syncNavChrome();
    }
    startQuizCountdown();
    renderMain();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startQuizCountdown() {
    if (AppState.quizTimerId) clearInterval(AppState.quizTimerId);
    AppState.quizTimerId = setInterval(() => {
      if (AppState.quizSubmitted || !AppState.quizTimedMode) {
        clearInterval(AppState.quizTimerId);
        AppState.quizTimerId = null;
        return;
      }
      AppState.quizSecondsLeft = Math.max(0, AppState.quizSecondsLeft - 1);
      const timerBadge = document.getElementById("live-quiz-timer");
      if (timerBadge) {
        timerBadge.textContent = formatMMSS(AppState.quizSecondsLeft);
        if (AppState.quizSecondsLeft <= 60) {
          timerBadge.classList.add("text-coralwarn-600", "animate-pulse");
        }
      }
      if (AppState.quizSecondsLeft === 0) {
        clearInterval(AppState.quizTimerId);
        AppState.quizTimerId = null;
        submitActiveQuiz();
      }
    }, 1000);
  }

  function submitActiveQuiz() {
    if (!AppState.activeQuiz || AppState.quizSubmitted) return;
    AppState.quizSubmitted = true;
    if (AppState.quizTimerId) {
      clearInterval(AppState.quizTimerId);
      AppState.quizTimerId = null;
    }
    let correct = 0;
    const qs = AppState.activeQuiz.questions;
    qs.forEach((q) => {
      const res = evaluateQuestion(q, AppState.quizAnswers[q.id]);
      if (res.isCorrect) correct += 1;
    });
    Store.recordQuizSubmission(AppState.activeQuiz.id, correct, qs.length);
    syncNavChrome();
    renderMain();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function playListeningScript() {
    const qz = AppState.activeQuiz;
    if (!qz || !qz.audio_script) return;
    if (!("speechSynthesis" in window)) {
      AppState.audioTranscriptOpen = true;
      renderMain();
      return;
    }
    window.speechSynthesis.cancel();
    AppState.audioPlaying = true;
    AppState.audioLineIdx = 0;
    renderMain();

    const lines = qz.audio_script;
    const speakNext = (idx) => {
      if (!AppState.audioPlaying || idx >= lines.length) {
        AppState.audioPlaying = false;
        AppState.audioLineIdx = -1;
        renderMain();
        return;
      }
      AppState.audioLineIdx = idx;
      const lineHighlight = document.querySelectorAll("[data-script-line]");
      lineHighlight.forEach((el, i) => {
        el.classList.toggle("bg-oxford-50", i === idx);
        el.classList.toggle("border-oxford-500", i === idx);
      });

      const utter = new SpeechSynthesisUtterance(lines[idx].text);
      utter.lang = "en-GB";
      utter.rate = AppState.audioRate;
      utter.pitch = idx % 2 === 0 ? 1.05 : 0.92;
      utter.onend = () => speakNext(idx + 1);
      utter.onerror = () => {
        AppState.audioPlaying = false;
        renderMain();
      };
      window.speechSynthesis.speak(utter);
    };

    speakNext(0);
  }

  function renderPracticeHub() {
    if (AppState.activeQuiz) {
      return renderActiveQuizSession();
    }

    const modules = ["All", "Listening", "Reading", "Writing", "Speaking"];
    const sets = AppState.data.quiz_sets.filter(
      (s) => AppState.quizFilterModule === "All" || s.module === AppState.quizFilterModule
    );
    const mockAttempt = Store.state.quizAttempts["mock_4skill_sim"];

    return `
      <div class="view-animate space-y-6">
        <!-- Header & Timed Mock Banner -->
        <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div class="space-y-2 max-w-2xl">
            <span class="text-xs font-bold uppercase tracking-wider text-oxford-600">Module 1 • Interactive Practice Engine</span>
            <h1 class="font-serif text-2xl sm:text-3xl font-bold text-ink">Practice Banks & Timed Simulations</h1>
            <p class="text-sm text-ink-muted leading-relaxed">
              Every question mirrors real IELTS traps—strict word-count enforcement on Gap-Fills, False vs Not Given distinctions, and instant examiner breakdowns.
            </p>
          </div>
          <div class="bg-paper rounded-xl p-4 border border-paper-subtle shrink-0 space-y-2.5">
            <div class="flex items-center justify-between gap-4">
              <span class="inline-flex items-center gap-1.5 text-xs font-bold text-ink">${icon("zap", "w-3.5 h-3.5 text-amberband-600")}<span>4-Skill Rapid Mock Test</span></span>
              <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-oxford-50 text-oxford-700 font-semibold">12 Qs • 12:00</span>
            </div>
            ${
              mockAttempt
                ? `<div class="text-xs text-ink-muted">Best score: <strong class="text-oxford-600">${mockAttempt.bestScore}/${mockAttempt.total}</strong></div>`
                : `<div class="text-xs text-ink-muted">Simulates real exam clock across all 4 modules</div>`
            }
            <button data-action="launch-mock-sim" class="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-oxford-600 hover:bg-oxford-700 text-white text-xs font-semibold transition">
              <span>Launch Timed Mock Simulation</span>${icon("arrowRight", "w-3.5 h-3.5")}
            </button>
          </div>
        </div>

        <!-- Module Filter Tabs -->
        <div class="flex flex-wrap items-center gap-2">
          ${modules
            .map((m) => {
              const active = AppState.quizFilterModule === m;
              return `
                <button data-action="filter-quiz-module" data-module="${esc(m)}" class="px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                  active
                    ? "bg-ink text-white border-ink shadow-sm"
                    : "bg-white text-ink-muted hover:text-ink border-paper-subtle"
                }">
                  ${m === "All" ? "All Modules (" + AppState.data.quiz_sets.length + ")" : esc(m)}
                </button>
              `;
            })
            .join("")}
        </div>

        <!-- Quiz Bank Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${sets
            .map((s) => {
              const prev = Store.state.quizAttempts[s.id];
              const typesSet = new Set(
                s.questions.map((q) =>
                  q.type === "tfng"
                    ? "True / False / Not Given"
                    : q.type === "gap_fill"
                    ? "Word-Limit Gap-Fill"
                    : "Multiple Choice"
                )
              );
              return `
                <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="px-2.5 py-1 rounded-md text-xs font-bold bg-oxford-50 text-oxford-700">${esc(
                        s.module
                      )}</span>
                      <span class="inline-flex items-center gap-1 text-xs font-medium text-ink-soft">${esc(s.difficulty)} • ${icon("clock", "w-3.5 h-3.5")} ${Math.round(
                s.duration_seconds / 60
              )} min</span>
                    </div>
                    <h2 class="font-serif text-xl font-bold text-ink mt-3">${esc(s.title)}</h2>
                    <p class="text-xs text-ink-muted mt-1">${esc(s.subtitle)}</p>

                    <div class="flex flex-wrap gap-1.5 mt-3">
                      ${Array.from(typesSet)
                        .map(
                          (t) =>
                            `<span class="text-[11px] px-2 py-0.5 rounded bg-paper-warm text-ink-muted font-medium">${esc(
                              t
                            )}</span>`
                        )
                        .join("")}
                      <span class="text-[11px] px-2 py-0.5 rounded bg-paper text-ink font-semibold">${
                        s.questions.length
                      } Questions</span>
                    </div>
                  </div>

                  <div class="mt-5 pt-4 border-t border-paper-subtle flex flex-wrap items-center justify-between gap-3">
                    <div class="text-xs">
                      ${
                        prev
                          ? `<span class="inline-flex items-center gap-1 text-oxford-600 font-bold">${icon("checkCircle", "w-3.5 h-3.5")} Best: ${prev.bestScore}/${prev.total} (${Math.round(
                              (prev.bestScore / prev.total) * 100
                            )}%)</span>`
                          : `<span class="text-ink-soft">Not attempted yet</span>`
                      }
                    </div>
                    <div class="flex items-center gap-2">
                      <button data-action="start-quiz" data-quiz-id="${esc(
                        s.id
                      )}" data-timed="false" class="px-3 py-2 rounded-lg text-xs font-semibold bg-paper-warm hover:bg-paper-subtle text-ink transition">
                        Study Mode
                      </button>
                      <button data-action="start-quiz" data-quiz-id="${esc(
                        s.id
                      )}" data-timed="true" class="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-semibold bg-oxford-600 hover:bg-oxford-700 text-white transition">
                        <span>Timed Exam</span>${icon("arrowRight", "w-3.5 h-3.5")}
                      </button>
                    </div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderActiveQuizSession() {
    const qz = AppState.activeQuiz;
    const qs = qz.questions;

    let scoreSummaryHtml = "";
    if (AppState.quizSubmitted) {
      let correct = 0;
      qs.forEach((q) => {
        if (evaluateQuestion(q, AppState.quizAnswers[q.id]).isCorrect) correct += 1;
      });
      const ratio = correct / qs.length;
      const pct = Math.round(ratio * 100);
      const band = estimateBandFromRatio(ratio);

      scoreSummaryHtml = `
        <div class="bg-oxford-900 text-white rounded-2xl p-6 shadow-desk flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs uppercase tracking-wider text-oxford-200 font-semibold">Session Graded & Saved to LocalStorage</span>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold mt-1">You scored ${correct} / ${qs.length} (${pct}%) — Est. Band ${band}</h2>
            <p class="text-xs sm:text-sm text-oxford-100 mt-1">Review the detailed examiner explanations below to lock in every trap and word-limit rule.</p>
          </div>
          <div class="flex flex-wrap gap-2 shrink-0">
            <button data-action="retry-quiz" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-ink text-xs font-bold hover:bg-paper-warm transition">
              ${icon("refresh", "w-3.5 h-3.5")}<span>Retry Set</span>
            </button>
            <button data-action="exit-quiz" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-oxford-700 hover:bg-oxford-600 text-white text-xs font-semibold transition">
              ${icon("arrowLeft", "w-3.5 h-3.5")}<span>All Practice Sets</span>
            </button>
          </div>
        </div>
      `;
    }

    // Optional Audio Simulator Box for Listening Sets
    let audioBoxHtml = "";
    if (qz.audio_script) {
      audioBoxHtml = `
        <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-5 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-oxford-600">${icon("headphones", "w-4 h-4")}<span>Browser IELTS Audio Player</span></span>
              <p class="text-xs text-ink-muted mt-0.5">Listen once while answering below, or open the accessible transcript if studying silently.</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button data-action="audio-play-toggle" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold ${
                AppState.audioPlaying
                  ? "bg-coralwarn-600 text-white"
                  : "bg-oxford-600 hover:bg-oxford-700 text-white"
              } transition">
                ${AppState.audioPlaying ? `${icon("stop", "w-3.5 h-3.5")}<span>Stop Audio</span>` : `${icon("play", "w-3.5 h-3.5")}<span>Play Recording</span>`}
              </button>
              <select data-action="audio-rate" aria-label="Playback speed" class="px-2.5 py-2 rounded-lg text-xs font-semibold bg-paper border border-paper-subtle text-ink">
                <option value="0.9" ${AppState.audioRate === 0.9 ? "selected" : ""}>0.9x Calm</option>
                <option value="1" ${AppState.audioRate === 1 ? "selected" : ""}>1.0x Exam Pace</option>
                <option value="1.15" ${AppState.audioRate === 1.15 ? "selected" : ""}>1.15x Fast</option>
              </select>
              <button data-action="toggle-audio-script" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-paper-warm hover:bg-paper-subtle text-ink transition">
                ${icon("fileText", "w-3.5 h-3.5")}<span>${AppState.audioTranscriptOpen ? "Hide Script" : "Read Script"}</span>
              </button>
            </div>
          </div>

          ${
            AppState.audioTranscriptOpen
              ? `<div class="mt-3 pt-3 border-t border-paper-subtle space-y-2 max-h-60 overflow-y-auto pr-1">
                  ${qz.audio_script
                    .map(
                      (line, idx) => `
                      <div data-script-line="${idx}" class="p-2.5 rounded-lg border text-xs leading-relaxed ${
                        AppState.audioLineIdx === idx
                          ? "bg-oxford-50 border-oxford-500"
                          : "bg-paper border-paper-subtle"
                      }">
                        <strong class="text-ink">${esc(line.speaker)}:</strong> <span class="text-ink-muted">${esc(
                        line.text
                      )}</span>
                      </div>`
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>
      `;
    }

    const hasReadingPassage = Boolean(qz.passage_text);

    const questionsHtml = qs
      .map((q, idx) => {
        const userVal = AppState.quizAnswers[q.id];
        const showFeedback = AppState.quizSubmitted || Boolean(AppState.quizCheckedSingle[q.id]);
        const evalRes = evaluateQuestion(q, userVal);

        let inputArea = "";
        if (q.type === "mcq" || q.type === "tfng") {
          const isTfng = q.type === "tfng";
          inputArea = `
            <div class="${isTfng ? "flex flex-wrap gap-2.5" : "space-y-2"} mt-3">
              ${q.options
                .map((opt, optIdx) => {
                  const selected = userVal !== undefined && userVal !== "" && Number(userVal) === optIdx;
                  let stateCls = "bg-paper hover:bg-paper-warm border-paper-subtle text-ink";
                  if (selected && !showFeedback) {
                    stateCls = "bg-oxford-50 border-oxford-600 text-oxford-900 font-semibold";
                  } else if (showFeedback) {
                    if (optIdx === q.correct_index) {
                      stateCls = "bg-oxford-50 border-oxford-600 text-oxford-800 font-semibold";
                    } else if (selected && optIdx !== q.correct_index) {
                      stateCls = "bg-coralwarn-50 border-coralwarn-500 text-coralwarn-700 line-through";
                    } else {
                      stateCls = "bg-paper/60 border-paper-subtle text-ink-soft";
                    }
                  }
                  return `
                    <label class="cursor-pointer ${
                      isTfng ? "px-4 py-2" : "flex items-start gap-3 p-3"
                    } rounded-xl border text-xs sm:text-sm transition ${stateCls}">
                      <input type="radio" name="q_${esc(q.id)}" data-action="quiz-option" data-qid="${esc(
                    q.id
                  )}" value="${optIdx}" ${selected ? "checked" : ""} ${
                    AppState.quizSubmitted ? "disabled" : ""
                  } class="mt-0.5 text-oxford-600 focus:ring-oxford-500 ${isTfng ? "mr-1.5" : ""}" />
                      <span>${esc(opt)}</span>
                    </label>
                  `;
                })
                .join("")}
            </div>
          `;
        } else if (q.type === "gap_fill") {
          const wc = countIeltsWords(userVal || "");
          const overLimit = q.word_limit && wc > q.word_limit;
          inputArea = `
            <div class="mt-3 space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded bg-amberband-50 border border-amberband-100 text-[11px] font-bold text-amberband-700 tracking-wide">
                  WORD LIMIT: ${esc(q.word_limit_label || `MAX ${q.word_limit} WORDS`)}
                </span>
                <span data-wordcount-for="${esc(q.id)}" class="inline-flex items-center gap-1 text-xs font-mono font-semibold ${
            overLimit ? "text-coralwarn-600" : "text-ink-muted"
          }">
                  ${wc} / ${q.word_limit} word${q.word_limit === 1 ? "" : "s"}${
            overLimit ? ` ${icon("alertTriangle", "w-3.5 h-3.5")} Over limit!` : ""
          }
                </span>
              </div>
              <input
                type="text"
                autocomplete="off"
                placeholder="Type your answer carefully..."
                value="${esc(userVal || "")}"
                data-action="quiz-gap-input"
                data-qid="${esc(q.id)}"
                data-limit="${q.word_limit || 3}"
                ${AppState.quizSubmitted ? "disabled" : ""}
                class="w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 ${
                  overLimit
                    ? "border-coralwarn-500 bg-coralwarn-50/40 focus:ring-coralwarn-500"
                    : "border-paper-subtle bg-paper focus:bg-white focus:ring-oxford-500"
                }"
              />
            </div>
          `;
        }

        const contextSnippet = q.context_excerpt
          ? `<div class="mb-3 p-3 rounded-xl bg-paper-warm/70 border border-paper-subtle text-xs text-ink-muted leading-relaxed whitespace-pre-line">${esc(
              q.context_excerpt
            )}</div>`
          : "";

        let feedbackHtml = "";
        if (showFeedback) {
          const acceptedText =
            q.type === "gap_fill"
              ? q.accepted_answers.join(" / ")
              : q.options[q.correct_index];
          feedbackHtml = `
            <div class="mt-4 p-3.5 rounded-xl border text-xs leading-relaxed ${
              evalRes.isCorrect
                ? "bg-oxford-50 border-oxford-200 text-oxford-900"
                : "bg-coralwarn-50 border-coralwarn-100 text-ink"
            }">
              <div class="flex flex-wrap items-center justify-between gap-2 font-bold mb-1">
                <span class="inline-flex items-center gap-1.5 ${evalRes.isCorrect ? "text-oxford-700" : "text-coralwarn-700"}">
                  ${evalRes.isCorrect ? `${icon("checkCircle", "w-4 h-4")}<span>Correct!</span>` : `${icon("xCircle", "w-4 h-4")}<span>Incorrect (${esc(evalRes.reason)})</span>`}
                </span>
                <span class="font-mono text-ink bg-white px-2 py-0.5 rounded border border-paper-subtle">
                  Answer: ${esc(acceptedText)}
                </span>
              </div>
              <p class="text-ink-muted mt-1"><strong class="text-ink">Why:</strong> ${esc(q.explanation)}</p>
            </div>
          `;
        }

        return `
          <article class="bg-white rounded-2xl border border-paper-subtle shadow-card p-5">
            <div class="flex items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center">
                  ${idx + 1}
                </span>
                ${
                  q.section_badge
                    ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-paper-warm text-ink-muted">${esc(
                        q.section_badge
                      )}</span>`
                    : ""
                }
              </div>
              ${
                !AppState.quizSubmitted
                  ? `<button data-action="check-single-q" data-qid="${esc(
                      q.id
                    )}" class="inline-flex items-center gap-1 text-xs font-semibold text-oxford-600 hover:underline">
                      ${AppState.quizCheckedSingle[q.id] ? `${icon("check", "w-3.5 h-3.5")}<span>Checked</span>` : "Instant Check"}
                    </button>`
                  : ""
              }
            </div>
            ${contextSnippet}
            <h3 class="text-sm sm:text-base font-semibold text-ink leading-snug">${esc(q.prompt)}</h3>
            ${inputArea}
            ${feedbackHtml}
          </article>
        `;
      })
      .join("");

    return `
      <div class="view-animate space-y-5">
        <!-- Top Sticky Quiz Bar -->
        <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <button data-action="exit-quiz" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-paper-warm hover:bg-paper-subtle text-xs font-semibold text-ink transition">
              ${icon("arrowLeft", "w-3.5 h-3.5")}<span>Back</span>
            </button>
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-oxford-600">${esc(qz.module)}</div>
              <h1 class="font-serif text-lg sm:text-xl font-bold text-ink">${esc(qz.title)}</h1>
            </div>
          </div>

          <div class="flex items-center gap-3">
            ${
              AppState.quizTimedMode
                ? `<div class="px-3.5 py-1.5 rounded-xl bg-paper border border-paper-subtle flex items-center gap-2">
                    <span class="inline-flex items-center gap-1 text-xs text-ink-muted font-medium">${icon("clock", "w-3.5 h-3.5")}<span>Time Left:</span></span>
                    <span id="live-quiz-timer" class="font-mono text-sm font-bold text-ink">${formatMMSS(
                      AppState.quizSecondsLeft
                    )}</span>
                  </div>`
                : `<span class="px-3 py-1.5 rounded-xl bg-paper text-xs font-semibold text-ink-muted">Untimed Study Mode</span>`
            }
            ${
              !AppState.quizSubmitted
                ? `<button data-action="submit-quiz" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-oxford-600 hover:bg-oxford-700 text-white text-xs sm:text-sm font-bold shadow-sm transition">
                    <span>Submit & Grade</span>${icon("arrowRight", "w-3.5 h-3.5")}
                  </button>`
                : ""
            }
          </div>
        </div>

        ${scoreSummaryHtml}
        ${audioBoxHtml}

        ${
          hasReadingPassage
            ? `<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div class="lg:col-span-6 lg:sticky lg:top-20 bg-white rounded-2xl border border-paper-subtle shadow-card p-6 max-h-[78vh] overflow-y-auto">
                  <span class="text-xs font-bold uppercase tracking-wider text-oxford-600">Academic Reading Passage</span>
                  <h2 class="font-serif text-xl font-bold text-ink mt-1 mb-3">${esc(qz.passage_title)}</h2>
                  <div class="space-y-3 text-sm text-ink leading-relaxed">
                    ${qz.passage_text
                      .split("\n\n")
                      .map(
                        (para, pIdx) =>
                          `<p><strong class="text-oxford-700 font-mono text-xs mr-1">[${String.fromCharCode(
                            65 + pIdx
                          )}]</strong> ${esc(para)}</p>`
                      )
                      .join("")}
                  </div>
                </div>
                <div class="lg:col-span-6 space-y-4">
                  ${questionsHtml}
                  ${
                    !AppState.quizSubmitted
                      ? `<button data-action="submit-quiz" class="w-full py-3 rounded-xl bg-oxford-600 hover:bg-oxford-700 text-white text-sm font-bold shadow-sm transition">
                          Submit All Answers & View Score
                        </button>`
                      : ""
                  }
                </div>
              </div>`
            : `<div class="max-w-3xl mx-auto space-y-4">
                ${questionsHtml}
                ${
                  !AppState.quizSubmitted
                    ? `<button data-action="submit-quiz" class="w-full py-3 rounded-xl bg-oxford-600 hover:bg-oxford-700 text-white text-sm font-bold shadow-sm transition">
                        Submit All Answers & View Score
                      </button>`
                    : ""
                }
              </div>`
        }
      </div>
    `;
  }

  /* ============================================================================
     VIEW 3: MODULE 2 — SPEAKING SIMULATOR & CUE CARD GENERATOR
     ============================================================================ */

  function toggleCueTimer() {
    if (AppState.cueTimerRunning) {
      clearInterval(AppState.cueTimerId);
      AppState.cueTimerId = null;
      AppState.cueTimerRunning = false;
      renderMain();
      return;
    }

    if (AppState.cueSecondsLeft <= 0) {
      AppState.cueSecondsLeft = AppState.cueTimerPhase === "prep" ? 60 : 120;
    }
    AppState.cueTimerRunning = true;
    renderMain();

    AppState.cueTimerId = setInterval(() => {
      AppState.cueSecondsLeft = Math.max(0, AppState.cueSecondsLeft - 1);
      const disp = document.getElementById("cue-timer-display");
      const bar = document.getElementById("cue-timer-bar");
      const total = AppState.cueTimerPhase === "prep" ? 60 : 120;
      if (disp) disp.textContent = formatMMSS(AppState.cueSecondsLeft);
      if (bar) bar.style.width = `${(AppState.cueSecondsLeft / total) * 100}%`;

      if (AppState.cueSecondsLeft === 0) {
        clearInterval(AppState.cueTimerId);
        AppState.cueTimerId = null;
        AppState.cueTimerRunning = false;
        // Automatically transition from 60s prep to ready-to-speak 2:00 long turn!
        if (AppState.cueTimerPhase === "prep") {
          AppState.cueTimerPhase = "speak";
          AppState.cueSecondsLeft = 120;
        }
        renderMain();
      }
    }, 1000);
  }

  async function toggleVoiceRecorder() {
    if (AppState.recState === "recording" && AppState.mediaRecorder) {
      AppState.mediaRecorder.stop();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      AppState.recState = "error";
      AppState.recErrorMsg = "Microphone recording is not supported in this browser environment.";
      renderMain();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      AppState.recChunks = [];
      const mr = new MediaRecorder(stream);
      AppState.mediaRecorder = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) AppState.recChunks.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(AppState.recChunks, { type: "audio/webm" });
        if (AppState.recAudioUrl) URL.revokeObjectURL(AppState.recAudioUrl);
        AppState.recAudioUrl = URL.createObjectURL(blob);
        AppState.recState = "ready";
        renderMain();
      };
      mr.start();
      AppState.recState = "recording";
      renderMain();
    } catch (err) {
      AppState.recState = "error";
      AppState.recErrorMsg =
        "Microphone permission wasn't granted—no problem! Practise speaking out loud with the live timer above.";
      renderMain();
    }
  }

  function renderRecorderWidget() {
    return `
      <div class="rounded-xl bg-paper p-3.5 border border-paper-subtle flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="inline-flex items-center gap-1.5 text-xs font-bold text-ink">${icon("mic", "w-4 h-4 text-oxford-600")}<span>Self-Review Voice Recorder (100% Local Memory)</span></div>
          <div class="text-[11px] text-ink-muted">Follow the ebook's 4-step loop: Answer → Record → Listen → Improve.</div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button data-action="voice-rec-toggle" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
            AppState.recState === "recording"
              ? "bg-coralwarn-600 text-white animate-pulse"
              : "bg-ink text-white hover:bg-ink-muted"
          }">
            ${AppState.recState === "recording" ? `${icon("stop", "w-3.5 h-3.5")}<span>Stop Recording</span>` : `${icon("recordDot", "w-3.5 h-3.5 text-coralwarn-500")}<span>Record My Answer</span>`}
          </button>
          ${
            AppState.recState === "ready" && AppState.recAudioUrl
              ? `<audio controls src="${AppState.recAudioUrl}" class="h-8 max-w-[210px]"></audio>`
              : ""
          }
        </div>
        ${
          AppState.recState === "error"
            ? `<p class="w-full text-[11px] text-amberband-700 bg-amberband-50 px-2.5 py-1.5 rounded">${esc(
                AppState.recErrorMsg
              )}</p>`
            : ""
        }
      </div>
    `;
  }

  function renderSpeakingLab() {
    const tabs = [
      { id: "part1", label: "Part 1: Short Interview" },
      { id: "part2", label: "Part 2: 60s Cue Card Planner" },
      { id: "part3", label: "Part 3: OREQ Discussion Framework" }
    ];

    let subViewHtml = "";
    if (AppState.speakingTab === "part1") {
      subViewHtml = renderSpeakingPart1();
    } else if (AppState.speakingTab === "part2") {
      subViewHtml = renderSpeakingPart2();
    } else {
      subViewHtml = renderSpeakingPart3();
    }

    return `
      <div class="view-animate space-y-6">
        <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-oxford-600">Module 2 • Speaking Lab</span>
            <h1 class="font-serif text-2xl sm:text-3xl font-bold text-ink mt-0.5">Speaking Simulator & Cue Card Studio</h1>
            <p class="text-sm text-ink-muted mt-1">Practise spontaneous speaking, plan 4-box Cue Cards in 60 seconds, and build analytical Part 3 responses.</p>
          </div>
          <div class="inline-flex flex-wrap gap-1.5 bg-paper p-1.5 rounded-xl border border-paper-subtle">
            ${tabs
              .map((t) => {
                const active = AppState.speakingTab === t.id;
                return `
                  <button data-action="switch-speaking-tab" data-tab="${t.id}" class="px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                    active ? "bg-ink text-white shadow-sm" : "text-ink-muted hover:text-ink"
                  }">
                    ${esc(t.label)}
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>

        ${subViewHtml}
      </div>
    `;
  }

  function renderSpeakingPart1() {
    const allP1 = AppState.data.speaking_part1;
    const cats = ["All", ...Array.from(new Set(allP1.map((q) => q.category)))];
    const filtered = allP1.filter(
      (q) => AppState.part1Category === "All" || q.category === AppState.part1Category
    );
    const current = filtered[AppState.activePart1Idx % filtered.length] || allP1[0];

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Topic Selector -->
        <div class="lg:col-span-4 bg-white rounded-2xl border border-paper-subtle shadow-card p-5 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider text-ink-soft">Interview Topics</h2>
            <button data-action="random-part1" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-oxford-600 hover:bg-oxford-700 text-white text-xs font-semibold transition">
              ${icon("shuffle", "w-3.5 h-3.5")}<span>Random Prompt</span>
            </button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            ${cats
              .map((c) => {
                const active = AppState.part1Category === c;
                return `
                  <button data-action="set-part1-cat" data-cat="${esc(c)}" class="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                    active
                      ? "bg-oxford-50 border-oxford-600 text-oxford-800 font-semibold"
                      : "bg-paper border-paper-subtle text-ink-muted hover:text-ink"
                  }">
                    ${esc(c)}
                  </button>
                `;
              })
              .join("")}
          </div>

          <div class="pt-3 border-t border-paper-subtle space-y-1.5 max-h-64 overflow-y-auto">
            ${filtered
              .map((item, i) => {
                const isSel = item.id === current.id;
                return `
                  <button data-action="select-part1-idx" data-idx="${i}" class="w-full text-left p-2.5 rounded-xl text-xs transition border ${
                    isSel
                      ? "bg-ink text-white border-ink font-semibold"
                      : "bg-paper hover:bg-paper-warm border-paper-subtle text-ink"
                  }">
                    ${esc(item.question)}
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>

        <!-- Active Part 1 Prompt & Expandable Model -->
        <div class="lg:col-span-8 bg-white rounded-2xl border border-paper-subtle shadow-card p-6 sm:p-8 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-amberband-50 text-amberband-700 border border-amberband-100">
              ${esc(current.category)}
            </span>
            <span class="text-xs text-ink-muted font-medium">Target length: 2–3 natural sentences (15–25s)</span>
          </div>

          <div class="p-6 rounded-2xl bg-paper border border-paper-subtle">
            <div class="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">Examiner Prompt</div>
            <h3 class="font-serif text-2xl sm:text-3xl font-bold text-ink">“${esc(current.question)}”</h3>
            <p class="text-xs text-ink-muted mt-3">Formula: <strong>Direct Answer</strong> + <strong>Brief Reason</strong> + <strong>One Specific Personal Detail</strong>.</p>
          </div>

          ${renderRecorderWidget()}

          <!-- Expandable Model Answer -->
          <div class="border border-paper-subtle rounded-2xl overflow-hidden">
            <button data-action="toggle-part1-model" class="w-full px-5 py-3.5 bg-paper-warm hover:bg-paper-subtle/80 flex items-center justify-between text-left transition">
              <span class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-ink">
                ${AppState.part1ModelOpen ? `${icon("chevronDown", "w-4 h-4")}<span>Hide Band 8.5 Natural Model Answer</span>` : `${icon("chevronRight", "w-4 h-4")}<span>Reveal Band 8.5 Model Answer & Phrasing</span>`}
              </span>
              <span class="text-xs font-semibold text-oxford-600">Try answering aloud first!</span>
            </button>
            ${
              AppState.part1ModelOpen
                ? `<div class="p-5 bg-white space-y-4">
                    <p class="text-sm sm:text-base text-ink leading-relaxed">“${esc(current.model_answer)}”</p>
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-xs font-bold text-ink-soft uppercase">Natural Chunks:</span>
                      ${current.key_phrases
                        .map(
                          (kp) =>
                            `<span class="px-2.5 py-1 rounded-md bg-oxford-50 text-oxford-700 text-xs font-semibold border border-oxford-200">${esc(
                              kp
                            )}</span>`
                        )
                        .join("")}
                    </div>
                    <div class="p-3 rounded-xl bg-amberband-50 border border-amberband-100 text-xs text-amberband-700 flex items-start gap-2">
                      ${icon("lightbulb", "w-4 h-4 mt-0.5 text-amberband-600")}
                      <div><strong>Personalise It:</strong> ${esc(current.personalise_tip)}</div>
                    </div>
                  </div>`
                : ""
            }
          </div>

          <!-- 4-Criterion Quick Self-Check -->
          <div class="pt-2">
            <div class="text-xs font-bold uppercase tracking-wider text-ink-soft mb-2">4-Criterion Self-Check</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label class="flex items-center gap-2 p-2.5 rounded-lg bg-paper border border-paper-subtle cursor-pointer">
                <input type="checkbox" class="rounded text-oxford-600" />
                <span><strong>Fluency:</strong> Answered directly without long pauses</span>
              </label>
              <label class="flex items-center gap-2 p-2.5 rounded-lg bg-paper border border-paper-subtle cursor-pointer">
                <input type="checkbox" class="rounded text-oxford-600" />
                <span><strong>Lexis:</strong> Used natural everyday collocations</span>
              </label>
              <label class="flex items-center gap-2 p-2.5 rounded-lg bg-paper border border-paper-subtle cursor-pointer">
                <input type="checkbox" class="rounded text-oxford-600" />
                <span><strong>Grammar:</strong> Connected clauses (e.g. although / whereas)</span>
              </label>
              <label class="flex items-center gap-2 p-2.5 rounded-lg bg-paper border border-paper-subtle cursor-pointer">
                <input type="checkbox" class="rounded text-oxford-600" />
                <span><strong>Pronunciation:</strong> Stressed key content words clearly</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSpeakingPart2() {
    const cards = AppState.data.speaking_cue_cards;
    const card = cards[AppState.activeCueIdx % cards.length];
    const scratch = Store.getScratchpad(card.id);
    const isPracticed = Store.state.practicedCueCards.includes(card.id);
    const totalSec = AppState.cueTimerPhase === "prep" ? 60 : 120;
    const pct = Math.round((AppState.cueSecondsLeft / totalSec) * 100);

    return `
      <div class="space-y-6">
        <!-- Cue Card Picker Bar -->
        <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <label for="cue-card-select" class="text-xs font-bold uppercase tracking-wider text-ink-soft">Select Cue Card:</label>
            <select id="cue-card-select" data-action="select-cue-card" class="px-3 py-2 rounded-xl bg-paper border border-paper-subtle text-xs sm:text-sm font-semibold text-ink">
              ${cards
                .map(
                  (c, idx) =>
                    `<option value="${idx}" ${idx === AppState.activeCueIdx ? "selected" : ""}>#${c.id}: ${esc(
                      c.topic
                    )}${Store.state.practicedCueCards.includes(c.id) ? " (Practiced)" : ""}</option>`
                )
                .join("")}
            </select>
          </div>
          <div class="flex items-center gap-2">
            <button data-action="random-cue-card" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-oxford-600 hover:bg-oxford-700 text-white text-xs font-semibold transition">
              ${icon("shuffle", "w-3.5 h-3.5")}<span>Draw Random Cue Card</span>
            </button>
            <button data-action="toggle-cue-practiced" data-card-id="${card.id}" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition ${
              isPracticed
                ? "bg-oxford-50 border-oxford-500 text-oxford-700"
                : "bg-white border-paper-subtle text-ink-muted hover:text-ink"
            }">
              ${isPracticed ? `${icon("checkCircle", "w-3.5 h-3.5")}<span>Marked Practiced</span>` : "Mark Practiced"}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left: Official Cue Card + 60s/120s Timer -->
          <div class="lg:col-span-5 space-y-5">
            <div class="bg-white rounded-2xl border-2 border-ink/85 shadow-desk p-6 space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-ink text-white">IELTS Part 2 Task Card</span>
                <span class="text-xs font-medium text-ink-muted">${esc(card.category)}</span>
              </div>
              <h2 class="font-serif text-xl sm:text-2xl font-bold text-ink leading-snug">${esc(card.topic)}</h2>
              <div class="text-xs font-semibold text-ink-muted uppercase tracking-wide">You should say:</div>
              <ul class="space-y-2 text-sm text-ink pl-1">
                ${card.bullet_points
                  .map(
                    (bp, i) => `
                    <li class="flex items-start gap-2.5">
                      <span class="w-5 h-5 rounded-full bg-paper-warm text-ink text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">${
                        i + 1
                      }</span>
                      <span>${i === card.bullet_points.length - 1 ? "and explain " : ""}${esc(bp)}</span>
                    </li>`
                  )
                  .join("")}
              </ul>
            </div>

            <!-- Dual-Phase Countdown Timer -->
            <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-5 space-y-4">
              <div class="flex items-center justify-between gap-2">
                <div class="inline-flex rounded-lg bg-paper p-1 border border-paper-subtle">
                  <button data-action="set-cue-phase" data-phase="prep" class="px-3 py-1 rounded-md text-xs font-bold transition ${
                    AppState.cueTimerPhase === "prep" ? "bg-amberband-500 text-white" : "text-ink-muted"
                  }">
                    1. Prep (01:00)
                  </button>
                  <button data-action="set-cue-phase" data-phase="speak" class="px-3 py-1 rounded-md text-xs font-bold transition ${
                    AppState.cueTimerPhase === "speak" ? "bg-oxford-600 text-white" : "text-ink-muted"
                  }">
                    2. Speak (02:00)
                  </button>
                </div>
                <span class="text-xs font-medium text-ink-soft">
                  ${AppState.cueTimerPhase === "prep" ? "Keywords only!" : "Keep speaking smoothly"}
                </span>
              </div>

              <div class="text-center py-2">
                <div id="cue-timer-display" class="font-mono text-4xl sm:text-5xl font-bold tracking-tight text-ink">
                  ${formatMMSS(AppState.cueSecondsLeft)}
                </div>
                <div class="w-full h-2.5 rounded-full bg-paper-warm overflow-hidden mt-3">
                  <div id="cue-timer-bar" class="h-full transition-all duration-300 ${
                    AppState.cueTimerPhase === "prep" ? "bg-amberband-500" : "bg-oxford-600"
                  }" style="width:${pct}%"></div>
                </div>
              </div>

              <div class="flex items-center justify-center gap-2.5">
                <button data-action="cue-timer-toggle" class="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white transition ${
                  AppState.cueTimerRunning ? "bg-coralwarn-600" : "bg-oxford-600 hover:bg-oxford-700"
                }">
                  ${AppState.cueTimerRunning ? `${icon("pause", "w-3.5 h-3.5")}<span>Pause Timer</span>` : `${icon("play", "w-3.5 h-3.5")}<span>Start ${AppState.cueTimerPhase === "prep" ? "60s Prep" : "2m Turn"}</span>`}
                </button>
                <button data-action="cue-timer-reset" class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-paper-warm hover:bg-paper-subtle text-ink text-xs font-semibold transition">
                  ${icon("rotateCcw", "w-3.5 h-3.5")}<span>Reset</span>
                </button>
              </div>
            </div>

            ${renderRecorderWidget()}
          </div>

          <!-- Right: 4-Box Digital Scratchpad + Model Long Turn -->
          <div class="lg:col-span-7 space-y-5">
            <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span class="text-xs font-bold uppercase tracking-wider text-amberband-600">One-Minute 4-Box Method</span>
                  <h3 class="font-serif text-xl font-bold text-ink">Digital Keyword Scratchpad</h3>
                </div>
                <button data-action="clear-scratchpad" data-card-id="${card.id}" class="text-xs font-medium text-ink-soft hover:text-coralwarn-600">
                  Clear Notes
                </button>
              </div>
              <p class="text-xs text-ink-muted">Write short bullet keywords—never full sentences! Your notes auto-save per Cue Card in browser storage.</p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div class="rounded-xl bg-paper p-3.5 border border-paper-subtle">
                  <label class="block text-xs font-bold text-ink mb-1.5">1. Who or What</label>
                  <textarea rows="3" data-action="scratch-input" data-card-id="${card.id}" data-field="who" placeholder="e.g. former uni classmate Timur • calm, organised..." class="w-full bg-white rounded-lg border border-paper-subtle p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-oxford-500">${esc(
                    scratch.who
                  )}</textarea>
                </div>

                <div class="rounded-xl bg-paper p-3.5 border border-paper-subtle">
                  <label class="block text-xs font-bold text-ink mb-1.5">2. When & Where</label>
                  <textarea rows="3" data-action="scratch-input" data-card-id="${card.id}" data-field="when" placeholder="e.g. final-semester finals week • campus library..." class="w-full bg-white rounded-lg border border-paper-subtle p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-oxford-500">${esc(
                    scratch.when
                  )}</textarea>
                </div>

                <div class="rounded-xl bg-paper p-3.5 border border-paper-subtle">
                  <label class="block text-xs font-bold text-ink mb-1.5">3. Specific Actions / Details</label>
                  <textarea rows="3" data-action="scratch-input" data-card-id="${card.id}" data-field="details" placeholder="e.g. broke research into 4 stages • checked in 2 days later..." class="w-full bg-white rounded-lg border border-paper-subtle p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-oxford-500">${esc(
                    scratch.details
                  )}</textarea>
                </div>

                <div class="rounded-xl bg-paper p-3.5 border border-paper-subtle">
                  <label class="block text-xs font-bold text-ink mb-1.5">4. Feelings & Why It Mattered</label>
                  <textarea rows="3" data-action="scratch-input" data-card-id="${card.id}" data-field="why" placeholder="e.g. relieved • didn't make me feel incapable • still use method..." class="w-full bg-white rounded-lg border border-paper-subtle p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-oxford-500">${esc(
                    scratch.why
                  )}</textarea>
                </div>
              </div>
            </div>

            <!-- Expandable Model Long Turn + Linked Part 3 -->
            <div class="bg-white rounded-2xl border border-paper-subtle shadow-card overflow-hidden">
              <button data-action="toggle-cue-model" class="w-full px-6 py-4 bg-paper-warm hover:bg-paper-subtle/80 flex items-center justify-between text-left transition">
                <div>
                  <div class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-ink">
                    ${AppState.cueModelOpen ? `${icon("chevronDown", "w-4 h-4")}<span>Hide Band 8.5 Model Long Turn</span>` : `${icon("chevronRight", "w-4 h-4")}<span>Compare with Band 8.5 Model Long Turn</span>`}
                  </div>
                  <div class="text-xs text-ink-muted mt-0.5 italic">Preview: “${esc(card.model_snippet)}”</div>
                </div>
                <span class="text-xs font-semibold text-oxford-600 shrink-0 ml-2">${
                  AppState.cueModelOpen ? "Collapse" : "Expand"
                }</span>
              </button>

              ${
                AppState.cueModelOpen
                  ? `<div class="p-6 space-y-4">
                      <p class="text-sm text-ink leading-relaxed">${esc(card.full_model_answer)}</p>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs font-bold uppercase text-ink-soft">Adaptable Chunks:</span>
                        ${(card.lexical_highlights || [])
                          .map(
                            (lh) =>
                              `<span class="px-2.5 py-1 rounded-md bg-oxford-50 text-oxford-700 text-xs font-semibold border border-oxford-200">${esc(
                                lh
                              )}</span>`
                          )
                          .join("")}
                      </div>
                      <div class="p-4 rounded-xl bg-paper border border-paper-subtle space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-bold uppercase tracking-wider text-navyband-700">Connected Part 3 Follow-Up Questions</span>
                          <button data-action="switch-speaking-tab" data-tab="part3" class="text-xs font-semibold text-oxford-600 hover:underline">
                            Practise OREQ Framework →
                          </button>
                        </div>
                        <ul class="list-disc pl-5 text-xs sm:text-sm text-ink-muted space-y-1">
                          ${(card.part3_questions || []).map((q3) => `<li>${esc(q3)}</li>`).join("")}
                        </ul>
                      </div>
                    </div>`
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSpeakingPart3() {
    const fws = AppState.data.speaking_part3_frameworks;
    const fw = fws[AppState.activePart3Idx % fws.length];
    const draft = Store.getPart3Draft(fw.id);
    const assembled = [draft.opinion, draft.reason, draft.example, draft.qualification]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");

    return `
      <div class="space-y-6">
        <!-- Theme Selector -->
        <div class="flex flex-wrap gap-2">
          ${fws
            .map((item, idx) => {
              const active = idx === AppState.activePart3Idx;
              return `
                <button data-action="select-part3-idx" data-idx="${idx}" class="px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                  active
                    ? "bg-ink text-white border-ink"
                    : "bg-white text-ink-muted hover:text-ink border-paper-subtle"
                }">
                  ${esc(item.theme)}
                </button>
              `;
            })
            .join("")}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Guided OREQ Builder -->
          <div class="lg:col-span-7 bg-white rounded-2xl border border-paper-subtle shadow-card p-6 space-y-4">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-navyband-600">Abstract Analytical Discussion</span>
              <h2 class="font-serif text-xl sm:text-2xl font-bold text-ink mt-1">“${esc(fw.question)}”</h2>
              <p class="text-xs text-ink-muted mt-1">Avoid personal stories here! Build a society-wide Band 8+ response using the 4-step OREQ structure:</p>
            </div>

            <div class="space-y-3">
              ${[
                {
                  key: "opinion",
                  badge: "O • Opinion",
                  hint: "State a clear, hedged position directly (e.g. 'On balance, I'd argue that...')",
                  color: "border-oxford-600"
                },
                {
                  key: "reason",
                  badge: "R • Reason",
                  hint: "Explain the underlying systemic or psychological mechanism ('...primarily because...')",
                  color: "border-navyband-600"
                },
                {
                  key: "example",
                  badge: "E • Example",
                  hint: "Give a wider societal comparison or concrete scenario ('For instance, in many cities...')",
                  color: "border-amberband-500"
                },
                {
                  key: "qualification",
                  badge: "Q • Qualification",
                  hint: "Add a smart Band 8.5 nuance or condition ('That said, this only works if...')",
                  color: "border-coralwarn-500"
                }
              ]
                .map(
                  (step) => `
                  <div class="rounded-xl bg-paper p-3.5 border-l-4 ${step.color} border border-paper-subtle">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs font-bold text-ink">${step.badge}</span>
                      <button data-action="fill-oreq-starter" data-fw-id="${fw.id}" data-step="${
                    step.key
                  }" class="text-[11px] font-semibold text-oxford-600 hover:underline">
                        + Insert Band 8.5 Idea
                      </button>
                    </div>
                    <p class="text-[11px] text-ink-soft mb-1.5">${step.hint}</p>
                    <textarea rows="2" data-action="part3-input" data-fw-id="${fw.id}" data-step="${
                    step.key
                  }" placeholder="Type or speak your ${step.key}..." class="w-full rounded-lg bg-white border border-paper-subtle p-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-oxford-500">${esc(
                    draft[step.key]
                  )}</textarea>
                  </div>`
                )
                .join("")}
            </div>
          </div>

          <!-- Right: Live Assembled Preview & Model Comparison -->
          <div class="lg:col-span-5 space-y-5">
            <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-oxford-600">Your Assembled Spoken Turn</span>
                <span id="part3-assembled-wc" class="text-xs font-mono text-ink-muted">${countIeltsWords(assembled)} words</span>
              </div>
              <div data-part3-preview class="p-4 rounded-xl bg-paper border border-paper-subtle text-sm text-ink leading-relaxed min-h-[100px]">
                ${
                  assembled
                    ? esc(assembled)
                    : `<span class="text-ink-soft italic text-xs">Fill in the 4 OREQ steps on the left (or click '+ Insert Band 8.5 Idea') to assemble a complete analytical response...</span>`
                }
              </div>
            </div>

            <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 space-y-3">
              <span class="text-xs font-bold uppercase tracking-wider text-amberband-600">Examiner Model Breakdown</span>
              <div class="space-y-2 text-xs sm:text-sm leading-relaxed text-ink">
                <p><strong class="text-oxford-700">[Opinion]</strong> ${esc(fw.starters.opinion)}</p>
                <p><strong class="text-navyband-700">[Reason]</strong> ${esc(fw.starters.reason)}</p>
                <p><strong class="text-amberband-700">[Example]</strong> ${esc(fw.starters.example)}</p>
                <p><strong class="text-coralwarn-700">[Qualification]</strong> ${esc(fw.starters.qualification)}</p>
              </div>
              <div class="p-3 rounded-xl bg-oxford-50 border border-oxford-200 text-xs text-oxford-800">
                <strong>Why It Scores 8.5+:</strong> ${esc(fw.examiner_note)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================================
     VIEW 4: MODULE 3 — WRITING TASK 1 & TASK 2 SAMPLE BANK
     ============================================================================ */

  function renderWritingBank() {
    const samples = AppState.data.writing_samples;
    const filterTypes = ["All", "Task 1 Academic", "Task 1 General", "Task 2 Essay"];
    const filtered = samples.filter(
      (s) => AppState.writingTaskFilter === "All" || s.task_type === AppState.writingTaskFilter
    );
    const activeSample =
      filtered.find((s) => s.id === AppState.activeWritingId) || filtered[0] || samples[0];
    if (activeSample.id !== AppState.activeWritingId) {
      AppState.activeWritingId = activeSample.id;
      AppState.activeVersionIdx = 0;
    }
    const version = activeSample.versions[AppState.activeVersionIdx] || activeSample.versions[0];
    const paragraphsHtml = version.essay_annotated
      .split(/\n\n+/)
      .map((p) => `<p>${p}</p>`)
      .join("");

    const userDraft = Store.getWritingDraft(activeSample.id);
    const draftWords = countIeltsWords(userDraft);
    const minWords = activeSample.task_type.includes("Task 2") ? 250 : 150;

    return `
      <div class="view-animate space-y-6">
        <!-- Header + Filter Pills -->
        <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-oxford-600">Module 3 • Writing Sample Bank</span>
            <h1 class="font-serif text-2xl sm:text-3xl font-bold text-ink mt-0.5">VIP Student Samples & Examiner Commentary</h1>
            <p class="text-sm text-ink-muted mt-1">
              Compare authentic Band 7.0, 8.5, and 9.0 responses across Bar, Line, Pie, Table, Process, Map, Letters, and Task 2 Essays.
            </p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            ${filterTypes
              .map((ft) => {
                const active = AppState.writingTaskFilter === ft;
                return `
                  <button data-action="filter-writing-type" data-wtype="${esc(ft)}" class="px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-paper hover:bg-paper-warm text-ink-muted border-paper-subtle"
                  }">
                    ${esc(ft)}
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>

        <!-- Sample Selector Strip -->
        <div class="flex gap-2.5 overflow-x-auto pb-1">
          ${filtered
            .map((s) => {
              const sel = s.id === activeSample.id;
              return `
                <button data-action="select-writing-sample" data-sid="${esc(
                  s.id
                )}" class="shrink-0 text-left px-4 py-3 rounded-xl border transition min-w-[210px] max-w-[260px] ${
                  sel
                    ? "bg-ink text-white border-ink shadow-sm"
                    : "bg-white hover:bg-paper-warm text-ink border-paper-subtle"
                }">
                  <div class="text-[10px] font-bold uppercase tracking-wider ${
                    sel ? "text-oxford-200" : "text-oxford-600"
                  }">${esc(s.visual_type)}</div>
                  <div class="text-xs font-bold truncate mt-0.5">${esc(s.title)}</div>
                </button>
              `;
            })
            .join("")}
        </div>

        <!-- Main Split Workspace: Left Visual + Scorecard | Right Annotated Essay + Draft Pad -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left Column -->
          <div class="lg:col-span-5 space-y-5">
            <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-5 space-y-4">
              <div class="flex items-center justify-between">
                <span class="px-2.5 py-0.5 rounded-md text-xs font-bold bg-navyband-50 text-navyband-700">${esc(
                  activeSample.task_type
                )} • ${esc(activeSample.visual_type)}</span>
                <span class="text-xs font-medium text-ink-soft">Min ${minWords} words</span>
              </div>
              <h2 class="font-serif text-lg font-bold text-ink">${esc(activeSample.title)}</h2>
              <div class="p-3.5 rounded-xl bg-paper border border-paper-subtle text-xs text-ink leading-relaxed">
                ${esc(activeSample.prompt)}
              </div>
              ${Charts.render(activeSample.chart_spec)}
            </div>

            <!-- 4-Criterion Examiner Scorecard -->
            <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-5 space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-ink-soft">Examiner Breakdown</span>
                <span class="px-2.5 py-1 rounded-lg bg-oxford-600 text-white text-xs font-bold">Overall Band ${esc(
                  version.band
                )}</span>
              </div>

              <div class="grid grid-cols-4 gap-2 text-center">
                <div class="p-2.5 rounded-xl bg-paper border border-paper-subtle">
                  <div class="text-[10px] font-bold text-ink-soft uppercase">${
                    activeSample.task_type.includes("Task 2") ? "TR" : "TA"
                  }</div>
                  <div class="text-base font-bold text-ink mt-0.5">${esc(version.scores.ta)}</div>
                </div>
                <div class="p-2.5 rounded-xl bg-paper border border-paper-subtle">
                  <div class="text-[10px] font-bold text-ink-soft uppercase">CC</div>
                  <div class="text-base font-bold text-ink mt-0.5">${esc(version.scores.cc)}</div>
                </div>
                <div class="p-2.5 rounded-xl bg-paper border border-paper-subtle">
                  <div class="text-[10px] font-bold text-ink-soft uppercase">LR</div>
                  <div class="text-base font-bold text-ink mt-0.5">${esc(version.scores.lr)}</div>
                </div>
                <div class="p-2.5 rounded-xl bg-paper border border-paper-subtle">
                  <div class="text-[10px] font-bold text-ink-soft uppercase">GRA</div>
                  <div class="text-base font-bold text-ink mt-0.5">${esc(version.scores.gra)}</div>
                </div>
              </div>

              <ul class="space-y-2 text-xs text-ink-muted leading-relaxed">
                ${version.examiner_notes
                  .map(
                    (note) => `
                    <li class="flex items-start gap-2">
                      ${icon("check", "w-3.5 h-3.5 text-oxford-600 mt-0.5")}
                      <span>${esc(note)}</span>
                    </li>`
                  )
                  .join("")}
              </ul>
            </div>
          </div>

          <!-- Right Column: Essay + Commentary Toggle + Live Practice Pad -->
          <div class="lg:col-span-7 space-y-5">
            <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 sm:p-8 space-y-5">
              <!-- Band Version Switcher & Commentary Toggle -->
              <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-paper-subtle">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-ink-soft uppercase">Sample Band:</span>
                  ${activeSample.versions
                    .map((v, vIdx) => {
                      const active = vIdx === AppState.activeVersionIdx;
                      const isBand9 = parseFloat(v.band) >= 8.5;
                      return `
                        <button data-action="select-writing-version" data-vidx="${vIdx}" class="px-3.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                          active
                            ? isBand9
                              ? "bg-oxford-600 text-white border-oxford-600"
                              : "bg-amberband-500 text-white border-amberband-500"
                            : "bg-paper text-ink-muted hover:text-ink border-paper-subtle"
                        }">
                          Band ${esc(v.band)} (${v.word_count}w)
                        </button>
                      `;
                    })
                    .join("")}
                </div>

                <!-- Examiner Commentary Switch -->
                <button data-action="toggle-commentary" role="switch" aria-checked="${
                  AppState.commentaryOn
                }" class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                  AppState.commentaryOn
                    ? "bg-oxford-50 border-oxford-600 text-oxford-800"
                    : "bg-paper border-paper-subtle text-ink-muted"
                }">
                  <span class="w-2.5 h-2.5 rounded-full ${
                    AppState.commentaryOn ? "bg-oxford-600" : "bg-ink-faint"
                  }"></span>
                  Examiner Commentary: ${AppState.commentaryOn ? "ON" : "OFF"}
                </button>
              </div>

              ${
                AppState.commentaryOn
                  ? `<div class="space-y-2">
                      <div class="flex flex-wrap gap-3 text-[11px] font-semibold">
                        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-[#E2F2EC] border-b-2 border-[#0F6E56]"></span>Structure & Overview</span>
                        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-[#FCEFD9] border-b-2 border-[#D4841C]"></span>High-Band Lexis & Data</span>
                        <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-[#FADBD6] border-b-2 border-[#C94532]"></span>Band-7 Error / Caution</span>
                      </div>
                      <div id="inline-note-banner" class="p-3 rounded-xl bg-paper border border-paper-subtle text-xs text-ink font-medium flex items-center gap-2">
                        ${icon("search", "w-3.5 h-3.5 text-oxford-600")}<span>${esc(AppState.selectedInlineNote)}</span>
                      </div>
                    </div>`
                  : ""
              }

              <!-- Annotated Essay Body -->
              <div id="essay-prose-container" class="essay-prose font-serif text-base sm:text-[17px] text-ink ${
                AppState.commentaryOn ? "commentary-active" : ""
              }">
                ${paragraphsHtml}
              </div>
            </div>

            <!-- Interactive Self-Practice Writing Pad -->
            <div class="bg-white rounded-2xl border border-paper-subtle shadow-card overflow-hidden">
              <button data-action="toggle-practice-pad" class="w-full px-6 py-4 bg-paper-warm hover:bg-paper-subtle/70 flex items-center justify-between text-left transition">
                <div>
                  <div class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-ink">
                    ${icon("penLine", "w-4 h-4 text-oxford-600")}<span>Write Your Own Response to This Prompt (Auto-Saved)</span>
                  </div>
                  <div class="text-xs text-ink-muted">Practise applying the structure without copying phrases—live IELTS word counter included.</div>
                </div>
                <span class="inline-flex items-center gap-1 text-xs font-semibold text-oxford-600">${
                  AppState.practicePadOpen ? `<span>Collapse</span>${icon("chevronUp", "w-3.5 h-3.5")}` : `<span>Open Pad</span>${icon("chevronDown", "w-3.5 h-3.5")}`
                }</span>
              </button>
              ${
                AppState.practicePadOpen
                  ? `<div class="p-6 space-y-3">
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-semibold text-ink-muted">Target: at least ${minWords} words</span>
                        <span id="writing-draft-wc" class="inline-flex items-center gap-1 font-mono font-bold ${
                          draftWords >= minWords ? "text-oxford-600" : "text-amberband-600"
                        }">
                          ${draftWords} / ${minWords} words ${draftWords >= minWords ? `${icon("checkCircle", "w-3.5 h-3.5")} Target met!` : ""}
                        </span>
                      </div>
                      <textarea rows="8" data-action="writing-draft-input" data-sid="${esc(
                        activeSample.id
                      )}" data-min="${minWords}" placeholder="Draft your own introduction, overview, and body paragraphs here..." class="w-full rounded-xl bg-paper border border-paper-subtle p-4 text-sm text-ink leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-oxford-500">${esc(
                      userDraft
                    )}</textarea>
                    </div>`
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ============================================================================
     VIEW 5: MODULE 4 — IDIOMS, COLLOCATIONS & LEXICAL VAULT
     ============================================================================ */

  function getFilteredIdioms() {
    const q = AppState.vaultQuery.trim().toLowerCase();
    return AppState.data.idioms_vault.filter((item) => {
      if (AppState.vaultSavedOnly && !Store.isIdiomSaved(item.id)) return false;
      if (AppState.vaultTopic !== "All" && item.topic !== AppState.vaultTopic) return false;
      if (AppState.vaultBand !== "All" && item.band_target !== AppState.vaultBand) return false;
      if (q) {
        const hay = `${item.phrase} ${item.topic} ${item.definition} ${item.example}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderLexicalVault() {
    const all = AppState.data.idioms_vault;
    const topics = ["All", ...Array.from(new Set(all.map((i) => i.topic)))];
    const bands = ["All", "7.0+", "7.5+", "8.0+", "8.5+"];
    const filtered = getFilteredIdioms();

    let mainContent = "";
    if (AppState.vaultFlashcardMode && filtered.length > 0) {
      const card = filtered[AppState.flashcardIdx % filtered.length];
      const saved = Store.isIdiomSaved(card.id);
      mainContent = `
        <div class="max-w-2xl mx-auto space-y-4">
          <div class="flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>Active Recall Drill • Card ${(AppState.flashcardIdx % filtered.length) + 1} of ${filtered.length}</span>
            <span>Click card to flip</span>
          </div>

          <div data-action="flip-flashcard" class="cursor-pointer bg-white rounded-2xl border-2 border-paper-subtle hover:border-oxford-500 shadow-desk p-8 sm:p-10 min-h-[290px] flex flex-col justify-between transition">
            ${
              !AppState.flashcardFlipped
                ? `<div class="space-y-4 text-center my-auto">
                    <span class="px-3 py-1 rounded-full text-xs font-bold bg-paper-warm text-ink-muted">${esc(
                      card.topic
                    )} • Band ${esc(card.band_target)}</span>
                    <div class="text-xs font-bold uppercase tracking-widest text-oxford-600 pt-2">Guess the Idiom / Collocation from Meaning:</div>
                    <h2 class="font-serif text-xl sm:text-2xl font-bold text-ink leading-relaxed">“${esc(
                      card.definition
                    )}”</h2>
                    <p class="text-xs text-ink-soft pt-4">Tap anywhere on this card to reveal the exact phrase & natural usage →</p>
                  </div>`
                : `<div class="space-y-4 my-auto">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold uppercase tracking-wider text-oxford-600">${esc(
                        card.type || "Idiom"
                      )} • ${esc(card.register || "Speaking")}</span>
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amberband-50 text-amberband-700">Band ${esc(
                        card.band_target
                      )}</span>
                    </div>
                    <h2 class="font-serif text-2xl sm:text-3xl font-bold text-ink">“${esc(card.phrase)}”</h2>
                    <div class="p-3.5 rounded-xl bg-paper border-l-4 border-oxford-600 text-xs sm:text-sm italic text-ink">
                      “${esc(card.example)}”
                    </div>
                    <div class="p-3 rounded-xl bg-coralwarn-50 border border-coralwarn-100 text-xs text-coralwarn-700 flex items-start gap-2">
                      ${icon("alertTriangle", "w-4 h-4 mt-0.5 text-coralwarn-600")}
                      <div><strong>Don't Overuse:</strong> ${esc(card.overuse_warning)}</div>
                    </div>
                  </div>`
            }
          </div>

          <div class="flex items-center justify-between gap-3">
            <button data-action="prev-flashcard" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-paper-subtle text-xs font-semibold text-ink hover:bg-paper-warm">
              ${icon("arrowLeft", "w-3.5 h-3.5")}<span>Previous</span>
            </button>
            <button data-action="toggle-idiom" data-idiom-id="${card.id}" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-semibold ${
              saved
                ? "bg-amberband-50 border-amberband-500 text-amberband-700"
                : "bg-white border-paper-subtle text-ink-muted"
            }">
              ${saved ? `${icon("bookmarkFilled", "w-3.5 h-3.5")}<span>Saved in Vault</span>` : `${icon("bookmark", "w-3.5 h-3.5")}<span>Bookmark Phrase</span>`}
            </button>
            <button data-action="next-flashcard" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-oxford-600 hover:bg-oxford-700 text-white text-xs font-semibold">
              <span>Next Card</span>${icon("arrowRight", "w-3.5 h-3.5")}
            </button>
          </div>
        </div>
      `;
    } else if (filtered.length === 0) {
      mainContent = `
        <div class="bg-white rounded-2xl border border-paper-subtle p-10 text-center space-y-3">
          <div class="w-11 h-11 rounded-2xl bg-paper mx-auto flex items-center justify-center text-ink-muted">${icon("search", "w-5 h-5")}</div>
          <h3 class="font-serif text-lg font-bold text-ink">No lexical entries match your current filter</h3>
          <p class="text-xs text-ink-muted">Try clearing your search query or switching back to 'All Topics'.</p>
          <button data-action="reset-vault-filters" class="px-4 py-2 rounded-xl bg-oxford-600 text-white text-xs font-semibold">
            Reset All Filters
          </button>
        </div>
      `;
    } else {
      mainContent = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${filtered
            .map((item) => {
              const saved = Store.isIdiomSaved(item.id);
              return `
                <article class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 flex flex-col justify-between">
                  <div>
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-paper-warm text-ink">${esc(
                          item.topic
                        )}</span>
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-navyband-50 text-navyband-700">${esc(
                          item.register || "Speaking"
                        )}</span>
                        <span class="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amberband-50 text-amberband-700">Band ${esc(
                          item.band_target
                        )}</span>
                      </div>
                      <button data-action="toggle-idiom" data-idiom-id="${
                        item.id
                      }" aria-label="Bookmark phrase" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition ${
                saved
                  ? "bg-amberband-50 border-amberband-500 text-amberband-700"
                  : "bg-paper hover:bg-paper-warm border-paper-subtle text-ink-soft"
              }">
                        ${saved ? `${icon("bookmarkFilled", "w-3.5 h-3.5")}<span>Saved</span>` : `${icon("bookmark", "w-3.5 h-3.5")}<span>Save</span>`}
                      </button>
                    </div>

                    <h2 class="font-serif text-xl font-bold text-ink mt-3">“${esc(item.phrase)}”</h2>
                    <p class="text-sm text-ink mt-1.5 leading-relaxed">${esc(item.definition)}</p>

                    <div class="mt-3 p-3 rounded-xl bg-paper border-l-4 border-oxford-600 text-xs text-ink-muted italic leading-relaxed">
                      <strong class="not-italic text-ink">Natural Context:</strong> “${esc(item.example)}”
                    </div>
                  </div>

                  <div class="mt-3 p-3 rounded-xl bg-coralwarn-50/80 border border-coralwarn-100 text-xs text-coralwarn-700 leading-relaxed flex items-start gap-2">
                    ${icon("alertTriangle", "w-4 h-4 mt-0.5 text-coralwarn-600")}
                    <div><strong>How NOT to Overuse:</strong> ${esc(item.overuse_warning)}</div>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      `;
    }

    return `
      <div class="view-animate space-y-6">
        <!-- Vault Header -->
        <div class="bg-white rounded-2xl border border-paper-subtle shadow-card p-6 sm:p-8 space-y-5">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-oxford-600">Module 4 • Lexical Resource Vault</span>
              <h1 class="font-serif text-2xl sm:text-3xl font-bold text-ink mt-0.5">Idioms, Collocations & Register Guide</h1>
              <p class="text-sm text-ink-muted mt-1">
                High-band speakers don't cram obscure proverbs—they use natural collocations accurately in the right register.
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button data-action="toggle-vault-saved" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${
                AppState.vaultSavedOnly
                  ? "bg-amberband-50 border-amberband-500 text-amberband-700"
                  : "bg-paper border-paper-subtle text-ink-muted hover:text-ink"
              }">
                ${icon("bookmarkFilled", "w-3.5 h-3.5")}<span>Saved (${Store.state.savedIdioms.length})</span>
              </button>
              <button data-action="toggle-flashcard-mode" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
                AppState.vaultFlashcardMode
                  ? "bg-ink text-white"
                  : "bg-oxford-600 hover:bg-oxford-700 text-white"
              }">
                ${AppState.vaultFlashcardMode ? `${icon("grid", "w-3.5 h-3.5")}<span>Grid View</span>` : `${icon("layers", "w-3.5 h-3.5")}<span>Flashcard Drill</span>`}
              </button>
            </div>
          </div>

          <!-- Search + Band Filter -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div class="md:col-span-8">
              <input
                id="vault-search-input"
                type="search"
                placeholder="Search idioms, collocations, meanings, or topics (e.g. 'double-edged', 'balance', 'environment')..."
                value="${esc(AppState.vaultQuery)}"
                class="w-full px-4 py-2.5 rounded-xl bg-paper border border-paper-subtle text-sm text-ink focus:bg-white focus:outline-none focus:ring-2 focus:ring-oxford-500"
              />
            </div>
            <div class="md:col-span-4 flex items-center gap-2">
              <label for="vault-band-select" class="text-xs font-bold text-ink-soft shrink-0">Band:</label>
              <select id="vault-band-select" data-action="vault-band-change" class="w-full px-3 py-2.5 rounded-xl bg-paper border border-paper-subtle text-xs font-semibold text-ink">
                ${bands
                  .map(
                    (b) =>
                      `<option value="${b}" ${AppState.vaultBand === b ? "selected" : ""}>${
                        b === "All" ? "All Band Targets" : "Band " + b
                      }</option>`
                  )
                  .join("")}
              </select>
            </div>
          </div>

          <!-- Topic Pills -->
          <div class="flex flex-wrap gap-1.5">
            ${topics
              .map((t) => {
                const active = AppState.vaultTopic === t;
                return `
                  <button data-action="set-vault-topic" data-topic="${esc(t)}" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-paper hover:bg-paper-warm text-ink-muted border-paper-subtle"
                  }">
                    ${esc(t)}
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>

        ${mainContent}
      </div>
    `;
  }

  /* --------------------------- Main Render Dispatcher --------------------------- */

  function renderMain() {
    const root = document.getElementById("app-main");
    if (!root || !AppState.data) return;

    if (AppState.route === "dashboard") {
      root.innerHTML = renderDashboard();
    } else if (AppState.route === "practice") {
      root.innerHTML = renderPracticeHub();
    } else if (AppState.route === "speaking") {
      root.innerHTML = renderSpeakingLab();
    } else if (AppState.route === "writing") {
      root.innerHTML = renderWritingBank();
      bindEssayHighlightTooltips();
    } else if (AppState.route === "vault") {
      const activeId = document.activeElement && document.activeElement.id;
      const selStart = activeId === "vault-search-input" ? document.activeElement.selectionStart : null;
      root.innerHTML = renderLexicalVault();
      if (activeId === "vault-search-input") {
        const inp = document.getElementById("vault-search-input");
        if (inp) {
          inp.focus();
          if (selStart !== null) inp.setSelectionRange(selStart, selStart);
        }
      }
    }
  }

  function bindEssayHighlightTooltips() {
    if (!AppState.commentaryOn) return;
    const container = document.getElementById("essay-prose-container");
    const banner = document.getElementById("inline-note-banner");
    if (!container || !banner) return;

    container.querySelectorAll(".hl-struct, .hl-lex, .hl-warn").forEach((span) => {
      const note = span.getAttribute("title") || "";
      const updateBanner = () => {
        const kind = span.classList.contains("hl-warn")
          ? `${icon("alertTriangle", "w-3.5 h-3.5 text-coralwarn-600")} <strong>Examiner Caution:</strong>`
          : span.classList.contains("hl-lex")
          ? `${icon("sparkles", "w-3.5 h-3.5 text-amberband-600")} <strong>High-Band Lexis:</strong>`
          : `${icon("layout", "w-3.5 h-3.5 text-oxford-600")} <strong>Structural Strength:</strong>`;
        banner.innerHTML = `<span class="inline-flex items-center gap-1.5 flex-wrap">${kind} <span>${esc(note)}</span> <span class="text-ink-soft ml-1">(“${esc(
          span.textContent.slice(0, 58)
        )}${span.textContent.length > 58 ? "…" : ""}”)</span></span>`;
      };
      span.addEventListener("mouseenter", updateBanner);
      span.addEventListener("click", updateBanner);
    });
  }

  /* --------------------------- Delegated Event Listeners --------------------------- */

  function attachGlobalListeners() {
    // Top / Mobile Navigation
    document.addEventListener("click", (e) => {
      const navBtn = e.target.closest("[data-nav-route]");
      if (navBtn) {
        e.preventDefault();
        const target = navBtn.getAttribute("data-nav-route");
        if (target === "practice") {
          AppState.activeQuiz = null;
        }
        navigate(target);
        return;
      }

      const actEl = e.target.closest("[data-action]");
      if (!actEl) return;
      const action = actEl.getAttribute("data-action");

      switch (action) {
        case "go-route": {
          const target = actEl.getAttribute("data-target");
          if (target === "practice") AppState.activeQuiz = null;
          navigate(target);
          break;
        }

        case "shuffle-daily-idiom": {
          AppState.dailyIdiomIndex = (AppState.dailyIdiomIndex + 1) % AppState.data.idioms_vault.length;
          renderMain();
          break;
        }

        case "toggle-idiom": {
          e.stopPropagation();
          const id = actEl.getAttribute("data-idiom-id");
          Store.toggleIdiom(id);
          syncNavChrome();
          renderMain();
          break;
        }

        case "toggle-study-day": {
          const dayId = actEl.getAttribute("data-day-id");
          Store.toggleStudyDay(dayId);
          syncNavChrome();
          renderMain();
          break;
        }

        case "launch-mock-sim": {
          launchMockSimulation();
          break;
        }

        case "filter-quiz-module": {
          AppState.quizFilterModule = actEl.getAttribute("data-module");
          renderMain();
          break;
        }

        case "start-quiz": {
          const qid = actEl.getAttribute("data-quiz-id");
          const timed = actEl.getAttribute("data-timed") === "true";
          startQuizById(qid, timed);
          break;
        }

        case "exit-quiz": {
          stopAllTimersAndAudio();
          AppState.activeQuiz = null;
          renderMain();
          break;
        }

        case "retry-quiz": {
          if (AppState.activeQuiz.id === "mock_4skill_sim") {
            launchMockSimulation();
          } else {
            startQuizById(AppState.activeQuiz.id, AppState.quizTimedMode);
          }
          break;
        }

        case "check-single-q": {
          const qid = actEl.getAttribute("data-qid");
          AppState.quizCheckedSingle[qid] = true;
          renderMain();
          break;
        }

        case "submit-quiz": {
          submitActiveQuiz();
          break;
        }

        case "audio-play-toggle": {
          if (AppState.audioPlaying) {
            if ("speechSynthesis" in window) window.speechSynthesis.cancel();
            AppState.audioPlaying = false;
            AppState.audioLineIdx = -1;
            renderMain();
          } else {
            playListeningScript();
          }
          break;
        }

        case "toggle-audio-script": {
          AppState.audioTranscriptOpen = !AppState.audioTranscriptOpen;
          renderMain();
          break;
        }

        /* Speaking Module Actions */
        case "switch-speaking-tab": {
          stopAllTimersAndAudio();
          AppState.speakingTab = actEl.getAttribute("data-tab");
          renderMain();
          break;
        }

        case "set-part1-cat": {
          AppState.part1Category = actEl.getAttribute("data-cat");
          AppState.activePart1Idx = 0;
          AppState.part1ModelOpen = false;
          renderMain();
          break;
        }

        case "select-part1-idx": {
          AppState.activePart1Idx = Number(actEl.getAttribute("data-idx"));
          AppState.part1ModelOpen = false;
          renderMain();
          break;
        }

        case "random-part1": {
          AppState.part1Category = "All";
          AppState.activePart1Idx = Math.floor(Math.random() * AppState.data.speaking_part1.length);
          AppState.part1ModelOpen = false;
          renderMain();
          break;
        }

        case "toggle-part1-model": {
          AppState.part1ModelOpen = !AppState.part1ModelOpen;
          renderMain();
          break;
        }

        case "random-cue-card": {
          stopAllTimersAndAudio();
          const next = (AppState.activeCueIdx + 1 + Math.floor(Math.random() * (AppState.data.speaking_cue_cards.length - 1))) %
            AppState.data.speaking_cue_cards.length;
          AppState.activeCueIdx = next;
          AppState.cueTimerPhase = "prep";
          AppState.cueSecondsLeft = 60;
          AppState.cueModelOpen = false;
          renderMain();
          break;
        }

        case "toggle-cue-practiced": {
          const cid = actEl.getAttribute("data-card-id");
          Store.toggleCueCardPracticed(cid);
          renderMain();
          break;
        }

        case "set-cue-phase": {
          if (AppState.cueTimerId) {
            clearInterval(AppState.cueTimerId);
            AppState.cueTimerId = null;
          }
          AppState.cueTimerRunning = false;
          AppState.cueTimerPhase = actEl.getAttribute("data-phase");
          AppState.cueSecondsLeft = AppState.cueTimerPhase === "prep" ? 60 : 120;
          renderMain();
          break;
        }

        case "cue-timer-toggle": {
          toggleCueTimer();
          break;
        }

        case "cue-timer-reset": {
          if (AppState.cueTimerId) {
            clearInterval(AppState.cueTimerId);
            AppState.cueTimerId = null;
          }
          AppState.cueTimerRunning = false;
          AppState.cueSecondsLeft = AppState.cueTimerPhase === "prep" ? 60 : 120;
          renderMain();
          break;
        }

        case "clear-scratchpad": {
          const cid = actEl.getAttribute("data-card-id");
          Store.saveScratchpad(cid, { who: "", when: "", details: "", why: "" });
          renderMain();
          break;
        }

        case "toggle-cue-model": {
          AppState.cueModelOpen = !AppState.cueModelOpen;
          renderMain();
          break;
        }

        case "voice-rec-toggle": {
          toggleVoiceRecorder();
          break;
        }

        case "select-part3-idx": {
          AppState.activePart3Idx = Number(actEl.getAttribute("data-idx"));
          renderMain();
          break;
        }

        case "fill-oreq-starter": {
          const fwId = actEl.getAttribute("data-fw-id");
          const step = actEl.getAttribute("data-step");
          const fw = AppState.data.speaking_part3_frameworks.find((f) => f.id === fwId);
          if (fw && fw.starters[step]) {
            Store.savePart3Draft(fwId, { [step]: fw.starters[step] });
            renderMain();
          }
          break;
        }

        /* Writing Module Actions */
        case "filter-writing-type": {
          AppState.writingTaskFilter = actEl.getAttribute("data-wtype");
          AppState.activeVersionIdx = 0;
          renderMain();
          break;
        }

        case "select-writing-sample": {
          AppState.activeWritingId = actEl.getAttribute("data-sid");
          AppState.activeVersionIdx = 0;
          AppState.selectedInlineNote =
            "Click or hover any highlighted phrase in the essay below to inspect why the examiner rewarded—or penalised—it.";
          renderMain();
          break;
        }

        case "select-writing-version": {
          AppState.activeVersionIdx = Number(actEl.getAttribute("data-vidx"));
          renderMain();
          break;
        }

        case "toggle-commentary": {
          AppState.commentaryOn = !AppState.commentaryOn;
          renderMain();
          break;
        }

        case "toggle-practice-pad": {
          AppState.practicePadOpen = !AppState.practicePadOpen;
          renderMain();
          break;
        }

        /* Lexical Vault Actions */
        case "set-vault-topic": {
          AppState.vaultTopic = actEl.getAttribute("data-topic");
          AppState.flashcardIdx = 0;
          AppState.flashcardFlipped = false;
          renderMain();
          break;
        }

        case "toggle-vault-saved": {
          AppState.vaultSavedOnly = !AppState.vaultSavedOnly;
          AppState.flashcardIdx = 0;
          AppState.flashcardFlipped = false;
          renderMain();
          break;
        }

        case "toggle-flashcard-mode": {
          AppState.vaultFlashcardMode = !AppState.vaultFlashcardMode;
          AppState.flashcardIdx = 0;
          AppState.flashcardFlipped = false;
          renderMain();
          break;
        }

        case "flip-flashcard": {
          AppState.flashcardFlipped = !AppState.flashcardFlipped;
          renderMain();
          break;
        }

        case "next-flashcard": {
          AppState.flashcardIdx += 1;
          AppState.flashcardFlipped = false;
          renderMain();
          break;
        }

        case "prev-flashcard": {
          const len = Math.max(1, getFilteredIdioms().length);
          AppState.flashcardIdx = (AppState.flashcardIdx - 1 + len) % len;
          AppState.flashcardFlipped = false;
          renderMain();
          break;
        }

        case "reset-vault-filters": {
          AppState.vaultQuery = "";
          AppState.vaultTopic = "All";
          AppState.vaultBand = "All";
          AppState.vaultSavedOnly = false;
          renderMain();
          break;
        }

        /* Progress Modal Actions */
        case "open-progress-modal": {
          const modal = document.getElementById("progress-modal");
          if (modal) modal.classList.remove("hidden");
          break;
        }

        case "close-progress-modal": {
          const modal = document.getElementById("progress-modal");
          if (modal) modal.classList.add("hidden");
          break;
        }

        case "reset-all-storage": {
          Store.resetAll();
          syncNavChrome();
          const modal = document.getElementById("progress-modal");
          if (modal) modal.classList.add("hidden");
          renderMain();
          break;
        }
      }
    });

    // Change events (radio inputs, selects)
    document.addEventListener("change", (e) => {
      const t = e.target;
      const action = t.getAttribute("data-action");
      if (action === "quiz-option") {
        const qid = t.getAttribute("data-qid");
        AppState.quizAnswers[qid] = Number(t.value);
        renderMain();
      } else if (action === "select-cue-card") {
        stopAllTimersAndAudio();
        AppState.activeCueIdx = Number(t.value);
        AppState.cueTimerPhase = "prep";
        AppState.cueSecondsLeft = 60;
        AppState.cueModelOpen = false;
        renderMain();
      } else if (action === "vault-band-change") {
        AppState.vaultBand = t.value;
        AppState.flashcardIdx = 0;
        renderMain();
      } else if (action === "audio-rate") {
        AppState.audioRate = parseFloat(t.value) || 1.0;
      }
    });

    // Live text inputs (gap-fills, scratchpad, Part 3 OREQ, Writing draft, Vault search)
    document.addEventListener("input", (e) => {
      const t = e.target;
      if (t.id === "vault-search-input") {
        AppState.vaultQuery = t.value;
        AppState.flashcardIdx = 0;
        renderMain();
        return;
      }

      const action = t.getAttribute("data-action");
      if (action === "quiz-gap-input") {
        const qid = t.getAttribute("data-qid");
        const limit = Number(t.getAttribute("data-limit")) || 3;
        AppState.quizAnswers[qid] = t.value;
        const wc = countIeltsWords(t.value);
        const badge = document.querySelector(`[data-wordcount-for="${qid}"]`);
        if (badge) {
          const over = wc > limit;
          badge.innerHTML = `${wc} / ${limit} word${limit === 1 ? "" : "s"}${over ? ` ${icon("alertTriangle", "w-3.5 h-3.5")} Over limit!` : ""}`;
          badge.className = `inline-flex items-center gap-1 text-xs font-mono font-semibold ${over ? "text-coralwarn-600" : "text-ink-muted"}`;
        }
      } else if (action === "scratch-input") {
        const cid = t.getAttribute("data-card-id");
        const field = t.getAttribute("data-field");
        Store.saveScratchpad(cid, { [field]: t.value });
      } else if (action === "part3-input") {
        const fwId = t.getAttribute("data-fw-id");
        const step = t.getAttribute("data-step");
        Store.savePart3Draft(fwId, { [step]: t.value });
        // Update assembled box without losing textarea focus
        const draft = Store.getPart3Draft(fwId);
        const assembled = [draft.opinion, draft.reason, draft.example, draft.qualification]
          .map((s) => s.trim())
          .filter(Boolean)
          .join(" ");
        const previewBoxes = document.querySelectorAll("[data-part3-preview]");
        previewBoxes.forEach((b) => {
          b.textContent = assembled || "Fill in the 4 OREQ steps on the left to assemble a complete analytical response...";
        });
        const wc3 = document.getElementById("part3-assembled-wc");
        if (wc3) wc3.textContent = `${countIeltsWords(assembled)} words`;
      } else if (action === "writing-draft-input") {
        const sid = t.getAttribute("data-sid");
        const min = Number(t.getAttribute("data-min")) || 150;
        Store.saveWritingDraft(sid, t.value);
        const wc = countIeltsWords(t.value);
        const wcEl = document.getElementById("writing-draft-wc");
        if (wcEl) {
          wcEl.innerHTML = `${wc} / ${min} words ${wc >= min ? `${icon("checkCircle", "w-3.5 h-3.5")} Target met!` : ""}`;
          wcEl.className = `inline-flex items-center gap-1 font-mono font-bold ${wc >= min ? "text-oxford-600" : "text-amberband-600"}`;
        }
      }
    });

    window.addEventListener("hashchange", () => {
      const hashRoute = window.location.hash.replace(/^#/, "");
      if (hashRoute && hashRoute !== AppState.route) {
        navigate(hashRoute, true);
      }
    });
  }

  /* --------------------------- Bootstrap --------------------------- */

  async function init() {
    try {
      AppState.data = await loadData();
      // Deterministic daily idiom based on day-of-year so it rotates naturally every day
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      AppState.dailyIdiomIndex = dayOfYear % AppState.data.idioms_vault.length;

      attachGlobalListeners();

      const initialHash = window.location.hash.replace(/^#/, "");
      const valid = ["dashboard", "practice", "speaking", "writing", "vault"];
      AppState.route = valid.includes(initialHash) ? initialHash : "dashboard";
      syncNavChrome();
      renderMain();
    } catch (err) {
      console.error("Failed to initialise IELTS Prep Hub:", err);
      const root = document.getElementById("app-main");
      if (root) {
        root.innerHTML = `<div class="p-8 bg-white rounded-2xl border border-coralwarn-500 text-coralwarn-700">Failed to load study data: ${esc(
          err.message
        )}</div>`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
