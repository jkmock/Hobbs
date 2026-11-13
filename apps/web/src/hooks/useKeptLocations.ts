import { useState } from 'react'
import { useLocation, type Location } from 'react-router'

// The Feed, My Flights and Map keep their state when you go to another tab (KeptTabs): once
// visited, a tab's page stays mounted, hidden, at the location it was left at.

export type KeptTab = 'feed' | 'flights' | 'map'
export const KEPT_TABS: KeptTab[] = ['feed', 'flights', 'map']

// Which kept tab a path belongs to, if any.
export function keptTabOf(pathname: string): KeptTab | null {
  if (pathname === '/' || pathname.startsWith('/feed/')) return 'feed'
  if (pathname === '/flights' || pathname.startsWith('/flights/')) return 'flights'
  if (pathname === '/map') return 'map'
  return null
}

// Where each visited kept tab was last: for showing it, hidden, as it was, and for going back to it.
export function useKeptLocations() {
  const location = useLocation()
  const current = keptTabOf(location.pathname)
  const [saved, setSaved] = useState<Partial<Record<KeptTab, Location>>>({})
  // Kept up to date as the location changes (set during render, so it's never a render behind).
  if (current && saved[current] !== location) setSaved({ ...saved, [current]: location })
  return { current, saved: current ? { ...saved, [current]: location } : saved, location }
}
