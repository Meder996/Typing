import { addDays, startOfDay, toKey, weekdayIndex } from './date'
import type { Habit, UserData } from '../types'

type Data = Pick<UserData, 'habits' | 'completions'>

export const newId = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

/** A habit is due on a date if that weekday is scheduled and the habit had started by then. */
export function isActiveOn(h: Habit, date: Date): boolean {
  return h.days.includes(weekdayIndex(date)) && toKey(date) >= h.createdAt
}

export function isDone(u: Data, habitId: string, key: string): boolean {
  return (u.completions[habitId] ?? []).includes(key)
}

/** How many due habits were completed on a given day. */
export function dayStats(u: Data, date: Date): { done: number; total: number } {
  const key = toKey(date)
  let done = 0
  let total = 0
  for (const h of u.habits) {
    if (!isActiveOn(h, date)) continue
    total++
    if (isDone(u, h.id, key)) done++
  }
  return { done, total }
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

export function totalCheckIns(u: Data): number {
  return u.habits.reduce((n, h) => n + (u.completions[h.id]?.length ?? 0), 0)
}

export interface AchievementStats {
  total: number
  perfectDays: number
  habits: number
}

export function achievementStats(u: Data, today: Date = startOfDay(new Date())): AchievementStats {
  let perfectDays = 0
  for (let i = 0; i < 90; i++) {
    const { done, total } = dayStats(u, addDays(today, -i))
    if (total > 0 && done === total) perfectDays++
  }
  return { total: totalCheckIns(u), perfectDays, habits: u.habits.length }
}

export const ACHIEVEMENTS: { id: string; title: string; desc: string; test: (s: AchievementStats) => boolean }[] = [
  { id: 'first', title: 'First step', desc: 'Complete your first habit', test: (s) => s.total >= 1 },
  { id: 'ten', title: 'Ten check-ins', desc: 'Complete 10 habits in total', test: (s) => s.total >= 10 },
  { id: 'perfect', title: 'Perfect day', desc: 'Finish every habit due on one day', test: (s) => s.perfectDays >= 1 },
  { id: 'builder', title: 'Habit builder', desc: 'Create 5 habits', test: (s) => s.habits >= 5 },
]

export function levelInfo(total: number): { level: number; progress: number; toNext: number } {
  return { level: Math.floor(total / 10) + 1, progress: (total % 10) / 10, toNext: 10 - (total % 10) }
}
