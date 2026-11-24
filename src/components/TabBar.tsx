import { Icon, type IconName } from '../icons'
import type { RouteName } from '../context'

const TABS: { id: RouteName; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'mood', label: 'Mood', icon: 'smile' },
  { id: 'report', label: 'Report', icon: 'chart' },
  { id: 'habits', label: 'Habits', icon: 'grid' },
  { id: 'board', label: 'Board', icon: 'board' },
  { id: 'account', label: 'Account', icon: 'user' },
]

/** Side navigation on wide screens, bottom bar on phones (only on the main tabs). */
export default function TabBar({
  active,
  onChange,
  mobileVisible,
}: {
  active: RouteName
  onChange: (t: RouteName) => void
  mobileVisible: boolean
}) {
  return (
    <nav className={`tabbar ${mobileVisible ? '' : 'off-tab'}`} aria-label="Main">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
        Habitly
      </div>
      {TABS.map((t) => (
        <button key={t.id} className="tab" aria-current={active === t.id ? 'page' : undefined} onClick={() => onChange(t.id)}>
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
