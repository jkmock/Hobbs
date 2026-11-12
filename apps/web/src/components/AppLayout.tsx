import { NavLink, Outlet, useMatch } from 'react-router'
import { BookOpen, CircleUser, Flag, House, Map } from 'lucide-react'
import styles from './AppLayout.module.css'

const TABS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/flights', label: 'Flights', icon: BookOpen },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/goal', label: 'Goal', icon: Flag },
  { to: '/profile', label: 'Profile', icon: CircleUser },
]

// Pages with the bottom tab bar.
export function TabLayout() {
  // A flight's page (part of My flights, or of the social feed) is full screen, so the tab
  // bar slides away.
  const onMyFlight = useMatch('/flights/:id') !== null
  const onFeedFlight = useMatch('/feed/:id') !== null
  const onFlight = onMyFlight || onFeedFlight
  return (
    <div className="app">
      <Outlet />
      <nav className={`${styles.tabbar} ${onFlight ? styles.tabbarHidden : ''}`} aria-label="Main" inert={onFlight}>
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={styles.tab}>
            <Icon size={21} strokeWidth={1.75} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

// Full-screen pages: log flight, friends, settings, login.
export function BareLayout() {
  return (
    <div className="app">
      <Outlet />
    </div>
  )
}
