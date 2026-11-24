import { useState } from 'react'
import { useApp } from '../context'
import { Icon, HabitIcon } from '../icons'
import { COLORS, TIMES, TIME_LABELS, WEEKDAY_LETTERS } from '../constants'
import { addDays, formatReminder, startOfDay, startOfWeek, toKey } from '../lib/date'
import { dayStats, isActiveOn, isDone, recentRate } from '../lib/habits'
import { Empty } from '../ui'
import type { Habit, TimeOfDay, UserData } from '../types'

type Range = 'today' | 'weekly' | 'overall'
const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'overall', label: 'Overall' },
]

export default function Home() {
  const { user, update, push } = useApp()
  const [range, setRange] = useState<Range>('today')
  const [filter, setFilter] = useState<TimeOfDay | 'all'>('all')
  const [weekOffset, setWeekOffset] = useState(0)

  const today = startOfDay(new Date())
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const habits = user.habits.filter((h) => filter === 'all' || h.timeOfDay === filter)

  const toggle = (habitId: string, key: string) =>
    update((u) => {
      const list = u.completions[habitId] ?? []
      const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
      return { ...u, completions: { ...u.completions, [habitId]: next } }
    })
  const open = (h: Habit) => push({ name: 'habit-detail', id: h.id })

  return (
    <div className="screen">
      <header className="header">
        <div>
          <p className="eyebrow">
            {greeting}
            {user.profile.name ? `, ${user.profile.name}` : ''}
          </p>
          <h1 className="title">Home</h1>
        </div>
        <button className="icon-btn filled" onClick={() => push({ name: 'habit-new' })} aria-label="Add habit">
          <Icon name="plus" />
        </button>
      </header>

      {user.habits.length === 0 ? (
        <div className="empty-hero">
          <span className="slide-icon">
            <Icon name="target" size={44} />
          </span>
          <h2 className="question-title center">No habits yet</h2>
          <p className="muted center">Create your first habit and check it off every day.</p>
          <button className="btn" onClick={() => push({ name: 'habit-new' })}>
            Create your first habit
          </button>
        </div>
      ) : (
        <>
          <div className="segmented" role="group" aria-label="View">
            {RANGES.map((r) => (
              <button key={r.id} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="chips" role="group" aria-label="Time of day">
            <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </button>
            {TIMES.map((t) => (
              <button key={t} className="chip" aria-pressed={filter === t} onClick={() => setFilter(t)}>
                {TIME_LABELS[t]}
              </button>
            ))}
          </div>

          {range === 'today' && <TodayView user={user} habits={habits} today={today} toggle={toggle} open={open} />}
          {range === 'weekly' && (
            <WeeklyView
              user={user}
              habits={habits}
              today={today}
              weekOffset={weekOffset}
              setWeekOffset={setWeekOffset}
              toggle={toggle}
            />
          )}
          {range === 'overall' && <OverallView user={user} habits={habits} today={today} open={open} />}
        </>
      )}
    </div>
  )
}

function TodayView({
  user,
  habits,
  today,
  toggle,
  open,
}: {
  user: UserData
  habits: Habit[]
  today: Date
  toggle: (id: string, key: string) => void
  open: (h: Habit) => void
}) {
  const key = toKey(today)
  const due = habits.filter((h) => isActiveOn(h, today)).sort((a, b) => a.reminder.localeCompare(b.reminder))
  const pending = due.filter((h) => !isDone(user, h.id, key))
  const completed = due.filter((h) => isDone(user, h.id, key))
  const all = dayStats(user, today)
  const pct = all.total ? Math.round((all.done / all.total) * 100) : 0

  const card = (h: Habit, done: boolean) => (
    <div key={h.id} className={`habit-card ${done ? 'is-done' : ''}`} style={{ background: COLORS[h.color].bg }}>
      <button className="habit-main" onClick={() => open(h)} aria-label={`Open ${h.name}`}>
        <span className="habit-emoji">
          <HabitIcon name={h.icon} size={24} />
        </span>
        <span className="habit-info">
          <span className="habit-name">{h.name}</span>
          <span className="habit-meta">
            {formatReminder(h.reminder)} · {TIME_LABELS[h.timeOfDay]}
          </span>
        </span>
      </button>
      <button
        className={`check ${done ? 'on' : ''}`}
        onClick={() => toggle(h.id, key)}
        aria-pressed={done}
        aria-label={done ? `Mark ${h.name} as not done` : `Mark ${h.name} as done`}
      >
        <Icon name="check" size={18} />
      </button>
    </div>
  )

  return (
    <>
      <section className="card summary">
        <div className="summary-row">
          <div>
            <p className="eyebrow">Today's progress</p>
            <div className="stat-value">
              {all.done}/{all.total} <span className="muted small">done</span>
            </div>
          </div>
          <div className="ring-value">{pct}%</div>
        </div>
        <div className="progress">
          <span style={{ width: `${pct}%` }} />
        </div>
      </section>

      {due.length === 0 && <Empty>Nothing scheduled for today in this filter.</Empty>}

      {pending.length > 0 && <div className="habit-stack">{pending.map((h) => card(h, false))}</div>}

      {completed.length > 0 && (
        <>
          <div className="section-label">Completed</div>
          <div className="habit-stack">{completed.map((h) => card(h, true))}</div>
        </>
      )}
    </>
  )
}

function WeeklyView({
  user,
  habits,
  today,
  weekOffset,
  setWeekOffset,
  toggle,
}: {
  user: UserData
  habits: Habit[]
  today: Date
  weekOffset: number
  setWeekOffset: (n: number) => void
  toggle: (id: string, key: string) => void
}) {
  const monday = addDays(startOfWeek(today), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const fmt = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const label = `${fmt(days[0])} – ${fmt(days[6])}`

  return (
    <>
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week">
          <Icon name="chevronLeft" />
        </button>
        <span>{weekOffset === 0 ? `This week · ${label}` : label}</span>
        <button className="icon-btn" onClick={() => setWeekOffset(weekOffset + 1)} disabled={weekOffset >= 0} aria-label="Next week">
          <Icon name="chevronRight" />
        </button>
      </div>

      {habits.length === 0 && <Empty>No habits in this filter yet.</Empty>}

      <div className="habit-stack">
        {habits.map((h) => (
          <div key={h.id} className="habit-card week-card" style={{ background: COLORS[h.color].bg }}>
            <div className="week-head">
              <span className="habit-emoji small-emoji">
                <HabitIcon name={h.icon} size={20} />
              </span>
              <span className="habit-name">{h.name}</span>
            </div>
            <div className="week-row">
              {days.map((d, i) => {
                const k = toKey(d)
                const scheduled = h.days.includes(i) && k >= h.createdAt
                const done = isDone(user, h.id, k)
                return (
                  <div key={k} className="day-cell">
                    <span className="day-letter">{WEEKDAY_LETTERS[i]}</span>
                    {scheduled ? (
                      <button
                        className={`day-dot ${done ? 'on' : ''}`}
                        disabled={d > today}
                        onClick={() => toggle(h.id, k)}
                        aria-pressed={done}
                        aria-label={`${h.name} ${k} ${done ? 'done' : 'not done'}`}
                      >
                        {done && <Icon name="check" size={16} />}
                      </button>
                    ) : (
                      <span className="day-dot off">–</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function OverallView({
  user,
  habits,
  today,
  open,
}: {
  user: UserData
  habits: Habit[]
  today: Date
  open: (h: Habit) => void
}) {
  if (habits.length === 0) return <Empty>No habits in this filter yet.</Empty>
  const totals = habits.reduce(
    (acc, h) => {
      const r = recentRate(h, user.completions[h.id] ?? [], 30, today)
      return { done: acc.done + r.done, total: acc.total + r.total }
    },
    { done: 0, total: 0 },
  )
  const pct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0

  return (
    <>
      <section className="card summary">
        <div className="summary-row">
          <div>
            <p className="eyebrow">Last 30 days</p>
            <div className="stat-value">
              {pct}% <span className="muted small">completion</span>
            </div>
          </div>
          <div className="ring-value">{habits.length}</div>
        </div>
        <div className="progress">
          <span style={{ width: `${pct}%` }} />
        </div>
      </section>

      <div className="habit-stack" style={{ marginTop: 12 }}>
        {habits.map((h) => {
          const completions = user.completions[h.id] ?? []
          const r = recentRate(h, completions, 30, today)
          const p = r.total ? Math.round((r.done / r.total) * 100) : 0
          return (
            <button key={h.id} className="habit-card overall-card" style={{ background: COLORS[h.color].bg }} onClick={() => open(h)}>
              <span className="habit-emoji">
                <HabitIcon name={h.icon} size={24} />
              </span>
              <span className="habit-info">
                <span className="habit-name">{h.name}</span>
                <span className="habit-meta">
                  {r.done}/{r.total} in 30 days
                </span>
                <span className="progress on-card">
                  <span style={{ width: `${p}%` }} />
                </span>
              </span>
              <span className="pct">{p}%</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
