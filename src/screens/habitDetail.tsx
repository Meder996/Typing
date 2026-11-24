import { useState } from 'react'
import { useApp } from '../context'
import { HabitIcon, Icon } from '../icons'
import { COLORS, TIME_LABELS } from '../constants'
import { formatReminder, parseKey, startOfDay, toKey } from '../lib/date'
import { isActiveOn, recentRate } from '../lib/habits'
import { MonthGrid, Page, Empty } from '../ui'
import { scheduleText } from './habits'

export default function HabitDetail({ id }: { id: string }) {
  const { user, update, push } = useApp()
  const [offset, setOffset] = useState(0)
  const h = user.habits.find((x) => x.id === id)

  if (!h) {
    return (
      <Page title="Habit">
        <Empty>This habit no longer exists.</Empty>
      </Page>
    )
  }

  const comps = user.completions[h.id] ?? []
  const today = startOfDay(new Date())
  const todayKey = toKey(today)
  const rate = recentRate(h, comps, 30, today)
  const rateValue = rate.total ? Math.round((rate.done / rate.total) * 100) : 0

  const toggleDay = (key: string) =>
    update((u) => {
      const list = u.completions[h.id] ?? []
      const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
      return { ...u, completions: { ...u.completions, [h.id]: next } }
    })

  const doneToday = comps.includes(todayKey)
  const recent = [...comps].sort().reverse().slice(0, 10)

  return (
    <Page
      title={h.name}
      right={
        <button className="icon-btn" onClick={() => push({ name: 'habit-edit', id: h.id })} aria-label="Edit habit">
          <Icon name="edit" />
        </button>
      }
    >
      <section className="card detail-hero" style={{ background: COLORS[h.color].bg }}>
        <span className="habit-emoji">
          <HabitIcon name={h.icon} size={28} />
        </span>
        <div>
          <div className="habit-name">{h.name}</div>
          <div className="habit-meta">
            {scheduleText(h.days)} · {formatReminder(h.reminder)} · {TIME_LABELS[h.timeOfDay]}
          </div>
        </div>
      </section>

      <div className="stat-grid three">
        <div className="card center">
          <div className="stat-value">{comps.length}</div>
          <div className="muted small">Check-ins</div>
        </div>
        <div className="card center">
          <div className="stat-value">{rateValue}%</div>
          <div className="muted small">Last 30 days</div>
        </div>
        <div className="card center">
          <div className="stat-value">{comps.length}</div>
          <div className="muted small">Check-ins</div>
        </div>
      </div>

      {isActiveOn(h, today) && (
        <button className={`btn ${doneToday ? 'btn-ghost' : ''}`} onClick={() => toggleDay(todayKey)} style={{ marginTop: 12 }}>
          {doneToday ? 'Mark today as not done' : 'Mark today as done'}
        </button>
      )}

      <section className="card chart-card">
        <div className="card-title">Calendar</div>
        <p className="muted small">Tap a scheduled day to toggle it.</p>
        <MonthGrid
          offset={offset}
          setOffset={setOffset}
          cell={(d, { future }) => {
            if (!isActiveOn(h, d)) return { className: 'cal-off', disabled: true }
            const done = comps.includes(toKey(d))
            return {
              className: done ? 'full' : '',
              disabled: future,
              onClick: () => toggleDay(toKey(d)),
            }
          }}
        />
      </section>

      <div className="section-label">Recent check-ins</div>
      {recent.length === 0 ? (
        <Empty>No check-ins yet. Mark a day above to get started.</Empty>
      ) : (
        <div className="list">
          {recent.map((k) => (
            <div key={k} className="list-row static">
              <span className="icon-chip">
                <Icon name="check" size={18} />
              </span>
              <span className="row-grow row-title">
                {parseKey(k).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}
