import { useState, type FormEvent } from 'react'
import { useApp } from '../context'
import { Icon, type IconName } from '../icons'
import { Logo } from '../components/Logo'
import { Page, TextField } from '../ui'
import { QUESTIONS } from '../constants'
import { newId } from '../lib/habits'
import { emptyUser, hashPassword } from '../lib/storage'

const norm = (s: string) => s.trim().toLowerCase()

export function Splash() {
  const { push } = useApp()
  return (
    <div className="splash">
      <Logo size={96} color="#fff" />
      <h1>Habitly</h1>
      <p>Build better habits, one day at a time.</p>
      <button className="btn btn-white splash-btn" onClick={() => push({ name: 'welcome' })}>
        Get started
      </button>
      <button className="link-btn light" onClick={() => push({ name: 'login' })}>
        I already have an account
      </button>
    </div>
  )
}

const SLIDES: { title: string; text: string; icon: IconName }[] = [
  {
    title: 'Welcome to Habitly – your personal habit tracker',
    text: 'Take control of your routines and track your progress every day.',
    icon: 'target',
  },
  {
    title: 'Explore Habitly features for your journey',
    text: 'Plan habits by time of day, set reminders, and check them off in one tap.',
    icon: 'calendar',
  },
  {
    title: 'Unlock your potential with Habitly',
    text: 'Reports and mood tracking show what really works for you.',
    icon: 'award',
  },
]

export function Welcome() {
  const { push } = useApp()
  const [i, setI] = useState(0)
  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1
  return (
    <div className="onboard">
      <div className="top-row">
        <span />
        <button className="link-btn" onClick={() => push({ name: 'signup' })}>
          Skip
        </button>
      </div>
      <div className="slide-art">
        <span className="slide-icon">
          <Icon name={slide.icon} size={56} />
        </span>
      </div>
      <h1 className="big-title">{slide.title}</h1>
      <p className="muted">{slide.text}</p>
      <div className="dots">
        {SLIDES.map((_, k) => (
          <span key={k} className={k === i ? 'dot on' : 'dot'} />
        ))}
      </div>
      <div className="spacer" />
      <button className="btn" onClick={() => (last ? push({ name: 'signup' }) : setI(i + 1))}>
        {last ? 'Get started' : 'Next'}
      </button>
      <button className="link-btn center" onClick={() => push({ name: 'login' })}>
        I already have an account
      </button>
    </div>
  )
}

export function SignUp() {
  const { db, setDb, reset } = useApp()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const em = norm(email)
    if (!name.trim()) return setError('Please enter your name.')
    if (!/^\S+@\S+\.\S+$/.test(em)) return setError('Enter a valid email address.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    if (db.accounts.some((a) => a.email === em)) return setError('An account with this email already exists.')
    setBusy(true)
    const id = newId()
    const passwordHash = await hashPassword(password)
    // Each new account gets its own empty data: no habits, no check-ins, no moods.
    setDb((d) => ({
      ...d,
      sessionId: id,
      accounts: [...d.accounts, { id, email: em, passwordHash }],
      data: { ...d.data, [id]: { ...emptyUser(name.trim(), em) } },
    }))
    reset([{ name: 'question', step: 0 }])
  }

  return (
    <Page title="Create account">
      <form className="auth-form" onSubmit={submit}>
        <TextField id="su-name" label="Your name" value={name} onChange={setName} placeholder="e.g. Aigerim" maxLength={24} autoFocus />
        <TextField id="su-email" label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
        <TextField id="su-pass" label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" autoComplete="new-password" />
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="btn" type="submit" disabled={busy}>
            Continue
          </button>
        </div>
      </form>
    </Page>
  )
}

export function Login() {
  const { db, setDb, push, reset } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const em = norm(email)
    const acc = db.accounts.find((a) => a.email === em)
    setBusy(true)
    const ok = acc && acc.passwordHash === (await hashPassword(password))
    setBusy(false)
    if (!acc || !ok) return setError('Incorrect email or password.')
    setDb((d) => ({ ...d, sessionId: acc.id }))
    const onboarded = db.data[acc.id]?.onboarded
    reset(onboarded ? [{ name: 'home' }] : [{ name: 'question', step: 0 }])
  }

  return (
    <Page title="Log in">
      <form className="auth-form" onSubmit={submit}>
        <TextField id="li-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" autoFocus />
        <TextField id="li-pass" label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="button" className="link-btn right" onClick={() => push({ name: 'forgot' })}>
          Forgot password?
        </button>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="btn" type="submit" disabled={busy}>
            Log in
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => push({ name: 'signup' })}>
            Create a new account
          </button>
        </div>
      </form>
    </Page>
  )
}

export function Forgot() {
  const { db, push } = useApp()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const em = norm(email)
    if (!db.accounts.some((a) => a.email === em)) return setError('No account uses this email.')
    push({ name: 'otp', email: em })
  }
  return (
    <Page title="Forgot password">
      <form className="auth-form" onSubmit={submit}>
        <p className="muted">Enter the email for your account and we'll send a 4-digit code.</p>
        <TextField id="fp-email" label="Email" type="email" value={email} onChange={setEmail} autoFocus />
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="btn" type="submit">
            Send code
          </button>
        </div>
      </form>
    </Page>
  )
}

export function Otp({ email }: { email: string }) {
  const { push } = useApp()
  const [code, setCode] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.length === 4) push({ name: 'reset', email })
  }
  return (
    <Page title="Enter code">
      <form className="auth-form" onSubmit={submit}>
        <p className="muted">We sent a code to {email}. Demo: any 4 digits will work.</p>
        <label className="sr-only" htmlFor="otp">
          Verification code
        </label>
        <div className="code-wrap">
          {[0, 1, 2, 3].map((k) => (
            <span key={k} className={`code-box ${code[k] ? 'filled' : ''}`}>
              {code[k] ?? ''}
            </span>
          ))}
          <input
            id="otp"
            className="code-input"
            inputMode="numeric"
            maxLength={4}
            value={code}
            autoFocus
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={code.length !== 4}>
            Verify
          </button>
        </div>
      </form>
    </Page>
  )
}

export function ResetPassword({ email }: { email: string }) {
  const { setDb, reset } = useApp()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.length < 6) return setError('Password must be at least 6 characters.')
    if (pw !== confirm) return setError('Passwords do not match.')
    const hash = await hashPassword(pw)
    setDb((d) => ({ ...d, accounts: d.accounts.map((a) => (a.email === email ? { ...a, passwordHash: hash } : a)) }))
    reset([{ name: 'login' }])
  }
  return (
    <Page title="New password">
      <form className="auth-form" onSubmit={submit}>
        <TextField id="rp-new" label="New password" type="password" value={pw} onChange={setPw} autoFocus />
        <TextField id="rp-confirm" label="Confirm password" type="password" value={confirm} onChange={setConfirm} />
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="btn" type="submit">
            Save password
          </button>
        </div>
      </form>
    </Page>
  )
}

export function Question({ step }: { step: number }) {
  const { user, update, push, reset } = useApp()
  const q = QUESTIONS[step]
  const saved = user.answers[q.key]
  const [time, setTime] = useState(typeof saved === 'string' ? saved : (q.defaultValue ?? '08:00'))
  const [single, setSingle] = useState(typeof saved === 'string' ? saved : '')
  const [multi, setMulti] = useState<string[]>(Array.isArray(saved) ? saved : [])

  const canNext = q.kind === 'time' || (q.kind === 'single' ? single !== '' : multi.length > 0)

  const toggleMulti = (opt: string) => setMulti((m) => (m.includes(opt) ? m.filter((x) => x !== opt) : [...m, opt]))

  const next = () => {
    const answer = q.kind === 'time' ? time : q.kind === 'single' ? single : multi
    update((u) => ({ ...u, answers: { ...u.answers, [q.key]: answer } }))
    if (step < QUESTIONS.length - 1) push({ name: 'question', step: step + 1 })
    else reset([{ name: 'allset' }])
  }

  return (
    <Page title={`Question ${step + 1} of ${QUESTIONS.length}`}>
      <div className="progress thin">
        <span style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
      </div>
      <h2 className="question-title">{q.title}</h2>

      {q.kind === 'time' && (
        <div className="card time-card">
          <input
            className="time-input"
            type="time"
            aria-label={q.title}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      )}

      {q.kind === 'single' && (
        <div className="list">
          {q.options?.map((opt) => (
            <button key={opt} className="list-row" onClick={() => setSingle(opt)} aria-pressed={single === opt}>
              <span className="row-grow row-title">{opt}</span>
              <span className={`radio ${single === opt ? 'on' : ''}`} />
            </button>
          ))}
        </div>
      )}

      {q.kind === 'multi' && (
        <div className="list">
          {q.options?.map((opt) => {
            const on = multi.includes(opt)
            return (
              <button key={opt} className="list-row" onClick={() => toggleMulti(opt)} aria-pressed={on}>
                <span className="row-grow row-title">{opt}</span>
                <span className={`checkbox ${on ? 'on' : ''}`}>{on && <Icon name="check" size={14} />}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="spacer" />
      <div className="form-actions">
        <button className="btn" disabled={!canNext} onClick={next}>
          {step < QUESTIONS.length - 1 ? 'Continue' : 'Finish'}
        </button>
      </div>
    </Page>
  )
}

export function AllSet() {
  const { user, update, reset } = useApp()
  return (
    <div className="onboard center-col">
      <span className="slide-icon big">
        <Icon name="check" size={56} />
      </span>
      <h1 className="big-title center">You're all set{user.profile.name ? `, ${user.profile.name}` : ''}!</h1>
      <p className="muted center">
        Your account is ready. It's brand new, so you start with no habits and no check-ins. Create your first habit to begin.
      </p>
      <div className="spacer" />
      <button
        className="btn"
        onClick={() => {
          update((u) => ({ ...u, onboarded: true }))
          reset([{ name: 'home' }])
        }}
      >
        Let's go
      </button>
    </div>
  )
}
