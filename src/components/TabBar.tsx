import { Icon, type IconName } from './Icons'
import type { Tab } from '../types'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'stats', label: 'Report', icon: 'chart' },
  { id: 'habits', label: 'Habits', icon: 'grid' },
  { id: 'account', label: 'Account', icon: 'user' },
]

export default function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          className="tab"
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
