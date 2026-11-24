import { addDays, startOfDay, toKey, weekdayIndex } from './date'
import { ALL_DAYS, WEEKDAYS_ONLY, WEEKEND_ONLY } from '../constants'
import type { AppState, Habit } from '../types'

const STORAGE_KEY = 'habitly.state.v1'

/** Starter data so the app looks alive on first launch (mirrors the Figma sample habits). */
export function createSeedState(): AppState {
  const today = startOfDay(new Date())
  const created = toKey(addDays(today, -30))

  const seeds: Omit<Habit, 'id' | 'createdAt'>[] = [
    { name: 'Set small goals', emoji: '🎯', color: 'coral', timeOfDay: 'morning', days: ALL_DAYS, reminder: '07:30' },
    { name: 'Work', emoji: '🏆', color: 'lavender', timeOfDay: 'afternoon', days: WEEKDAYS_ONLY, reminder: '13:00' },
    { name: 'Meditation', emoji: '🧘', color: 'mint', timeOfDay: 'morning', days: ALL_DAYS, reminder: '06:45' },
    { name: 'Basketball', emoji: '🏀', color: 'peach', timeOfDay: 'evening', days: [0, 2, 4], reminder: '18:00' },
    { name: 'Sleep over 8h', emoji: '😴', color: 'sky', timeOfDay: 'evening', days: ALL_DAYS, reminder: '22:30' },
    { name: 'Playing games', emoji: '🎮', color: 'pink', timeOfDay: 'evening', days: WEEKEND_ONLY, reminder: '20:00' },
  ]

  const habits: Habit[] = seeds.map((s, i) => ({ ...s, id: `seed-${i + 1}`, createdAt: created }))

  const completions: Record<string, string[]> = {}
  habits.forEach((h, hi) => {
    completions[h.id] = []
    // Past 30 days only; today starts empty so the user has something to tap.
    for (let i = 1; i <= 30; i++) {
      const d = addDays(today, -i)
      if (!h.days.includes(weekdayIndex(d))) continue
      if ((i * 7 + hi * 3) % 5 !== 0) completions[h.id].push(toKey(d))
    }
  })

  return { onboarded: false, name: '', theme: 'dark', habits, completions }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (Array.isArray(parsed.habits) && parsed.completions) return parsed
    }
  } catch {
    /* corrupted storage – fall through to seed data */
  }
  return createSeedState()
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage full or unavailable – app keeps working in memory */
  }
}
