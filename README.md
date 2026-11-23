# IELTS Prep Hub

**IELTS Prep Hub** is a 100% client-side, static, interactive web application built to help students master all four IELTS modules (**Listening, Reading, Writing, and Speaking**) with zero backend or database servers required.

## Key Features

1. **Dashboard & Progress Tracker (`localStorage`)**
   - Automatic daily study streak counter, cumulative quiz accuracy percentage, saved idiom counter, and an interactive **14-Day IELTS Mastery Roadmap**.
   - **Daily Idiom & Collocation Spotlight** with contextual usage and anti-cramming examiner warnings.
2. **Module 1: Interactive Quiz & Practice Engine**
   - Covers **Listening** (with browser multi-voice audio player + accessible transcript), **Reading** (split-pane Academic passages with *True / False / Not Given*), **Writing**, and **Speaking**.
   - Automated **Gap-Fill validation** enforcing case-insensitivity and strict IELTS word-count limits (e.g. `ONE WORD ONLY`, `NO MORE THAN TWO WORDS AND/OR A NUMBER`).
   - **12-Minute 4-Skill Timed Mock Simulation** with live countdown timer and instant per-question breakdown explanations.
3. **Module 2: Speaking Simulator & Cue Card Studio**
   - **Part 1 Quick Practice:** Topic filters, random prompt generator, local-memory voice recorder, and expandable Band 8.5 model responses.
   - **Part 2 One-Minute Planner:** Interactive **60-second prep countdown** transitioning into a **2-minute speaking timer**, paired with an auto-saved **4-Box Digital Scratchpad** (*Who/What, When/Where, Specific Details, Feelings/Why*).
   - **Part 3 OREQ Discussion Builder:** Guided *Opinion → Reason → Example → Qualification* builder with live assembled response preview.
4. **Module 3: Writing Task 1 & Task 2 Sample Bank**
   - Curated real student samples (**Bands 7.0, 7.5, 8.5, and 9.0**) across **Bar Charts, Line Graphs, Pie Charts, Tables, Combined Charts, Process Diagrams, Map Comparisons, General Training Letters, and Task 2 Essays**.
   - Crisp inline **SVG charts & visualisers**, **Examiner Commentary Toggle** (highlighting structure, high-band lexis, and Band-7 traps), and an auto-saved **Practice Essay Pad** with live word counter.
5. **Module 4: Idioms, Collocations & Lexical Vault**
   - Searchable database filterable by **Topic**, **Band Target (`7.0+` to `8.5+`)**, and **Bookmarked (`Saved`)**, plus an interactive **Flashcard Active-Recall Drill**.

## Tech Stack & Static Deployment

- **Frontend:** Semantic HTML5, Tailwind CSS (`./styles/app.css`), Vanilla JavaScript (ES6+)
- **Data & Persistence:** Static JSON (`./data/ielts-data.json` with offline fallback) + Browser `localStorage`
- **Zero-Config Hosting:** Ready to deploy directly as a static root folder on **GitHub Pages**, **Vercel**, or **Netlify**.

### Run Locally

```bash
npm start
# Serves static files on http://0.0.0.0:3000
```

To rebuild Tailwind CSS after editing markup or styles:

```bash
npm run build:css
```
