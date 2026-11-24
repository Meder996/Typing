import { useApp } from '../context'
import { Icon } from '../icons'
import { Page, Row } from '../ui'
import { ACHIEVEMENTS, achievementStats, levelInfo, totalCheckIns } from '../lib/habits'
import { PLANS } from '../constants'
import { startOfDay } from '../lib/date'

export default function Account() {
  const { user, db, setDb, reset, push } = useApp()
  const today = startOfDay(new Date())
  const total = totalCheckIns(user)
  const unlocked = ACHIEVEMENTS.filter((a) => a.test(achievementStats(user, today))).length
  const initial = (user.profile.name || user.profile.email || 'H').charAt(0).toUpperCase()

  const logout = () => {
    setDb((d) => ({ ...d, sessionId: null }))
    reset([{ name: 'login' }])
  }

  return (
    <Page title="Account" eyebrow="Your profile">
      <section className="card profile">
        <div className="avatar big" aria-hidden="true">
          {initial}
        </div>
        <div className="row-grow">
          <div className="row-title">{user.profile.name || 'Your name'}</div>
          <div className="muted small">{user.profile.email || db.accounts.length + ' accounts on this device'}</div>
          {user.plan && <span className="pill">{PLANS[user.plan].label} Premium</span>}
        </div>
      </section>

      <div className="stat-grid three">
        <div className="card center">
          <div className="stat-value">{user.habits.length}</div>
          <div className="muted small">Habits</div>
        </div>
        <div className="card center">
          <div className="stat-value">{total}</div>
          <div className="muted small">Check-ins</div>
        </div>
        <div className="card center">
          <div className="stat-value">{levelInfo(total).level}</div>
          <div className="muted small">Level</div>
        </div>
      </div>

      {!user.plan && (
        <button className="premium-banner" onClick={() => push({ name: 'premium' })}>
          <span className="icon-chip">
            <Icon name="crown" size={18} />
          </span>
          <span className="row-grow">
            <span className="row-title">Upgrade to Premium</span>
            <span className="muted small block">Advanced reports, reminders and badges</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </button>
      )}

      <div className="section-label">Achievements</div>
      <div className="list">
        <Row
          icon="award"
          label="Achievements"
          sub={`${unlocked} of ${ACHIEVEMENTS.length} unlocked · level ${levelInfo(total).level}`}
          onClick={() => push({ name: 'achievements' })}
        />
      </div>

      <div className="section-label">Account</div>
      <div className="list">
        <Row icon="user" label="Personal info" onClick={() => push({ name: 'personal' })} />
        <Row icon="card" label="Billing & subscriptions" onClick={() => push({ name: 'billing' })} />
        <Row icon="shield" label="Account & security" onClick={() => push({ name: 'security' })} />
        <Row icon="link" label="Linked accounts" onClick={() => push({ name: 'linked' })} />
      </div>

      <div className="section-label">Settings</div>
      <div className="list">
        <Row icon="bell" label="Preferences" onClick={() => push({ name: 'preferences' })} />
        <Row icon="file" label="Data & analytics" onClick={() => push({ name: 'data' })} />
      </div>

      <div className="section-label">Support</div>
      <div className="list">
        <Row icon="help" label="Help & support" onClick={() => push({ name: 'help' })} />
        <Row icon="file" label="Privacy policy" onClick={() => push({ name: 'privacy' })} />
        <Row icon="file" label="Terms of service" onClick={() => push({ name: 'terms' })} />
      </div>

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={logout}>
          <Icon name="logout" size={18} /> Log out
        </button>
        <button className="btn btn-danger" onClick={() => push({ name: 'delete' })}>
          Delete account
        </button>
      </div>
    </Page>
  )
}
