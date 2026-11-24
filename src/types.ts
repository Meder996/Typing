import type { HabitIconKey } from './icons'

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'
export type ColorKey = 'coral' | 'lavender' | 'mint' | 'peach' | 'sky' | 'pink' | 'butter' | 'aqua'
export type ThemeName = 'dark' | 'light'
export type PlanKey = 'monthly' | 'yearly'
export type LinkKey = 'google' | 'apple' | 'facebook'

export interface Habit {
  id: string
  name: string
  icon: HabitIconKey
  color: ColorKey
  timeOfDay: TimeOfDay
  /** Scheduled weekdays: 0 = Monday … 6 = Sunday */
  days: number[]
  /** Reminder time, "HH:MM" (24h) */
  reminder: string
  /** First day of the habit, "YYYY-MM-DD" */
  createdAt: string
}

export interface Account {
  id: string
  email: string
  passwordHash: string
}

export interface Profile {
  name: string
  email: string
  phone: string
  birthday: string
}

export interface PaymentInfo {
  method: string
  last4: string | null
  holder: string
}

/** Everything that belongs to one account. A new account starts empty. */
export interface UserData {
  profile: Profile
  onboarded: boolean
  answers: Record<string, string | string[]>
  habits: Habit[]
  /** habitId -> completed days, "YYYY-MM-DD" */
  completions: Record<string, string[]>
  /** dateKey -> mood level 0 (awful) … 4 (great) */
  moods: Record<string, number>
  theme: ThemeName
  language: string
  plan: PlanKey | null
  payment: PaymentInfo | null
  reminders: boolean
  analytics: boolean
  twoFactor: boolean
  linked: Record<LinkKey, boolean>
  /** Whiteboard objects. Optional so data saved before the board existed still loads. */
  board?: BoardItem[]
}

interface BoardLine {
  id: string
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
}

interface BoardBox {
  id: string
  color: string
  x: number
  y: number
  w: number
  h: number
  text: string
}

/** One object on the whiteboard. Coordinates are in board units (not pixels). */
export type BoardItem =
  | { id: string; kind: 'pen'; color: string; points: [number, number][] }
  | (BoardLine & { kind: 'rect' })
  | (BoardLine & { kind: 'ellipse' })
  | (BoardLine & { kind: 'arrow' })
  | (BoardBox & { kind: 'note' })
  | (BoardBox & { kind: 'text' })

export interface Db {
  sessionId: string | null
  accounts: Account[]
  data: Record<string, UserData>
}
