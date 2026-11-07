import { NavLink, Outlet } from 'react-router'
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
  return (
    <div className="app">
      <Outlet />
      <nav className={styles.tabbar} aria-label="Main">
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
