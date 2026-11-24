import { addDays, startOfDay, toKey, weekdayIndex } from './date'
import type { AppState, Habit } from '../types'

export const newId = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

/** A habit is due on a date if that weekday is scheduled and the habit had started by then. */
export function isActiveOn(h: Habit, date: Date): boolean {
  return h.days.includes(weekdayIndex(date)) && toKey(date) >= h.createdAt
}

export function isDone(s: AppState, habitId: string, key: string): boolean {
  return (s.completions[habitId] ?? []).includes(key)
}

/** How many due habits were completed on a given day. */
export function dayStats(s: AppState, date: Date): { done: number; total: number } {
  const key = toKey(date)
  let done = 0
  let total = 0
  for (const h of s.habits) {
    if (!isActiveOn(h, date)) continue
    total++
    if (isDone(s, h.id, key)) done++
  }
  return { done, total }
}

/** Consecutive scheduled days completed, ending today (today may still be pending). */
export function currentStreak(h: Habit, completions: string[], today: Date = startOfDay(new Date())): number {
  const set = new Set(completions)
  let streak = 0
  for (let i = 0; i < 366; i++) {
    const d = addDays(today, -i)
    if (toKey(d) < h.createdAt) break
    if (!h.days.includes(weekdayIndex(d))) continue
    if (set.has(toKey(d))) streak++
    else if (i === 0) continue
    else break
  }
  return streak
}

/** Completion counts for one habit over the last `days` days (inclusive of today). */
export function recentRate(h: Habit, completions: string[], days = 30, today: Date = startOfDay(new Date())) {
  const set = new Set(completions)
  let done = 0
  let total = 0
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i)
    if (!isActiveOn(h, d)) continue
    total++
    if (set.has(toKey(d))) done++
  }
  return { done, total }
}
