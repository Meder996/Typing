import { useApp, type Route } from './context'
import * as A from './screens/auth'
import Home from './screens/home'
import Mood from './screens/mood'
import Report from './screens/report'
import HabitsList from './screens/habits'
import HabitForm from './screens/habitForm'
import HabitDetail from './screens/habitDetail'
import History from './screens/history'
import Account from './screens/account'
import Board from './screens/board'
import * as S from './screens/settings'

/** Maps each route to its screen. */
export default function RouteView({ route }: { route: Route }) {
  // Re-key on route so each screen starts with fresh local state
  const { stack } = useApp()
  const key = `${stack.length}-${route.name}-${route.id ?? ''}-${route.step ?? ''}-${route.email ?? ''}`
  return <div key={key} className="route">{render(route)}</div>
}

function render(route: Route) {
  switch (route.name) {
    case 'splash': return <A.Splash />
    case 'welcome': return <A.Welcome />
    case 'signup': return <A.SignUp />
    case 'login': return <A.Login />
    case 'forgot': return <A.Forgot />
    case 'otp': return <A.Otp email={route.email ?? ''} />
    case 'reset': return <A.ResetPassword email={route.email ?? ''} />
    case 'question': return <A.Question step={route.step ?? 0} />
    case 'allset': return <A.AllSet />
    case 'home': return <Home />
    case 'mood': return <Mood />
    case 'report': return <Report />
    case 'habits': return <HabitsList />
    case 'board': return <Board />
    case 'account': return <Account />
    case 'habit-new': return <HabitForm />
    case 'habit-edit': return <HabitForm id={route.id} />
    case 'habit-detail': return <HabitDetail id={route.id ?? ''} />
    case 'history': return <History />
    case 'personal': return <S.PersonalInfo />
    case 'billing': return <S.Billing />
    case 'premium': return <S.Premium />
    case 'achievements': return <S.Achievements />
    case 'security': return <S.Security />
    case 'linked': return <S.Linked />
    case 'data': return <S.DataPage />
    case 'preferences': return <S.Preferences />
    case 'language': return <S.Language />
    case 'help': return <S.Help />
    case 'faq': return <S.Faq />
    case 'contact': return <S.Contact />
    case 'privacy': return <S.Privacy />
    case 'terms': return <S.Terms />
    case 'delete': return <S.DeleteAccount />
    default: return null
  }
}
