import { memo, useMemo, type ReactNode } from 'react'
import { NavigationType, Outlet, UNSAFE_LocationContext as LocationContext, useNavigationType, type Location } from 'react-router'
import { KEPT_TABS, type KeptTab, type useKeptLocations } from '../hooks/useKeptLocations'
import HomePage from '../pages/HomePage'
import FlightsPage from '../pages/FlightsPage'
import MapPage from '../pages/MapPage'
import styles from './KeptTabs.module.css'

// The Feed, My Flights and Map keep their state when you go to another tab: scroll position,
// an open flight or comments, the Map's filters and view, their live maps. Once visited, a tab's
// page stays mounted, just hidden, and shows again exactly as it was left. The other tab pages
// (Goal, Profile) come and go through the router's <Outlet> as usual.
//
// A hidden page goes on seeing the location it was last at (React Router's location context),
// so it doesn't react to the URL of the tab being looked at (closing an open flight, say).

export default function KeptTabs({ current, saved, location }: ReturnType<typeof useKeptLocations>) {
  const navigationType = useNavigationType()
  return (
    <>
      {KEPT_TABS.map((tab) => {
        const active = tab === current
        const at = active ? location : saved[tab]
        if (!at) return null // not visited yet
        return (
          <KeptPage key={tab} tab={tab} active={active} location={at} navigationType={active ? navigationType : NavigationType.Pop} />
        )
      })}
      {!current && <Outlet />}
    </>
  )
}

// Memoized, so a hidden page isn't re-rendered while another tab is used.
const KeptPage = memo(function KeptPage({
  tab,
  active,
  location,
  navigationType,
}: {
  tab: KeptTab
  active: boolean
  location: Location
  navigationType: NavigationType
}) {
  const value = useMemo(() => ({ location, navigationType }), [location, navigationType])
  return (
    <div className={`${styles.page} ${active ? '' : styles.hidden}`} inert={!active} aria-hidden={!active || undefined}>
      <LocationContext.Provider value={value}>{PAGES[tab]}</LocationContext.Provider>
    </div>
  )
})

const PAGES: Record<KeptTab, ReactNode> = {
  feed: <HomePage />,
  flights: <FlightsPage />,
  map: <MapPage />,
}
