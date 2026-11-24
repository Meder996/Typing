import { Icon } from '../components/Icons'
import { currentStreak, recentRate } from '../lib/habits'
import { startOfDay } from '../lib/date'
import type { AppState, ThemeName } from '../types'

interface Props {
  state: AppState
  onName: (name: string) => void
  onTheme: (t: ThemeName) => void
  onReset: () => void
}

export default function AccountScreen({ state, onName, onTheme, onReset }: Props) {
  const today = startOfDay(new Date())
  const totalDone = state.habits.reduce((n, h) => n + (state.completions[h.id]?.length ?? 0), 0)
  const bestStreak = state.habits.reduce(
    (best, h) => Math.max(best, currentStreak(h, state.completions[h.id] ?? [], today)),
    0,
  )
  const rate = state.habits.reduce(
    (acc, h) => {
      const r = recentRate(h, state.completions[h.id] ?? [], 30, today)
      return { done: acc.done + r.done, total: acc.total + r.total }
    },
    { done: 0, total: 0 },
  )
  const pct = rate.total ? Math.round((rate.done / rate.total) * 100) : 0

  return (
    <div className="screen">
      <header className="header">
        <div>
          <p className="eyebrow">Your profile</p>
          <h1 className="title">Account</h1>
        </div>
      </header>

      <section className="card profile">
        <div className="avatar big" aria-hidden="true">
          {(state.name || 'H').charAt(0).toUpperCase()}
        </div>
        <div className="row-grow">
          <label className="field-label" htmlFor="acc-name" style={{ margin: 0 }}>
            Display name
          </label>
          <input id="acc-name" className="input plain" maxLength={24} value={state.name} onChange={(e) => onName(e.target.value)} />
        </div>
      </section>

      <div className="stat-grid three">
        <div className="card center">
          <div className="stat-value">{state.habits.length}</div>
          <div className="muted small">Habits</div>
        </div>
        <div className="card center">
          <div className="stat-value">{totalDone}</div>
          <div className="muted small">Check-ins</div>
        </div>
        <div className="card center">
          <div className="stat-value">{bestStreak}</div>
          <div className="muted small">Best streak</div>
        </div>
      </div>
      <p className="muted small center">{pct}% completion over the last 30 days</p>

      <div className="section-label">Preferences</div>
      <div className="list">
        <div className="list-row static">
          <span className="icon-chip">
            <Icon name={state.theme === 'dark' ? 'moon' : 'sun'} size={18} />
          </span>
          <span className="row-grow">Appearance</span>
          <div className="segmented mini">
            <button aria-pressed={state.theme === 'dark'} onClick={() => onTheme('dark')}>
              Dark
            </button>
            <button aria-pressed={state.theme === 'light'} onClick={() => onTheme('light')}>
              Light
            </button>
          </div>
        </div>
        <div className="list-row static">
          <span className="icon-chip">
            <Icon name="bell" size={18} />
          </span>
          <span className="row-grow">
            Reminders
            <span className="muted small block">Set a time for each habit in its editor</span>
          </span>
        </div>
      </div>

      <div className="section-label">Data</div>
      <button
        className="btn btn-danger"
        onClick={() => {
          if (window.confirm('Reset to demo data? Your habits and history will be replaced.')) onReset()
        }}
      >
        Reset demo data
      </button>
    </div>
  )
}
