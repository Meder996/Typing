import { useApp } from '../context'
import { Icon, HabitIcon } from '../icons'
import { COLORS, TIMES, TIME_LABELS, WEEKDAYS, WEEKDAYS_ONLY, WEEKEND_ONLY } from '../constants'
import { formatReminder } from '../lib/date'
import { Empty, Page } from '../ui'
import type { Habit } from '../types'

export function scheduleText(days: number[]): string {
  if (days.length === 7) return 'Every day'
  if (days.length === 5 && WEEKDAYS_ONLY.every((d) => days.includes(d))) return 'Weekdays'
  if (days.length === 2 && WEEKEND_ONLY.every((d) => days.includes(d))) return 'Weekends'
  return days.map((d) => WEEKDAYS[d]).join(', ')
}

export default function HabitsList() {
  const { user, push } = useApp()
  const open = (h: Habit) => push({ name: 'habit-detail', id: h.id })

  return (
    <Page
      title="My Habits"
      eyebrow={`${user.habits.length} habit${user.habits.length === 1 ? '' : 's'}`}
      right={
        <div className="head-actions">
          <button className="icon-btn" onClick={() => push({ name: 'history' })} aria-label="History">
            <Icon name="clock" />
          </button>
          <button className="icon-btn filled" onClick={() => push({ name: 'habit-new' })} aria-label="Add habit">
            <Icon name="plus" />
          </button>
        </div>
      }
    >
      {user.habits.length === 0 && <Empty>No habits yet. Tap + to create your first one.</Empty>}

      {TIMES.map((t) => {
        const list = user.habits.filter((h) => h.timeOfDay === t)
        if (list.length === 0) return null
        return (
          <section key={t}>
            <div className="section-label">{TIME_LABELS[t]}</div>
            <div className="list">
              {list.map((h) => (
                <button key={h.id} className="list-row" onClick={() => open(h)}>
                  <span className="habit-emoji small-emoji" style={{ background: COLORS[h.color].bg }}>
                    <HabitIcon name={h.icon} size={20} />
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
    </Page>
  )
}
