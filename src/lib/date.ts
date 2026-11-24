/** Local calendar helpers. All "day" values are local midnight Dates. */

const pad = (n: number) => String(n).padStart(2, '0')

export const toKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** 0 = Monday … 6 = Sunday */
export const weekdayIndex = (d: Date): number => (d.getDay() + 6) % 7

export const startOfWeek = (d: Date): Date => addDays(startOfDay(d), -weekdayIndex(d))

export const formatReminder = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export const formatShortDate = (d: Date): string =>
  d.toLocaleDateString([], { month: 'short', day: 'numeric' })
