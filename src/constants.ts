import type { IconName } from './icons'
import type { ColorKey, PlanKey, TimeOfDay } from './types'

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

export const MOODS = ['Awful', 'Bad', 'Okay', 'Good', 'Great']
export const MOOD_COLORS = ['#FF9E97', '#FFCFA5', '#FFE69A', '#C8F9CF', '#A9D1FA']

export const LANGUAGES = ['English', 'Русский', 'Кыргызча', 'Türkçe', 'Español', 'Deutsch']

export interface QuestionConfig {
  key: string
  title: string
  kind: 'time' | 'single' | 'multi'
  options?: string[]
  defaultValue?: string
}

export const QUESTIONS: QuestionConfig[] = [
  { key: 'bedtime', title: 'How do you usually end your day?', kind: 'time', defaultValue: '23:00' },
  { key: 'wake', title: 'What time do you usually wake up?', kind: 'time', defaultValue: '07:00' },
  {
    key: 'focus',
    title: 'Do you often find it hard to focus?',
    kind: 'single',
    options: ['Always', 'Sometimes', 'Rarely', 'Never'],
  },
  {
    key: 'influence',
    title: 'What influenced you to become organized?',
    kind: 'multi',
    options: ['Lack of motivation', 'Web overload', 'Current environment', 'Digital distractions', 'Lack of time management'],
  },
  {
    key: 'goals',
    title: 'What do you want to achieve?',
    kind: 'multi',
    options: ['Build healthy habits', 'Boost productivity', 'Improve personal skills', 'Manage stress & anxiety', 'Other'],
  },
]

export const PLANS: Record<PlanKey, { label: string; price: string; period: string; note: string }> = {
  monthly: { label: 'Monthly', price: '$4.99', period: '/month', note: 'Billed every month' },
  yearly: { label: 'Yearly', price: '$39.99', period: '/year', note: 'Save 33% · billed yearly' },
}

export const PREMIUM_FEATURES = [
  'Unlimited habits',
  'Advanced reports and charts',
  'Reminders for every habit',
  'Mood insights',
  'Achievements and badges',
]

export const PAYMENT_METHODS: { id: 'card' | 'apple' | 'google' | 'paypal'; label: string; icon: IconName }[] = [
  { id: 'card', label: 'Credit / debit card', icon: 'card' },
  { id: 'apple', label: 'Apple Pay', icon: 'wallet' },
  { id: 'google', label: 'Google Pay', icon: 'wallet' },
  { id: 'paypal', label: 'PayPal', icon: 'globe' },
]
