import { useState } from 'react'
import { useApp } from '../context'
import { HABIT_ICON_KEYS, HabitIcon, Icon, type HabitIconKey } from '../icons'
import { ALL_DAYS, COLORS, COLOR_KEYS, TIMES, TIME_LABELS, WEEKDAYS, WEEKDAY_LETTERS, WEEKDAYS_ONLY, WEEKEND_ONLY } from '../constants'
import { parseKey, startOfDay, toKey } from '../lib/date'
import { newId } from '../lib/habits'
import { MonthGrid, Page, Sheet, Empty, TextField } from '../ui'
import type { ColorKey, Habit, TimeOfDay } from '../types'

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d))

export default function HabitForm({ id }: { id?: string }) {
  const { user, update, pop, reset } = useApp()
  const existing = id ? user.habits.find((h) => h.id === id) : undefined
  const todayKey = toKey(startOfDay(new Date()))

  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState<HabitIconKey>(existing?.icon ?? 'target')
  const [color, setColor] = useState<ColorKey>(existing?.color ?? 'lavender')
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(existing?.timeOfDay ?? 'morning')
  const [days, setDays] = useState<number[]>(existing?.days ?? ALL_DAYS)
  const [reminder, setReminder] = useState(existing?.reminder ?? '08:00')
  const [start, setStart] = useState(existing?.createdAt ?? todayKey)
  const [sheet, setSheet] = useState<'icon' | 'date' | null>(null)
  const [monthOffset, setMonthOffset] = useState(0)

  if (id && !existing) {
    return (
      <Page title="Habit">
        <Empty>This habit no longer exists.</Empty>
      </Page>
    )
  }

  const valid = name.trim().length > 0 && days.length > 0

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)))

  const save = () => {
    if (!valid) return
    const habit: Habit = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      icon,
      color,
      timeOfDay,
      days,
      reminder,
      createdAt: start,
    }
    update((u) => ({
      ...u,
      habits: existing ? u.habits.map((h) => (h.id === habit.id ? habit : h)) : [...u.habits, habit],
    }))
    pop()
  }

  const remove = () => {
    if (!existing) return
    if (!window.confirm(`Delete "${existing.name}"? Its history will be removed.`)) return
    update((u) => {
      const completions = { ...u.completions }
      delete completions[existing.id]
      return { ...u, habits: u.habits.filter((h) => h.id !== existing.id), completions }
    })
    reset([{ name: 'habits' }])
  }

  const startDate = parseKey(start)

  return (
    <Page title={existing ? 'Edit habit' : 'Create new habit'}>
      <div className="habit-card preview" style={{ background: COLORS[color].bg }}>
        <span className="habit-emoji">
          <HabitIcon name={icon} size={24} />
        </span>
        <div className="habit-info">
          <div className="habit-name">{name.trim() || 'Your habit'}</div>
          <div className="habit-meta">
            {TIME_LABELS[timeOfDay]} · {days.length === 7 ? 'Every day' : `${days.length} days a week`}
          </div>
        </div>
      </div>

      <TextField id="habit-name" label="Habit name" value={name} onChange={setName} placeholder="e.g. Read 20 pages" maxLength={40} />

      <div className="field-label">Icon</div>
      <button className="pick-row" onClick={() => setSheet('icon')}>
        <span className="habit-emoji small-emoji" style={{ background: COLORS[color].bg }}>
          <HabitIcon name={icon} size={20} />
        </span>
        <span className="row-grow">Choose icon</span>
        <Icon name="chevronRight" size={18} />
      </button>

      <div className="field-label">Color</div>
      <div className="swatches">
        {COLOR_KEYS.map((k) => (
          <button
            key={k}
            className="swatch"
            style={{ background: COLORS[k].bg }}
            aria-label={COLORS[k].label}
            aria-pressed={k === color}
            onClick={() => setColor(k)}
          />
        ))}
      </div>

      <div className="field-label">Repeat</div>
      <div className="chips no-pad">
        <button className="chip" aria-pressed={sameDays(days, ALL_DAYS)} onClick={() => setDays(ALL_DAYS)}>
          Every day
        </button>
        <button className="chip" aria-pressed={sameDays(days, WEEKDAYS_ONLY)} onClick={() => setDays(WEEKDAYS_ONLY)}>
          Weekdays
        </button>
        <button className="chip" aria-pressed={sameDays(days, WEEKEND_ONLY)} onClick={() => setDays(WEEKEND_ONLY)}>
          Weekends
        </button>
      </div>
      <div className="day-chips" style={{ marginTop: 12 }}>
        {WEEKDAYS.map((w, i) => (
          <button key={w} className="day-chip" aria-label={w} aria-pressed={days.includes(i)} onClick={() => toggleDay(i)}>
            {WEEKDAY_LETTERS[i]}
          </button>
        ))}
      </div>

      <div className="field-label">Start date</div>
      <button className="pick-row" onClick={() => setSheet('date')}>
        <span className="icon-chip">
          <Icon name="calendar" size={18} />
        </span>
        <span className="row-grow">{startDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <Icon name="chevronRight" size={18} />
      </button>

      <div className="field-label">When</div>
      <div className="segmented">
        {TIMES.map((t) => (
          <button key={t} aria-pressed={timeOfDay === t} onClick={() => setTimeOfDay(t)}>
            {TIME_LABELS[t]}
          </button>
        ))}
      </div>

      <TextField id="habit-time" label="Reminder" type="time" value={reminder} onChange={setReminder} />

      <div className="form-actions">
        <button className="btn" onClick={save} disabled={!valid}>
          Save habit
        </button>
        {existing && (
          <button className="btn btn-danger" onClick={remove}>
            Delete habit
          </button>
        )}
      </div>

      {sheet === 'icon' && (
        <Sheet title="Choose icon" onClose={() => setSheet(null)}>
          <div className="icon-grid">
            {HABIT_ICON_KEYS.map((k) => (
              <button
                key={k}
                className="icon-cell"
                aria-pressed={icon === k}
                aria-label={k}
                onClick={() => {
                  setIcon(k)
                  setSheet(null)
                }}
              >
                <HabitIcon name={k} size={24} />
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'date' && (
        <Sheet title="Start date" onClose={() => setSheet(null)}>
          <MonthGrid
            offset={monthOffset}
            setOffset={setMonthOffset}
            cell={(d, { future }) => ({
              className: toKey(d) === start ? 'picked' : '',
              disabled: future,
              onClick: () => {
                setStart(toKey(d))
                setSheet(null)
              },
            })}
          />
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setStart(todayKey)}>
            Use today
          </button>
        </Sheet>
      )}
    </Page>
  )
}
