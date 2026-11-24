import { useApp } from '../context'
import { HabitIcon } from '../icons'
import { COLORS } from '../constants'
import { parseKey } from '../lib/date'
import { Empty, Page } from '../ui'
import type { Habit } from '../types'

export default function History() {
  const { user } = useApp()
  const byDay = new Map<string, Habit[]>()
  for (const h of user.habits) {
    for (const k of user.completions[h.id] ?? []) byDay.set(k, [...(byDay.get(k) ?? []), h])
  }
  const days = [...byDay.keys()].sort().reverse()

  return (
    <Page title="History">
      {days.length === 0 && <Empty>Your check-ins will show up here.</Empty>}
      {days.map((k) => (
        <section key={k}>
          <div className="section-label">
            {parseKey(k).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div className="list">
            {(byDay.get(k) ?? []).map((h) => (
              <div key={h.id} className="list-row static">
                <span className="habit-emoji small-emoji" style={{ background: COLORS[h.color].bg }}>
                  <HabitIcon name={h.icon} size={20} />
                </span>
                <span className="row-grow row-title">{h.name}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </Page>
  )
}
