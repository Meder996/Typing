import { Icon } from '../components/Icons'
import { COLORS, TIMES, TIME_LABELS, WEEKDAYS, WEEKDAYS_ONLY, WEEKEND_ONLY } from '../constants'
import { formatReminder } from '../lib/date'
import type { AppState, Habit } from '../types'

function scheduleText(days: number[]): string {
  if (days.length === 7) return 'Every day'
  if (days.length === 5 && WEEKDAYS_ONLY.every((d) => days.includes(d))) return 'Weekdays'
  if (days.length === 2 && WEEKEND_ONLY.every((d) => days.includes(d))) return 'Weekends'
  return days.map((d) => WEEKDAYS[d]).join(', ')
}

export default function HabitsScreen({
  state,
  onAdd,
  onEdit,
}: {
  state: AppState
  onAdd: () => void
  onEdit: (h: Habit) => void
}) {
  return (
    <div className="screen">
      <header className="header">
        <div>
          <p className="eyebrow">{state.habits.length} habits</p>
          <h1 className="title">My Habits</h1>
        </div>
        <button className="icon-btn filled" onClick={onAdd} aria-label="Add habit">
          <Icon name="plus" />
        </button>
      </header>

      {state.habits.length === 0 && <div className="empty">No habits yet. Tap + to create your first one.</div>}

      {TIMES.map((t) => {
        const list = state.habits.filter((h) => h.timeOfDay === t)
        if (list.length === 0) return null
        return (
          <section key={t}>
            <div className="section-label">{TIME_LABELS[t]}</div>
            <div className="list">
              {list.map((h) => (
                <button key={h.id} className="list-row" onClick={() => onEdit(h)}>
                  <span className="habit-emoji small-emoji" style={{ background: COLORS[h.color].bg }}>
                    {h.emoji}
                  </span>
                  <span className="row-grow">
                    <span className="row-title">{h.name}</span>
                    <span className="muted small block">
                      {scheduleText(h.days)} · {formatReminder(h.reminder)}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
