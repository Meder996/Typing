import { createContext, useContext } from 'react'
import type { Db, UserData } from './types'

export type RouteName =
  | 'splash' | 'welcome' | 'signup' | 'login' | 'forgot' | 'otp' | 'reset' | 'question' | 'allset'
  | 'home' | 'mood' | 'report' | 'habits' | 'board' | 'account'
  | 'habit-new' | 'habit-edit' | 'habit-detail' | 'history'
  | 'personal' | 'billing' | 'premium' | 'achievements' | 'security' | 'linked' | 'data'
  | 'preferences' | 'language' | 'help' | 'faq' | 'contact' | 'privacy' | 'terms' | 'delete'

/** Root tab screens; they replace the stack instead of stacking on top. */
export const TAB_ROUTES: RouteName[] = ['home', 'mood', 'report', 'habits', 'board', 'account']

export interface Route {
  name: RouteName
  id?: string
  step?: number
  email?: string
}

export interface AppCtx {
  db: Db
  /** Current account's data (a placeholder while logged out). */
  user: UserData
  stack: Route[]
  current: Route
  push: (r: Route) => void
  pop: () => void
  reset: (rs: Route[]) => void
  update: (fn: (u: UserData) => UserData) => void
  setDb: (fn: (d: Db) => Db) => void
}

export const Ctx = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <App>')
  return ctx
}
