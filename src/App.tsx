import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Onboarding from './components/Onboarding'
import TabBar from './components/TabBar'
import HabitForm from './components/HabitForm'
import { Icon } from './components/Icons'
import HomeScreen from './screens/HomeScreen'
import StatsScreen from './screens/StatsScreen'
import HabitsScreen from './screens/HabitsScreen'
import AccountScreen from './screens/AccountScreen'
import { createSeedState, loadState, saveState } from './lib/storage'
import type { AppState, Habit, Tab, ThemeName } from './types'

type Editor = { mode: 'new' } | { mode: 'edit'; habit: Habit } | null

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="device">
      <div className="phone">{children}</div>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [tab, setTab] = useState<Tab>('home')
  const [editor, setEditor] = useState<Editor>(null)

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
  }, [state.theme])

  const update = useCallback((fn: (s: AppState) => AppState) => setState(fn), [])

  const toggleDone = (habitId: string, key: string) =>
    update((s) => {
      const list = s.completions[habitId] ?? []
      const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
      return { ...s, completions: { ...s.completions, [habitId]: next } }
    })

  const saveHabit = (habit: Habit) =>
    update((s) => {
      const exists = s.habits.some((h) => h.id === habit.id)
      return {
        ...s,
        habits: exists ? s.habits.map((h) => (h.id === habit.id ? habit : h)) : [...s.habits, habit],
      }
    })

  const deleteHabit = (id: string) =>
    update((s) => {
      const completions = { ...s.completions }
      delete completions[id]
      return { ...s, habits: s.habits.filter((h) => h.id !== id), completions }
    })

  if (!state.onboarded) {
    return (
      <Phone>
        <Onboarding onDone={(name) => update((s) => ({ ...s, name: name.trim(), onboarded: true }))} />
      </Phone>
    )
  }

  return (
    <Phone>
      {tab === 'home' && (
        <HomeScreen state={state} onToggle={toggleDone} onEdit={(habit) => setEditor({ mode: 'edit', habit })} />
      )}
      {tab === 'stats' && <StatsScreen state={state} />}
      {tab === 'habits' && (
        <HabitsScreen
          state={state}
          onAdd={() => setEditor({ mode: 'new' })}
          onEdit={(habit) => setEditor({ mode: 'edit', habit })}
        />
      )}
      {tab === 'account' && (
        <AccountScreen
          state={state}
          onName={(name) => update((s) => ({ ...s, name }))}
          onTheme={(theme: ThemeName) => update((s) => ({ ...s, theme }))}
          onReset={() => update((s) => ({ ...createSeedState(), onboarded: true, name: s.name, theme: s.theme }))}
        />
      )}

      {tab === 'home' && (
        <button className="fab" onClick={() => setEditor({ mode: 'new' })} aria-label="Add habit">
          <Icon name="plus" size={26} />
        </button>
      )}

      <TabBar active={tab} onChange={setTab} />

      {editor && (
        <HabitForm
          habit={editor.mode === 'edit' ? editor.habit : undefined}
          onSave={(h) => {
            saveHabit(h)
            setEditor(null)
          }}
          onDelete={(id) => {
            deleteHabit(id)
            setEditor(null)
          }}
          onClose={() => setEditor(null)}
        />
      )}
    </Phone>
  )
}
