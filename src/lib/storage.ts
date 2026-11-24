import type { Db, UserData } from '../types'

const KEY = 'habitly.v2'

/** A brand-new account: no habits, no check-ins, no moods. */
export function emptyUser(name: string, email: string): UserData {
  return {
    profile: { name, email, phone: '', birthday: '' },
    onboarded: false,
    answers: {},
    habits: [],
    completions: {},
    moods: {},
    theme: 'dark',
    language: 'English',
    plan: null,
    payment: null,
    reminders: true,
    analytics: false,
    twoFactor: false,
    linked: { google: false, apple: false, facebook: false },
    board: [],
  }
}

export const emptyDb = (): Db => ({ sessionId: null, accounts: [], data: {} })

export function loadDb(): Db {
  try {
    localStorage.removeItem('habitly.state.v1') // old demo data from the first version
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (Array.isArray(parsed.accounts) && parsed.data) return parsed
    }
  } catch {
    /* corrupted storage – start clean */
  }
  return emptyDb()
}

export function saveDb(db: Db): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* storage unavailable – keep working in memory */
  }
}

/** SHA-256 password hash. Local-only demo: there is no server. */
export async function hashPassword(password: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  let h = 0
  for (const c of password) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return `fb${(h >>> 0).toString(16)}`
}
