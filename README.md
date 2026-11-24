# Habitly

A habit tracker for the web: daily habits with streak-free check-ins, mood logging, reports, a per-account whiteboard, and account settings. Built with React 19, TypeScript and Vite. Data is stored in the browser (localStorage), so there is no server.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Features

- **Accounts (local):** sign up, log in, reset password with a 4-digit code. Each account has its own data; a new account starts empty.
- **Home / Habits:** create, edit and check off habits by weekday, time of day and reminder.
- **Mood and Report:** daily mood, monthly calendar, completion charts.
- **Board:** a whiteboard section (like Miro, in a single tab): pen, rectangle, ellipse, arrow, sticky notes, text, eraser, pan and zoom, colours, undo/redo, delete, clear. Saved per account.
- **Account:** profile, billing and Premium plan screens, achievements, security, preferences, help pages.

## Layout

- Wide screens: side navigation and a main column.
- Phones: bottom tab bar.

## Project layout

- `src/App.tsx`: app state, navigation stack, web shells
- `src/routes.tsx`: route → screen map
- `src/screens/`: one file per screen (`board.tsx` is the whiteboard)
- `src/lib/`: storage, habit maths, date helpers, board geometry
- `src/index.css`: design tokens and all styles
