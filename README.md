# Habitly – Habit Tracker

A mobile-first habit tracker web app inspired by the **Habitly – Habit Tracker App UI Kit** Figma design.

## Features

- **Onboarding** – splash screen and name setup.
- **Home** – habits grouped by Today / Weekly / Overall, filterable by Morning, Afternoon, and Evening. Tap a habit to mark it done; the weekly view lets you check off any day this week.
- **Report** – best streak, completion rate, last-7-days bar chart, 30-day trend line, per-habit progress, and a monthly completion calendar.
- **Habits** – list of all habits grouped by time of day; create, edit, or delete.
- **Account** – display name, dark/light appearance, and a reset to demo data.

Data is stored in `localStorage`, so it persists per browser.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

## Project structure

```
src/
  App.tsx            app shell, tabs, state updates
  constants.ts       colors, emojis, weekday labels
  types.ts           Habit / AppState types
  index.css          design tokens (dark + light) and components
  lib/
    date.ts          local date helpers (Monday-first weeks)
    habits.ts        completion, streak, and rate calculations
    storage.ts       seed data + localStorage persistence
  components/        Icons, Logo, TabBar, Onboarding, HabitForm
  screens/           HomeScreen, StatsScreen, HabitsScreen, AccountScreen
```
