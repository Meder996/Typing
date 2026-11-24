import { useState } from 'react'
import { Icon } from '../components/Icons'
import { COLORS, WEEKDAY_LETTERS } from '../constants'
import { addDays, startOfDay, toKey } from '../lib/date'
import { currentStreak, dayStats, recentRate } from '../lib/habits'
import type { AppState } from '../types'

export default function StatsScreen({ state }: { state: AppState }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const today = startOfDay(new Date())

  // Last 30 days (inclusive of today), across all habits
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29))
  const last30Stats = last30.map((d) => dayStats(state, d))
  const totalDone = last30Stats.reduce((n, s) => n + s.done, 0)
  const totalDue = last30Stats.reduce((n, s) => n + s.total, 0)
  const overallPct = totalDue ? Math.round((totalDone / totalDue) * 100) : 0

  const bestStreak = state.habits.reduce(
    (best, h) => Math.max(best, currentStreak(h, state.completions[h.id] ?? [], today)),
    0,
  )

  const last7 = last30.slice(-7)
  const barValues = last7.map((d) => dayStats(state, d).done)
  const barLabels = last7.map((d) => WEEKDAY_LETTERS[(d.getDay() + 6) % 7])
  const lineValues = last30Stats.map((s) => (s.total ? s.done / s.total : 0))

  const weeklyRates = state.habits.map((h) => ({
    habit: h,
    ...recentRate(h, state.completions[h.id] ?? [], 30, today),
  }))

  return (
    <div className="screen">
      <header className="header">
        <div>
          <p className="eyebrow">Last 30 days</p>
          <h1 className="title">Report</h1>
        </div>
      </header>

      <div className="stat-grid">
        <div className="card">
          <div className="stat-icon"><Icon name="flame" size={18} /></div>
          <div className="stat-value">{bestStreak}</div>
          <div className="muted small">Best current streak (days)</div>
        </div>
        <div className="card">
          <div className="stat-icon"><Icon name="check" size={18} /></div>
          <div className="stat-value">{overallPct}%</div>
          <div className="muted small">Completion rate</div>
        </div>
      </div>

      <section className="card chart-card">
        <div className="card-title">Habits completed</div>
        <p className="muted small">Last 7 days</p>
        <BarChart values={barValues} labels={barLabels} />
      </section>

      <section className="card chart-card">
        <div className="card-title">Completion trend</div>
        <p className="muted small">Daily rate, last 30 days</p>
        <LineChart values={lineValues} />
      </section>

      <section className="card">
        <div className="card-title">By habit</div>
        <div className="bars-list">
          {weeklyRates.length === 0 && <p className="muted small">No habits yet.</p>}
          {weeklyRates.map(({ habit, done, total }) => {
            const p = total ? Math.round((done / total) * 100) : 0
            return (
              <div key={habit.id} className="bar-row">
                <span className="bar-emoji" style={{ background: COLORS[habit.color].bg }}>{habit.emoji}</span>
                <div className="bar-body">
                  <div className="bar-head">
                    <span>{habit.name}</span>
                    <span className="muted small">{p}%</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${p}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <Calendar state={state} today={today} monthOffset={monthOffset} setMonthOffset={setMonthOffset} />
    </div>
  )
}

function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const W = 320
  const H = 150
  const gap = 14
  const max = Math.max(1, ...values)
  const bw = (W - gap * (values.length - 1)) / values.length
  return (
    <svg viewBox={`0 0 ${W} ${H + 26}`} className="chart" role="img" aria-label="Habits completed per day">
      {values.map((v, i) => {
        const h = (v / max) * (H - 26)
        const x = i * (bw + gap)
        const y = H - h
        const active = i === values.length - 1
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 4)} rx={10} className={active ? 'bar bar-active' : 'bar'} />
            <text x={x + bw / 2} y={y - 6} textAnchor="middle" className="chart-value">
              {v}
            </text>
            <text x={x + bw / 2} y={H + 20} textAnchor="middle" className="chart-label">
              {labels[i]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function LineChart({ values }: { values: number[] }) {
  const W = 320
  const H = 150
  const pad = 10
  const step = W / (values.length - 1)
  const pts = values.map((v, i) => [i * step, pad + (1 - v) * (H - pad * 2)] as const)
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${W} ${H} L0 ${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Daily completion rate">
      <defs>
        <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.35 }} />
          <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lineFill)" />
      <path d={line} className="line" />
      {pts.map((p, i) => (i === pts.length - 1 ? <circle key={i} cx={p[0]} cy={p[1]} r={5} className="line-dot" /> : null))}
    </svg>
  )
}

function Calendar({
  state,
  today,
  monthOffset,
  setMonthOffset,
}: {
  state: AppState
  today: Date
  monthOffset: number
  setMonthOffset: (n: number) => void
}) {
  const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <section className="card">
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setMonthOffset(monthOffset - 1)} aria-label="Previous month">
          <Icon name="chevronLeft" />
        </button>
        <span>{first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
        <button className="icon-btn" onClick={() => setMonthOffset(monthOffset + 1)} disabled={monthOffset >= 0} aria-label="Next month">
          <Icon name="chevronRight" />
        </button>
      </div>
      <div className="cal-grid">
        {WEEKDAY_LETTERS.map((w, i) => (
          <div key={i} className="cal-head">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const future = d > today
          const isToday = toKey(d) === toKey(today)
          const { done, total } = dayStats(state, d)
          const rate = total ? done / total : 0
          const style = !future && rate > 0 && rate < 1 ? { background: `rgba(139,133,233,${0.18 + 0.6 * rate})` } : undefined
          const cls = ['cal-day', future ? 'future' : '', isToday ? 'today' : '', !future && total && rate === 1 ? 'full' : '']
            .filter(Boolean)
            .join(' ')
          return (
            <div key={toKey(d)} className={cls} style={style} title={`${done}/${total} done`}>
              {d.getDate()}
            </div>
          )
        })}
      </div>
      <div className="legend">
        <span className="legend-dot" style={{ background: 'rgba(139,133,233,.25)' }} /> some
        <span className="legend-dot" style={{ background: 'var(--accent)' }} /> all done
      </div>
    </section>
  )
}
