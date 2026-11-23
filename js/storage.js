/**
 * IELTS Prep Hub — Client-Side LocalStorage Manager
 * Persists quiz scores, accuracy metrics, study streak, bookmarked idioms,
 * Part 2 4-box scratchpad notes, Part 3 OREQ drafts, Writing drafts, and 14-day study roadmap.
 */
(function () {
  const STORAGE_KEY = "ielts_prep_hub_state_v1";

  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function yesterdayISO() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function defaultState() {
    return {
      streakDays: 1,
      lastActiveDate: todayISO(),
      savedIdioms: [1, 2], // Pre-bookmark first 2 showcase idioms for immediate utility
      completedDays: [],
      practicedPart1: [],
      practicedCueCards: [],
      cueScratchpads: {},
      part3Drafts: {},
      writingDrafts: {},
      quizAttempts: {}, // { [quizId]: { score, total, bestScore, timestamp } }
      totalQuestionsAnswered: 0,
      totalQuestionsCorrect: 0,
      sessionsCompleted: 0
    };
  }

  class StorageService {
    constructor() {
      this.state = this.load();
      this.touchStreak();
    }

    load() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          const init = defaultState();
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(init));
          return init;
        }
        const parsed = JSON.parse(raw);
        return Object.assign(defaultState(), parsed);
      } catch (err) {
        console.warn("localStorage unavailable, using in-memory state:", err);
        return defaultState();
      }
    }

    save() {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (err) {
        console.warn("Failed to persist state:", err);
      }
      window.dispatchEvent(new CustomEvent("ielts:state-updated", { detail: this.state }));
    }

    touchStreak() {
      const today = todayISO();
      if (this.state.lastActiveDate === today) {
        if (!this.state.streakDays || this.state.streakDays < 1) {
          this.state.streakDays = 1;
          this.save();
        }
        return;
      }
      if (this.state.lastActiveDate === yesterdayISO()) {
        this.state.streakDays = (this.state.streakDays || 0) + 1;
      } else {
        this.state.streakDays = 1;
      }
      this.state.lastActiveDate = today;
      this.save();
    }

    isIdiomSaved(id) {
      return this.state.savedIdioms.includes(Number(id));
    }

    toggleIdiom(id) {
      const numId = Number(id);
      const idx = this.state.savedIdioms.indexOf(numId);
      if (idx >= 0) {
        this.state.savedIdioms.splice(idx, 1);
      } else {
        this.state.savedIdioms.push(numId);
      }
      this.touchStreak();
      this.save();
      return this.isIdiomSaved(numId);
    }

    toggleStudyDay(dayId) {
      const idx = this.state.completedDays.indexOf(dayId);
      if (idx >= 0) {
        this.state.completedDays.splice(idx, 1);
      } else {
        this.state.completedDays.push(dayId);
      }
      this.touchStreak();
      this.save();
      return this.state.completedDays.includes(dayId);
    }

    recordQuizSubmission(quizId, correctCount, totalCount) {
      const prev = this.state.quizAttempts[quizId];
      const bestScore = prev ? Math.max(prev.bestScore, correctCount) : correctCount;
      this.state.quizAttempts[quizId] = {
        score: correctCount,
        total: totalCount,
        bestScore,
        timestamp: new Date().toISOString()
      };
      this.state.totalQuestionsAnswered += totalCount;
      this.state.totalQuestionsCorrect += correctCount;
      this.state.sessionsCompleted += 1;
      this.touchStreak();
      this.save();
    }

    getAccuracyPercent() {
      if (!this.state.totalQuestionsAnswered) return null;
      return Math.round((this.state.totalQuestionsCorrect / this.state.totalQuestionsAnswered) * 100);
    }

    getScratchpad(cardId) {
      return (
        this.state.cueScratchpads[cardId] || {
          who: "",
          when: "",
          details: "",
          why: ""
        }
      );
    }

    saveScratchpad(cardId, data) {
      this.state.cueScratchpads[cardId] = Object.assign(this.getScratchpad(cardId), data);
      this.save();
    }

    toggleCueCardPracticed(cardId) {
      const numId = Number(cardId);
      const idx = this.state.practicedCueCards.indexOf(numId);
      if (idx >= 0) {
        this.state.practicedCueCards.splice(idx, 1);
      } else {
        this.state.practicedCueCards.push(numId);
        this.state.sessionsCompleted += 1;
      }
      this.touchStreak();
      this.save();
      return this.state.practicedCueCards.includes(numId);
    }

    markPart1Practiced(qId) {
      if (!this.state.practicedPart1.includes(qId)) {
        this.state.practicedPart1.push(qId);
        this.save();
      }
    }

    getPart3Draft(fwId) {
      return (
        this.state.part3Drafts[fwId] || {
          opinion: "",
          reason: "",
          example: "",
          qualification: ""
        }
      );
    }

    savePart3Draft(fwId, draft) {
      this.state.part3Drafts[fwId] = Object.assign(this.getPart3Draft(fwId), draft);
      this.save();
    }

    getWritingDraft(sampleId) {
      return this.state.writingDrafts[sampleId] || "";
    }

    saveWritingDraft(sampleId, text) {
      this.state.writingDrafts[sampleId] = text;
      this.save();
    }

    exportJSON() {
      return JSON.stringify(this.state, null, 2);
    }

    resetAll() {
      this.state = defaultState();
      this.state.savedIdioms = [];
      this.save();
    }
  }

  window.IELTSStorage = new StorageService();
})();
