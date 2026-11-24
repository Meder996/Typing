import { useState, type FormEvent } from 'react'
import { useApp } from '../context'
import { Icon } from '../icons'
import { LANGUAGES, PAYMENT_METHODS, PLANS, PREMIUM_FEATURES } from '../constants'
import { ACHIEVEMENTS, achievementStats, levelInfo, totalCheckIns } from '../lib/habits'
import { startOfDay } from '../lib/date'
import { hashPassword } from '../lib/storage'
import { Empty, Page, Row, TextField, Toggle } from '../ui'
import type { LinkKey, PlanKey, ThemeName, UserData } from '../types'

export function PersonalInfo() {
  const { user, update } = useApp()
  const [p, setP] = useState(user.profile)
  const [saved, setSaved] = useState(false)
  return (
    <Page title="Personal info">
      <TextField id="pi-name" label="Full name" value={p.name} onChange={(v) => setP({ ...p, name: v })} maxLength={40} />
      <TextField id="pi-email" label="Email" type="email" value={p.email} onChange={(v) => setP({ ...p, email: v })} />
      <TextField id="pi-phone" label="Phone" type="tel" value={p.phone} onChange={(v) => setP({ ...p, phone: v })} />
      <TextField id="pi-birth" label="Birthday" type="date" value={p.birthday} onChange={(v) => setP({ ...p, birthday: v })} />
      <div className="form-actions">
        <button
          className="btn"
          onClick={() => {
            update((u) => ({ ...u, profile: { ...p, name: p.name.trim(), email: p.email.trim().toLowerCase() } }))
            setSaved(true)
          }}
        >
          Save changes
        </button>
        {saved && <p className="muted small center">Saved.</p>}
      </div>
    </Page>
  )
}

export function Billing() {
  const { user, update, push } = useApp()
  const plan = user.plan
  return (
    <Page title="Billing & subscriptions">
      <section className="card plan-card">
        <p className="eyebrow">Current plan</p>
        <div className="stat-value">{plan ? `${PLANS[plan].label} Premium` : 'Free'}</div>
        <p className="muted small">
          {plan ? `${PLANS[plan].price}${PLANS[plan].period} · ${PLANS[plan].note}` : 'Upgrade to unlock advanced reports, reminders and more.'}
        </p>
        <button className="btn" onClick={() => push({ name: 'premium' })} style={{ marginTop: 14 }}>
          {plan ? 'Change plan' : 'Upgrade to Premium'}
        </button>
        {plan && (
          <button className="btn btn-danger" style={{ marginTop: 10 }} onClick={() => update((u) => ({ ...u, plan: null }))}>
            Cancel subscription
          </button>
        )}
      </section>

      <div className="section-label">Payment method</div>
      {user.payment ? (
        <div className="list">
          <Row
            icon="card"
            label={user.payment.last4 ? `Card •••• ${user.payment.last4}` : user.payment.method}
            sub={user.payment.holder || undefined}
          />
        </div>
      ) : (
        <Empty>No payment method added.</Empty>
      )}

      <div className="section-label">Invoices</div>
      {plan ? (
        <div className="list">
          <Row icon="file" label={`${PLANS[plan].label} Premium`} sub={`${PLANS[plan].price} · paid`} />
        </div>
      ) : (
        <Empty>No invoices yet.</Empty>
      )}
    </Page>
  )
}

export function Premium() {
  const { update, pop } = useApp()
  const [plan, setPlan] = useState<PlanKey>('yearly')
  const [method, setMethod] = useState<'card' | 'apple' | 'google' | 'paypal'>('card')
  const [card, setCard] = useState({ number: '', expiry: '', holder: '' })
  const [error, setError] = useState('')

  const subscribe = (e: FormEvent) => {
    e.preventDefault()
    const digits = card.number.replace(/\s/g, '')
    if (method === 'card' && (digits.length < 12 || !card.expiry.trim() || !card.holder.trim())) {
      return setError('Enter your card number, expiry and name.')
    }
    const label = PAYMENT_METHODS.find((m) => m.id === method)?.label ?? 'Payment'
    update((u) => ({
      ...u,
      plan,
      payment: { method: label, last4: method === 'card' ? digits.slice(-4) : null, holder: method === 'card' ? card.holder.trim() : '' },
    }))
    pop()
  }

  return (
    <Page title="Premium">
      <section className="card premium-hero">
        <span className="icon-chip big">
          <Icon name="crown" size={26} />
        </span>
        <div className="card-title">Habitly Premium</div>
        <ul className="feature-list">
          {PREMIUM_FEATURES.map((f) => (
            <li key={f}>
              <Icon name="check" size={16} /> {f}
            </li>
          ))}
        </ul>
      </section>

      <div className="section-label">Choose a plan</div>
      <div className="plan-options">
        {(Object.keys(PLANS) as PlanKey[]).map((k) => (
          <button key={k} className={`plan-option ${plan === k ? 'on' : ''}`} aria-pressed={plan === k} onClick={() => setPlan(k)}>
            <span className="muted small">{PLANS[k].label}</span>
            <span className="stat-value small-value">{PLANS[k].price}</span>
            <span className="muted small">{PLANS[k].period}</span>
          </button>
        ))}
      </div>

      <div className="section-label">Payment method</div>
      <div className="list">
        {PAYMENT_METHODS.map((m) => (
          <button key={m.id} className="list-row" aria-pressed={method === m.id} onClick={() => setMethod(m.id)}>
            <span className="icon-chip">
              <Icon name={m.icon} size={18} />
            </span>
            <span className="row-grow row-title">{m.label}</span>
            <span className={`radio ${method === m.id ? 'on' : ''}`} />
          </button>
        ))}
      </div>

      <form onSubmit={subscribe}>
        {method === 'card' && (
          <>
            <TextField id="card-num" label="Card number" value={card.number} onChange={(v) => setCard({ ...card, number: v })} placeholder="1234 5678 9012 3456" />
            <TextField id="card-exp" label="Expiry" value={card.expiry} onChange={(v) => setCard({ ...card, expiry: v })} placeholder="MM/YY" />
            <TextField id="card-name" label="Name on card" value={card.holder} onChange={(v) => setCard({ ...card, holder: v })} />
          </>
        )}
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="btn" type="submit">
            Subscribe · {PLANS[plan].price}
            {PLANS[plan].period}
          </button>
        </div>
      </form>
    </Page>
  )
}

export function Achievements() {
  const { user } = useApp()
  const today = startOfDay(new Date())
  const stats = achievementStats(user, today)
  const lvl = levelInfo(totalCheckIns(user))
  return (
    <Page title="Achievements">
      <section className="card">
        <div className="summary-row">
          <div>
            <p className="eyebrow">Level</p>
            <div className="stat-value">{lvl.level}</div>
          </div>
          <div className="muted small right-text">{lvl.toNext} check-ins to next level</div>
        </div>
        <div className="progress" style={{ marginTop: 12 }}>
          <span style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
        </div>
      </section>
      <div className="badge-grid">
        {ACHIEVEMENTS.map((a) => {
          const on = a.test(stats)
          return (
            <div key={a.id} className={`badge ${on ? 'on' : ''}`}>
              <span className="badge-icon">
                <Icon name={on ? 'award' : 'lock'} size={22} />
              </span>
              <span className="row-title">{a.title}</span>
              <span className="muted small">{a.desc}</span>
            </div>
          )
        })}
      </div>
    </Page>
  )
}

export function Security() {
  const { user, update, db, setDb } = useApp()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState('')
  const account = db.accounts.find((a) => a.id === db.sessionId)

  const change = async (e: FormEvent) => {
    e.preventDefault()
    if (!account) return
    if (account.passwordHash !== (await hashPassword(current))) return setMsg('Current password is incorrect.')
    if (next.length < 6) return setMsg('New password must be at least 6 characters.')
    const hash = await hashPassword(next)
    setDb((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === account.id ? { ...a, passwordHash: hash } : a)) }))
    setCurrent('')
    setNext('')
    setMsg('Password updated.')
  }

  return (
    <Page title="Account & security">
      <form onSubmit={change}>
        <TextField id="sec-cur" label="Current password" type="password" value={current} onChange={setCurrent} />
        <TextField id="sec-new" label="New password" type="password" value={next} onChange={setNext} />
        {msg && <p className="muted small">{msg}</p>}
        <div className="form-actions">
          <button className="btn" type="submit">
            Change password
          </button>
        </div>
      </form>
      <div className="section-label">Protection</div>
      <div className="list">
        <Row
          icon="lock"
          label="Two-factor authentication"
          sub="Ask for a code when logging in"
          right={<Toggle label="Two-factor authentication" checked={user.twoFactor} onChange={(v) => update((u) => ({ ...u, twoFactor: v }))} />}
        />
      </div>
    </Page>
  )
}

const LINKS: { key: LinkKey; label: string }[] = [
  { key: 'google', label: 'Google' },
  { key: 'apple', label: 'Apple' },
  { key: 'facebook', label: 'Facebook' },
]

export function Linked() {
  const { user, update } = useApp()
  const setLink = (key: LinkKey, on: boolean) => update((u) => ({ ...u, linked: { ...u.linked, [key]: on } }))
  return (
    <Page title="Linked accounts">
      <div className="list">
        {LINKS.map((l) => (
          <Row
            key={l.key}
            icon="link"
            label={l.label}
            sub={user.linked[l.key] ? 'Connected' : 'Not connected'}
            right={
              <button className="chip" aria-pressed={user.linked[l.key]} onClick={() => setLink(l.key, !user.linked[l.key])}>
                {user.linked[l.key] ? 'Disconnect' : 'Connect'}
              </button>
            }
          />
        ))}
      </div>
    </Page>
  )
}

export function DataPage() {
  const { user, update } = useApp()
  const exportData = () => {
    const blob = new Blob([JSON.stringify(user, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'habitly-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const clearCheckIns = () => {
    if (!window.confirm('Clear all check-ins and moods? Your habits stay.')) return
    update((u: UserData) => ({ ...u, completions: {}, moods: {} }))
  }
  return (
    <Page title="Data & analytics">
      <div className="list">
        <Row
          icon="info"
          label="Share anonymous analytics"
          sub="Helps us improve Habitly"
          right={<Toggle label="Share anonymous analytics" checked={user.analytics} onChange={(v) => update((u) => ({ ...u, analytics: v }))} />}
        />
        <Row icon="download" label="Export my data" sub="Download your habits and check-ins as JSON" onClick={exportData} />
      </div>
      <div className="section-label">Danger zone</div>
      <button className="btn btn-danger" onClick={clearCheckIns}>
        Clear check-ins and moods
      </button>
    </Page>
  )
}

export function Preferences() {
  const { user, update, push } = useApp()
  const setTheme = (t: ThemeName) => update((u) => ({ ...u, theme: t }))
  return (
    <Page title="Preferences">
      <div className="list">
        <Row
          icon="bell"
          label="Reminders"
          sub="Notify me at each habit's reminder time"
          right={<Toggle label="Reminders" checked={user.reminders} onChange={(v) => update((u) => ({ ...u, reminders: v }))} />}
        />
        <div className="list-row static">
          <span className="icon-chip">
            <Icon name={user.theme === 'dark' ? 'moon' : 'sun'} size={18} />
          </span>
          <span className="row-grow row-title">Appearance</span>
          <div className="segmented mini">
            <button aria-pressed={user.theme === 'dark'} onClick={() => setTheme('dark')}>
              Dark
            </button>
            <button aria-pressed={user.theme === 'light'} onClick={() => setTheme('light')}>
              Light
            </button>
          </div>
        </div>
        <Row icon="globe" label="App language" sub={user.language} onClick={() => push({ name: 'language' })} />
      </div>
    </Page>
  )
}

export function Language() {
  const { user, update } = useApp()
  return (
    <Page title="App language">
      <div className="list">
        {LANGUAGES.map((l) => (
          <button key={l} className="list-row" aria-pressed={user.language === l} onClick={() => update((u) => ({ ...u, language: l }))}>
            <span className="row-grow row-title">{l}</span>
            <span className={`radio ${user.language === l ? 'on' : ''}`} />
          </button>
        ))}
      </div>
      <p className="muted small">Your choice is saved to your account. Screens are currently shown in English.</p>
    </Page>
  )
}

export function Help() {
  const { push } = useApp()
  return (
    <Page title="Help & support">
      <div className="list">
        <Row icon="help" label="FAQ" onClick={() => push({ name: 'faq' })} />
        <Row icon="send" label="Contact support" onClick={() => push({ name: 'contact' })} />
        <Row icon="file" label="Privacy policy" onClick={() => push({ name: 'privacy' })} />
        <Row icon="file" label="Terms of service" onClick={() => push({ name: 'terms' })} />
      </div>
    </Page>
  )
}

const FAQS = [
  ['How do I create a habit?', 'Tap + on Home or Habits, choose a name, icon, color, schedule, and reminder, then save.'],
  ['Why does my new account look empty?', 'Each account has its own data. A new account starts with no habits and no check-ins.'],
  ['How do I change a habit?', 'Open the habit from Home or Habits, then tap the edit icon.'],
  ['Can I use Habitly on several accounts?', 'Yes. Log out and sign in with another account. Each one keeps its own data on this device.'],
]

export function Faq() {
  return (
    <Page title="FAQ">
      <div className="list">
        {FAQS.map(([q, a]) => (
          <details key={q} className="faq">
            <summary>
              {q}
              <Icon name="chevronDown" size={18} />
            </summary>
            <p className="muted small">{a}</p>
          </details>
        ))}
      </div>
    </Page>
  )
}

export function Contact() {
  const { user } = useApp()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  if (sent) {
    return (
      <Page title="Contact support">
        <Empty>Thanks! We received your message and will reply to {user.profile.email || 'your email'}.</Empty>
      </Page>
    )
  }
  return (
    <Page title="Contact support">
      <TextField id="ct-subject" label="Subject" value={subject} onChange={setSubject} maxLength={80} />
      <div className="field">
        <label className="field-label" htmlFor="ct-msg">
          Message
        </label>
        <textarea id="ct-msg" className="input textarea" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="form-actions">
        <button className="btn" disabled={!subject.trim() || !message.trim()} onClick={() => setSent(true)}>
          Send message
        </button>
      </div>
    </Page>
  )
}

export function Privacy() {
  return (
    <Page title="Privacy policy">
      <div className="legal">
        <p>Habitly stores your habits, check-ins, and moods on this device so you can use the app offline.</p>
        <p>We do not sell your personal data. Analytics sharing is off by default and can be changed in Data & analytics.</p>
        <p>You can export your data as JSON or delete your account at any time from the Account tab.</p>
      </div>
    </Page>
  )
}

export function Terms() {
  return (
    <Page title="Terms of service">
      <div className="legal">
        <p>By using Habitly you agree to use the app for personal habit tracking.</p>
        <p>Premium plans renew automatically until cancelled from Billing & subscriptions.</p>
        <p>Habitly is provided as is, without guarantees of uninterrupted availability.</p>
      </div>
    </Page>
  )
}

export function DeleteAccount() {
  const { db, setDb, reset } = useApp()
  const [text, setText] = useState('')
  const remove = () => {
    const id = db.sessionId
    if (!id) return
    setDb((d) => {
      const data = { ...d.data }
      delete data[id]
      return { sessionId: null, accounts: d.accounts.filter((a) => a.id !== id), data }
    })
    reset([{ name: 'splash' }])
  }
  return (
    <Page title="Delete account">
      <div className="legal">
        <p>This permanently deletes your account, habits, check-ins, and moods from this device.</p>
      </div>
      <TextField id="del-confirm" label='Type "DELETE" to confirm' value={text} onChange={setText} />
      <div className="form-actions">
        <button className="btn btn-danger" disabled={text !== 'DELETE'} onClick={remove}>
          Delete my account
        </button>
      </div>
    </Page>
  )
}
