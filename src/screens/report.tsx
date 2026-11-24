import { useState } from 'react'
import { useApp } from '../context'
import { Icon } from '../icons'
import { COLORS, WEEKDAY_LETTERS } from '../constants'
import { addDays, startOfDay } from '../lib/date'
import { dayStats, recentRate } from '../lib/habits'
import { MonthGrid, Page, Empty } from '../ui'

export default function Report() {
  const { user } = useApp()
  const [offset, setOffset] = useState(0)
  const today = startOfDay(new Date())

  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29))
  const stats30 = last30.map((d) => dayStats(user, d))
  const totalDone = stats30.reduce((n, s) => n + s.done, 0)
  const totalDue = stats30.reduce((n, s) => n + s.total, 0)
  const overallPct = totalDue ? Math.round((totalDone / totalDue) * 100) : 0

  const last7 = last30.slice(-7)
  const barValues = last7.map((d) => dayStats(user, d).done)
  const barLabels = last7.map((d) => WEEKDAY_LETTERS[(d.getDay() + 6) % 7])
  const lineValues = stats30.map((s) => (s.total ? s.done / s.total : 0))

  if (user.habits.length === 0) {
    return (
      <Page title="Report" eyebrow="Last 30 days">
        <Empty>Your report appears once you have habits and check-ins.</Empty>
      </Page>
    )
  }

  return (
    <Page title="Report" eyebrow="Last 30 days">
      <div className="stat-grid">
        <div className="card">
          <div className="stat-icon">
            <Icon name="check" size={18} />
          </div>
          <div className="stat-value">{totalDone}</div>
          <div className="muted small">Check-ins in 30 days</div>
        </div>
        <div className="card">
          <div className="stat-icon">
            <Icon name="check" size={18} />
          </div>
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
          {user.habits.map((h) => {
            const r = recentRate(h, user.completions[h.id] ?? [], 30, today)
            const p = r.total ? Math.round((r.done / r.total) * 100) : 0
            return (
              <div key={h.id} className="bar-row">
                <span className="bar-emoji" style={{ background: COLORS[h.color].bg }}>
                  <Icon name={h.icon} size={18} />
                </span>
                <div className="bar-body">
                  <div className="bar-head">
                    <span>{h.name}</span>
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

      <section className="card chart-card">
        <div className="card-title">Monthly calendar</div>
        <p className="muted small">Darker days mean more habits done.</p>
        <MonthGrid
          offset={offset}
          setOffset={setOffset}
          cell={(d, { future }) => {
            const { done, total } = dayStats(user, d)
            const rate = total ? done / total : 0
            return {
              style:
                !future && rate > 0 && rate < 1
                  ? { background: `rgba(139,133,233,${0.18 + 0.6 * rate})` }
                  : undefined,
              className: !future && total > 0 && rate === 1 ? 'full' : undefined,
              disabled: true,
            }
          }}
        />
      </section>
    </Page>
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
            <rect x={x} y={y} width={bw} height={Math.max(h, v ? 4 : 2)} rx={10} className={active ? 'bar bar-active' : 'bar'} />
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
  const last = pts[pts.length - 1]
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
      <circle cx={last[0]} cy={last[1]} r={5} className="line-dot" />
    </svg>
  )
}
