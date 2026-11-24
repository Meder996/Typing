import { useState } from 'react'
import { Logo } from './Logo'

export default function Onboarding({ onDone }: { onDone: (name: string) => void }) {
  const [step, setStep] = useState<0 | 1>(0)
  const [name, setName] = useState('')

  if (step === 0) {
    return (
      <div className="splash">
        <Logo size={96} color="#fff" />
        <h1>Habitly</h1>
        <p>Build better habits, one day at a time.</p>
        <button className="btn btn-white splash-btn" onClick={() => setStep(1)}>
          Get started
        </button>
      </div>
    )
  }

  return (
    <form
      className="onboard"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onDone(name)
      }}
    >
      <Logo size={44} color="var(--accent)" />
      <h1 className="big-title" style={{ marginTop: 28 }}>
        Let's get started
      </h1>
      <p className="muted">What should we call you?</p>
      <label className="field-label" htmlFor="onb-name">
        Your name
      </label>
      <input
        id="onb-name"
        className="input"
        autoFocus
        maxLength={24}
        placeholder="e.g. Aigerim"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="spacer" />
      <button className="btn" disabled={!name.trim()}>
        Continue
      </button>
    </form>
  )
}
