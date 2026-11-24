import { useState, type FormEvent } from 'react'
import { Icon } from './Icons'
import { ALL_DAYS, COLORS, COLOR_KEYS, EMOJIS, TIMES, TIME_LABELS, WEEKDAYS, WEEKDAY_LETTERS, WEEKDAYS_ONLY, WEEKEND_ONLY } from '../constants'
import { toKey, startOfDay } from '../lib/date'
import { newId } from '../lib/habits'
import type { ColorKey, Habit, TimeOfDay } from '../types'

interface Props {
  habit?: Habit
  onSave: (habit: Habit) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d))

export default function HabitForm({ habit, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(habit?.name ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? EMOJIS[0])
  const [color, setColor] = useState<ColorKey>(habit?.color ?? 'lavender')
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(habit?.timeOfDay ?? 'morning')
  const [days, setDays] = useState<number[]>(habit?.days ?? ALL_DAYS)
  const [reminder, setReminder] = useState(habit?.reminder ?? '08:00')

  const valid = name.trim().length > 0 && days.length > 0

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    onSave({
      id: habit?.id ?? newId(),
      name: name.trim(),
      emoji,
      color,
      timeOfDay,
      days,
      reminder,
      createdAt: habit?.createdAt ?? toKey(startOfDay(new Date())),
    })
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-grip" />
        <div className="header">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
          <h2 className="sheet-title">{habit ? 'Edit habit' : 'Create new habit'}</h2>
          <span style={{ width: 40 }} />
        </div>

        <div className="habit-card preview" style={{ background: COLORS[color].bg }}>
          <span className="habit-emoji">{emoji}</span>
          <div className="habit-info">
            <div className="habit-name">{name.trim() || 'Your habit'}</div>
            <div className="habit-meta">
              {TIME_LABELS[timeOfDay]} · {days.length === 7 ? 'Every day' : `${days.length} days a week`}
            </div>
          </div>
        </div>

        <label className="field-label" htmlFor="habit-name">
          Habit name
        </label>
        <input
          id="habit-name"
          className="input"
          maxLength={40}
          placeholder="e.g. Read 20 pages"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="field-label">Icon</div>
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              className="emoji-btn"
              aria-pressed={e === emoji}
              aria-label={`Icon ${e}`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="field-label">Color</div>
        <div className="swatches">
          {COLOR_KEYS.map((k) => (
            <button
              type="button"
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
        <div className="chips">
          <button type="button" className="chip" aria-pressed={sameDays(days, ALL_DAYS)} onClick={() => setDays(ALL_DAYS)}>
            Every day
          </button>
          <button type="button" className="chip" aria-pressed={sameDays(days, WEEKDAYS_ONLY)} onClick={() => setDays(WEEKDAYS_ONLY)}>
            Weekdays
          </button>
          <button type="button" className="chip" aria-pressed={sameDays(days, WEEKEND_ONLY)} onClick={() => setDays(WEEKEND_ONLY)}>
            Weekends
          </button>
        </div>
        <div className="day-chips" style={{ marginTop: 12 }}>
          {WEEKDAYS.map((w, i) => (
            <button
              type="button"
              key={w}
              className="day-chip"
              aria-label={w}
              aria-pressed={days.includes(i)}
              onClick={() => toggleDay(i)}
            >
              {WEEKDAY_LETTERS[i]}
            </button>
          ))}
        </div>

        <div className="field-label">When</div>
        <div className="segmented">
          {TIMES.map((t) => (
            <button type="button" key={t} aria-pressed={timeOfDay === t} onClick={() => setTimeOfDay(t)}>
              {TIME_LABELS[t]}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="habit-time">
          Reminder
        </label>
        <input id="habit-time" type="time" className="input" value={reminder} onChange={(e) => setReminder(e.target.value)} />

        <div className="form-actions">
          <button type="submit" className="btn" disabled={!valid}>
            Save habit
          </button>
          {habit && onDelete && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm(`Delete "${habit.name}"? Its history will be removed.`)) onDelete(habit.id)
              }}
            >
              Delete habit
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
