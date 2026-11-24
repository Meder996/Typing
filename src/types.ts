export type TimeOfDay = 'morning' | 'afternoon' | 'evening'
export type ColorKey = 'coral' | 'lavender' | 'mint' | 'peach' | 'sky' | 'pink' | 'butter' | 'aqua'
export type ThemeName = 'dark' | 'light'
export type Tab = 'home' | 'stats' | 'habits' | 'account'

export interface Habit {
  id: string
  name: string
  emoji: string
  color: ColorKey
  timeOfDay: TimeOfDay
  /** Scheduled weekdays: 0 = Monday … 6 = Sunday */
  days: number[]
  /** Reminder time, "HH:MM" (24h) */
  reminder: string
  /** Local calendar day the habit started, "YYYY-MM-DD" */
  createdAt: string
}

export interface AppState {
  onboarded: boolean
  name: string
  theme: ThemeName
  habits: Habit[]
  /** habitId -> list of completed days, "YYYY-MM-DD" */
  completions: Record<string, string[]>
}
