import { useState } from 'react'
import { useApp } from '../context'
import { Icon, MoodFace } from '../icons'
import { MOODS, MOOD_COLORS } from '../constants'
import { formatShortDate, parseKey, startOfDay, toKey } from '../lib/date'
import { MonthGrid, Page, Empty } from '../ui'

export default function Mood() {
  const { user, update } = useApp()
  const [offset, setOffset] = useState(0)
  const today = startOfDay(new Date())
  const todayKey = toKey(today)
  const [selected, setSelected] = useState(todayKey)
  const level = user.moods[selected]
  const isToday = selected === todayKey

  const setMood = (lvl: number) => update((u) => ({ ...u, moods: { ...u.moods, [selected]: lvl } }))

  const history = Object.entries(user.moods)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 10)

  return (
    <Page title="Mood" eyebrow={today.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}>
      <section className="card">
        <div className="card-title">{isToday ? "How's your mood today?" : `How was ${formatShortDate(parseKey(selected))}?`}</div>
        <div className="mood-row">
          {MOODS.map((label, i) => (
            <button
              key={label}
              className={`mood-btn ${level === i ? 'on' : ''}`}
              aria-pressed={level === i}
              onClick={() => setMood(i)}
              style={{ background: level === i ? MOOD_COLORS[i] : undefined }}
            >
              <MoodFace level={i} size={30} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {!isToday && (
          <button className="link-btn" onClick={() => setSelected(todayKey)}>
            Back to today
          </button>
        )}
      </section>

      <section className="card chart-card">
        <div className="card-title">Mood calendar</div>
        <p className="muted small">Tap a past day to log or change its mood.</p>
        <MonthGrid
          offset={offset}
          setOffset={setOffset}
          cell={(d, { future }) => {
            const lvl = user.moods[toKey(d)]
            return {
              style: lvl !== undefined ? { background: MOOD_COLORS[lvl], color: '#181A20' } : undefined,
              disabled: future,
              onClick: future ? undefined : () => setSelected(toKey(d)),
            }
          }}
        />
        <div className="legend">
          {MOODS.map((m, i) => (
            <span key={m} className="legend-item">
              <span className="legend-dot" style={{ background: MOOD_COLORS[i] }} />
              {m}
            </span>
          ))}
        </div>
      </section>

      <div className="section-label">Recent entries</div>
      {history.length === 0 ? (
        <Empty>No mood entries yet. Pick how you feel today.</Empty>
      ) : (
        <div className="list">
          {history.map(([key, lvl]) => (
            <div key={key} className="list-row static">
              <span className="mood-chip" style={{ background: MOOD_COLORS[lvl] }}>
                <MoodFace level={lvl} size={22} />
              </span>
              <span className="row-grow">
                <span className="row-title">{MOODS[lvl]}</span>
                <span className="muted small block">{formatShortDate(parseKey(key))}</span>
              </span>
              <Icon name="smile" size={16} />
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}
