import { Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { LazyFlightMap as FlightMap } from './LazyFlightMap'
import { useKeptRoutes, type KeptTab } from '../hooks/useKeptMaps'
import { useAllFlights } from '../hooks/useFlights'
import { hasKeptMap, hasParkedMap, keepReady, routeKey } from '../lib/mapPool'
import { MAP_TAB_FIT_PADDING, MAP_TAB_SLOT } from '../lib/mapTab'
import styles from './LiveRouteMap.module.css'

const START_AFTER_MS = 1200 // let the page being looked at load its own maps first
const GIVE_UP_MS = 15_000 // a map that never finishes loading (offline) doesn't hold up the rest

type Tab = KeptTab | 'map'

// Builds the other tabs' maps ahead of time, so their first visit shows them already drawn
// (tabs already open, kept in the background by KeptTabs, have theirs):
// the top mini maps of the Feed and My Flights (hooks/useKeptMaps), then the Map tab's map.
// Each is drawn off screen at the size it'll be shown at, one at a time; once drawn it's put
// aside in its kept slot (lib/mapPool), where its page takes it when it opens. Going to a tab
// mid-build stops the preloader; the map, partly loaded, is set aside for the page to finish.
export default function MapPreloader({ open }: { open: string[] }) {
  const { pathname } = useLocation()
  const here: Tab | null =
    pathname === '/' || pathname.startsWith('/feed')
      ? 'feed'
      : pathname.startsWith('/flights')
        ? 'flights'
        : pathname.startsWith('/map')
          ? 'map'
          : null
  const routes = useKeptRoutes()
  // The Map tab opens on every flight, unfiltered.
  const { data: allFlights = [] } = useAllFlights()
  const mapTabLegs = useMemo(() => allFlights.flatMap((f) => f.legs), [allFlights])
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState<ReadonlySet<string>>(new Set())
  const finish = (key: string) => setDone((d) => new Set(d).add(key))

  // The mini map slots are kept from now on, whether the preloader or the page builds the map first.
  const slotsKey = JSON.stringify(routes.map((r) => [r.slot, routeKey(r.legs, r.airports)]))
  useEffect(() => {
    for (const [slot, key] of JSON.parse(slotsKey) as [string, string][]) keepReady(slot, key)
  }, [slotsKey])

  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), START_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  // The next one to build: another tab's (that page isn't open, so none of its maps are on
  // screen), not built yet, and not already set aside.
  const mini = started
    ? routes.find((r) => {
        const key = routeKey(r.legs, r.airports)
        return r.tab !== here && !open.includes(r.tab) && !done.has(key) && !hasParkedMap(key)
      })
    : undefined
  const buildMapTab =
    started && !mini && here !== 'map' && !open.includes('map') && mapTabLegs.length > 0 && !done.has(MAP_TAB_SLOT) && !hasKeptMap(MAP_TAB_SLOT)
  const nextKey = mini ? routeKey(mini.legs, mini.airports) : buildMapTab ? MAP_TAB_SLOT : null

  useEffect(() => {
    if (!nextKey) return
    const timer = setTimeout(() => finish(nextKey), GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [nextKey])

  if (!nextKey) return null
  return (
    <div
      aria-hidden
      inert
      className={styles.box}
      // Off screen but laid out at the size it'll be shown at, so it's drawn for that size and
      // moves into its page without a refit.
      style={{ position: 'fixed', left: -10_000, top: 0, ...(mini ? cardMapSize() : mapTabSize()) }}
    >
      <Suspense fallback={null}>
        {/* Keyed: each one is a fresh map, and the last is put aside as it goes. */}
        {mini ? (
          <FlightMap
            key={nextKey}
            legs={mini.legs}
            airports={mini.airports}
            pooled
            className={styles.fill}
            onLoad={() => finish(nextKey)}
          />
        ) : (
          <FlightMap
            key={nextKey}
            legs={mapTabLegs}
            interactive
            className={styles.fill}
            fitPadding={MAP_TAB_FIT_PADDING}
            keepViewWhenEmpty
            keepAs={MAP_TAB_SLOT}
            onLoad={() => finish(nextKey)}
          />
        )}
      </Suspense>
    </div>
  )
}

// A card's mini map: as wide as one on the page now, or worked out from the app's column.
function cardMapSize() {
  const shown = document.querySelector('[data-route-map]')?.getBoundingClientRect().width
  const column = Math.min(window.innerWidth, 520)
  return { width: shown || column - 2 * 16 - 2 * 16, aspectRatio: '360 / 150' } // page padding, then card padding
}

// The Map tab's map fills the app's column, tab bar and all.
function mapTabSize() {
  const app = document.querySelector('.app')?.getBoundingClientRect()
  return { width: app?.width ?? Math.min(window.innerWidth, 520), height: app?.height ?? window.innerHeight }
}
