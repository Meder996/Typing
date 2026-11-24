import type { CSSProperties, ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import { useApp } from './context'
import { WEEKDAY_LETTERS } from './constants'
import { startOfDay, toKey } from './lib/date'

/** Page with a back button (when there is history) and a title. */
export function Page({
  title,
  eyebrow,
  right,
  children,
}: {
  title: string
  eyebrow?: string
  right?: ReactNode
  children: ReactNode
}) {
  const { stack, pop } = useApp()
  const canBack = stack.length > 1
  if (!canBack) {
    return (
      <div className="screen">
        <header className="header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="title">{title}</h1>
          </div>
          {right}
        </header>
        {children}
      </div>
    )
  }
  return (
    <div className="screen">
      <header className="page-head">
        <button className="icon-btn" onClick={pop} aria-label="Back">
          <Icon name="chevronLeft" />
        </button>
        <h1 className="page-title">{title}</h1>
        <div className="head-end">{right}</div>
      </header>
      {eyebrow && <p className="muted small center page-eyebrow">{eyebrow}</p>}
      {children}
    </div>
  )
}

export function Row({
  icon,
  label,
  sub,
  right,
  onClick,
  danger,
}: {
  icon?: IconName
  label: string
  sub?: string
  right?: ReactNode
  onClick?: () => void
  danger?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`list-row ${danger ? 'danger' : ''} ${onClick ? '' : 'static'}`} onClick={onClick}>
      {icon && (
        <span className="icon-chip">
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="row-grow">
        <span className="row-title">{label}</span>
        {sub && <span className="muted small block">{sub}</span>}
      </span>
      {right}
      {onClick && !right && <Icon name="chevronRight" size={18} />}
    </Tag>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

export function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  maxLength,
  autoComplete,
  autoFocus,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  maxLength?: number
  autoComplete?: string
  autoFocus?: boolean
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="header">
          <span className="head-spacer" />
          <h2 className="sheet-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export interface CellInfo {
  className?: string
  style?: CSSProperties
  label?: ReactNode
  disabled?: boolean
  onClick?: () => void
}

/** Month calendar; `cell` decides how each day looks and whether it is clickable. */
export function MonthGrid({
  offset,
  setOffset,
  cell,
}: {
  offset: number
  setOffset: (n: number) => void
  cell: (d: Date, info: { future: boolean; today: boolean }) => CellInfo | null
}) {
  const today = startOfDay(new Date())
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setOffset(offset - 1)} aria-label="Previous month">
          <Icon name="chevronLeft" />
        </button>
        <span>{first.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
        <button className="icon-btn" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next month">
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
          const c = cell(d, { future, today: isToday })
          const cls = ['cal-day', future ? 'future' : '', isToday ? 'today' : '', c?.className ?? ''].filter(Boolean).join(' ')
          return (
            <button
              key={toKey(d)}
              className={cls}
              style={c?.style}
              disabled={c?.disabled ?? !c?.onClick}
              onClick={c?.onClick}
            >
              {c?.label ?? d.getDate()}
            </button>
          )
        })}
      </div>
    </>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
