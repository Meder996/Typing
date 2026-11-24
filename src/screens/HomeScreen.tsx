import { useState } from 'react'
import { Icon } from '../components/Icons'
import { COLORS, TIME_LABELS, TIMES, WEEKDAY_LETTERS } from '../constants'
import { addDays, formatReminder, startOfDay, startOfWeek, toKey } from '../lib/date'
import { currentStreak, dayStats, isActiveOn, isDone, recentRate } from '../lib/habits'
import type { AppState, Habit, TimeOfDay } from '../types'

type Range = 'today' | 'weekly' | 'overall'
const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'overall', label: 'Overall' },
]

interface Props {
  state: AppState
  onToggle: (habitId: string, key: string) => void
  onEdit: (habit: Habit) => void
}

export default function HomeScreen({ state, onToggle, onEdit }: Props) {
  const [range, setRange] = useState<Range>('today')
  const [filter, setFilter] = useState<TimeOfDay | 'all'>('all')
  const [weekOffset, setWeekOffset] = useState(0)

  const today = startOfDay(new Date())
  const todayKey = toKey(today)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const habits = state.habits.filter((h) => filter === 'all' || h.timeOfDay === filter)

  return (
    <div className="screen">
      <header className="header">
        <div>
          <p className="eyebrow">
            {greeting}
            {state.name ? `, ${state.name}` : ''}
          </p>
          <h1 className="title">Home</h1>
        </div>
        <div className="avatar" aria-hidden="true">
          {(state.name || 'H').charAt(0).toUpperCase()}
        </div>
      </header>

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

      {range === 'today' && <TodayView state={state} habits={habits} today={today} todayKey={todayKey} onToggle={onToggle} onEdit={onEdit} />}
      {range === 'weekly' && (
        <WeeklyView
          state={state}
          habits={habits}
          today={today}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          onToggle={onToggle}
        />
      )}
      {range === 'overall' && <OverallView state={state} habits={habits} today={today} onEdit={onEdit} />}
    </div>
  )
}

function TodayView({
  state,
  habits,
  today,
  todayKey,
  onToggle,
  onEdit,
}: {
  state: AppState
  habits: Habit[]
  today: Date
  todayKey: string
  onToggle: (id: string, key: string) => void
  onEdit: (h: Habit) => void
}) {
  const due = habits.filter((h) => isActiveOn(h, today)).sort((a, b) => a.reminder.localeCompare(b.reminder))
  const pending = due.filter((h) => !isDone(state, h.id, todayKey))
  const completed = due.filter((h) => isDone(state, h.id, todayKey))
  const all = dayStats(state, today)
  const pct = all.total ? Math.round((all.done / all.total) * 100) : 0

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

      {due.length === 0 && <EmptyState text="Nothing scheduled for today in this filter." />}

      {pending.length > 0 && (
        <div className="habit-stack">
          {pending.map((h) => (
            <HabitCardToday key={h.id} habit={h} done={false} onToggle={() => onToggle(h.id, todayKey)} onEdit={() => onEdit(h)} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <div className="section-label">Completed</div>
          <div className="habit-stack">
            {completed.map((h) => (
              <HabitCardToday key={h.id} habit={h} done onToggle={() => onToggle(h.id, todayKey)} onEdit={() => onEdit(h)} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function HabitCardToday({
  habit,
  done,
  onToggle,
  onEdit,
}: {
  habit: Habit
  done: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  return (
    <div className={`habit-card ${done ? 'is-done' : ''}`} style={{ background: COLORS[habit.color].bg }}>
      <button className="habit-main" onClick={onEdit} aria-label={`Edit ${habit.name}`}>
        <span className="habit-emoji">{habit.emoji}</span>
        <span className="habit-info">
          <span className="habit-name">{habit.name}</span>
          <span className="habit-meta">
            {formatReminder(habit.reminder)} · {TIME_LABELS[habit.timeOfDay]}
          </span>
        </span>
      </button>
      <button
        className={`check ${done ? 'on' : ''}`}
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Mark ${habit.name} as not done` : `Mark ${habit.name} as done`}
      >
        <Icon name="check" size={18} />
      </button>
    </div>
  )
}

function WeeklyView({
  state,
  habits,
  today,
  weekOffset,
  setWeekOffset,
  onToggle,
}: {
  state: AppState
  habits: Habit[]
  today: Date
  weekOffset: number
  setWeekOffset: (n: number) => void
  onToggle: (id: string, key: string) => void
}) {
  const monday = addDays(startOfWeek(today), weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sunday = days[6]
  const label = `${days[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString([], { month: 'short', day: 'numeric' })}`

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

      {habits.length === 0 && <EmptyState text="No habits in this filter yet." />}

      <div className="habit-stack">
        {habits.map((h) => (
          <div key={h.id} className="habit-card week-card" style={{ background: COLORS[h.color].bg }}>
            <div className="week-head">
              <span className="habit-emoji small-emoji">{h.emoji}</span>
              <span className="habit-name">{h.name}</span>
            </div>
            <div className="week-row">
              {days.map((d, i) => {
                const key = toKey(d)
                const scheduled = h.days.includes(i) && key >= h.createdAt
                const future = d > today
                const done = isDone(state, h.id, key)
                if (!scheduled) {
                  return (
                    <div key={key} className="day-cell">
                      <span className="day-letter">{WEEKDAY_LETTERS[i]}</span>
                      <span className="day-dot off">–</span>
                    </div>
                  )
                }
                return (
                  <div key={key} className="day-cell">
                    <span className="day-letter">{WEEKDAY_LETTERS[i]}</span>
                    <button
                      className={`day-dot ${done ? 'on' : ''}`}
                      disabled={future}
                      onClick={() => onToggle(h.id, key)}
                      aria-pressed={done}
                      aria-label={`${h.name} ${key} ${done ? 'done' : 'not done'}`}
                    >
                      {done && <Icon name="check" size={16} />}
                    </button>
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
  state,
  habits,
  today,
  onEdit,
}: {
  state: AppState
  habits: Habit[]
  today: Date
  onEdit: (h: Habit) => void
}) {
  if (habits.length === 0) return <EmptyState text="No habits in this filter yet." />
  const totals = habits.reduce(
    (acc, h) => {
      const r = recentRate(h, state.completions[h.id] ?? [], 30, today)
      acc.done += r.done
      acc.total += r.total
      return acc
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
            <div className="stat-value">{pct}% <span className="muted small">completion</span></div>
          </div>
          <div className="ring-value">{habits.length}</div>
        </div>
        <div className="progress">
          <span style={{ width: `${pct}%` }} />
        </div>
      </section>

      <div className="habit-stack" style={{ marginTop: 12 }}>
        {habits.map((h) => {
          const completions = state.completions[h.id] ?? []
          const r = recentRate(h, completions, 30, today)
          const p = r.total ? Math.round((r.done / r.total) * 100) : 0
          const streak = currentStreak(h, completions, today)
          return (
            <button key={h.id} className="habit-card overall-card" style={{ background: COLORS[h.color].bg }} onClick={() => onEdit(h)}>
              <span className="habit-emoji">{h.emoji}</span>
              <span className="habit-info">
                <span className="habit-name">{h.name}</span>
                <span className="habit-meta">
                  <Icon name="flame" size={14} /> {streak} day streak · {r.done}/{r.total} in 30 days
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

function EmptyState({ text }: { text: string }) {
  return <div className="empty">{text}</div>
}
