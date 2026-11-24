import type { ColorKey, TimeOfDay } from './types'

export const COLORS: Record<ColorKey, { label: string; bg: string }> = {
  coral: { label: 'Coral', bg: '#FF9E97' },
  lavender: { label: 'Lavender', bg: '#CDC9FA' },
  mint: { label: 'Mint', bg: '#C8F9CF' },
  peach: { label: 'Peach', bg: '#FFCFA5' },
  sky: { label: 'Sky', bg: '#A9D1FA' },
  pink: { label: 'Pink', bg: '#F9AAD9' },
  butter: { label: 'Butter', bg: '#FFE69A' },
  aqua: { label: 'Aqua', bg: '#A8EBDD' },
}

export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[]

export const EMOJIS = [
  '🎯', '🏆', '🧘', '🏀', '😴', '🎮', '📚', '💧',
  '🏃', '🥗', '🎨', '🎸', '✍️', '💻', '🛏️', '🧹',
  '🌱', '🚴', '🧠', '☕', '🙏', '💰', '🎵', '🍎',
]

export const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening']

export const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

/** Monday-first, matching the weekday indices used in Habit.days */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAYS_ONLY = [0, 1, 2, 3, 4]
export const WEEKEND_ONLY = [5, 6]
