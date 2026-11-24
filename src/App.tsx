import { useCallback, useEffect, useState } from 'react'
import { Ctx, TAB_ROUTES, type AppCtx, type Route } from './context'
import RouteView from './routes'
import TabBar from './components/TabBar'
import { Icon } from './icons'
import { emptyUser, loadDb, saveDb } from './lib/storage'
import type { Db } from './types'

const PLACEHOLDER = emptyUser('', '')

function initialStack(db: Db): Route[] {
  const user = db.sessionId ? db.data[db.sessionId] : undefined
  if (!user) return [{ name: 'splash' }]
  return user.onboarded ? [{ name: 'home' }] : [{ name: 'question', step: 0 }]
}

export default function App() {
  const [initial] = useState<Db>(() => loadDb())
  const [db, setDb] = useState<Db>(initial)
  const [stack, setStack] = useState<Route[]>(() => initialStack(initial))

  const user = (db.sessionId && db.data[db.sessionId]) || PLACEHOLDER
  const current = stack[stack.length - 1]
  const isTab = stack.length === 1 && TAB_ROUTES.includes(current.name)
  // The app shell (side navigation) appears only for finished accounts; sign-up and onboarding stay full page.
  const inApp = !!db.sessionId && !!db.data[db.sessionId] && user.onboarded

  useEffect(() => {
    saveDb(db)
  }, [db])

  useEffect(() => {
    document.documentElement.dataset.theme = user.theme
  }, [user.theme])

  const update = useCallback(
    (fn: (u: AppCtx['user']) => AppCtx['user']) =>
      setDb((d) => {
        const id = d.sessionId
        if (!id || !d.data[id]) return d
        return { ...d, data: { ...d.data, [id]: fn(d.data[id]) } }
      }),
    [],
  )

  const push = useCallback((r: Route) => setStack((s) => [...s, r]), [])
  const pop = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), [])
  const reset = useCallback((rs: Route[]) => setStack(rs), [])

  const ctx: AppCtx = { db, user, stack, current, push, pop, reset, update, setDb }

  return (
    <Ctx.Provider value={ctx}>
      {inApp ? (
        <div className="app-shell">
          <TabBar active={current.name} onChange={(t) => setStack([{ name: t }])} mobileVisible={isTab} />
          <main className="app-main">
            <RouteView route={current} />
            {isTab && current.name === 'home' && (
              <button className="fab" onClick={() => push({ name: 'habit-new' })} aria-label="Add habit">
                <Icon name="plus" size={26} />
              </button>
            )}
          </main>
        </div>
      ) : (
        <div className="auth-shell">
          <RouteView route={current} />
        </div>
      )}
    </Ctx.Provider>
  )
}
