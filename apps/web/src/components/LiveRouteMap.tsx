import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { LoneAirport, RouteLeg } from './FlightMap'
import { CHART_COLORS } from '../lib/mapStyle'
import { hasReadyMap, routeKey } from '../lib/mapPool'
import styles from './LiveRouteMap.module.css'

// The map library is large, so it loads only when a map is first shown.
const FlightMap = lazy(() => import('./FlightMap'))

type Props = {
  legs: RouteLeg[]
  airports?: LoneAirport[] // airports to mark on their own, without a route line
  height?: number // the map keeps a 360-wide shape at this height
}

// How far past the visible part of the page a map starts, so it's drawn by the time it
// scrolls into view: about a screen's height above and below.
const PRELOAD_MARGIN = '100% 0px'

// A small, non-interactive route map on the FlightAware-style chart, for cards and previews.
// Each live map is a WebGL canvas and phones only allow a handful at once, so it's only live
// while on screen or about a screen away. Until the map has fully loaded (tiles, route and
// all) the box is just the chart's ocean color, and then the finished map switches in.
// A map that leaves is kept alive for a while (lib/mapPool), so coming back to it, or to the
// same route on another page, shows it at once.
export default function LiveRouteMap({ legs, airports, height = 150 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  // Straight away if a map of this route is ready (set aside, or on the page being left): it
  // moves in already drawn, so the card never shows without it.
  const [onScreen, setOnScreen] = useState(() => hasReadyMap(routeKey(legs, airports)))
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        // Hidden (display: none, like the other cards on a flight's page): leave it as it is,
        // so it's still there, map and all, when it shows again.
        const { width, height } = entry.boundingClientRect
        if (width === 0 && height === 0) return
        const near = entry.isIntersecting
        setOnScreen(near)
        if (!near) setLoaded(false) // the live map is set aside; the next one may start over
      },
      // The margin only works against the box that actually scrolls (the page's content
      // area), not the window.
      { root: scrollParent(el), rootMargin: PRELOAD_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={box}
      data-route-map
      className={styles.box}
      style={{ aspectRatio: `360 / ${height}`, background: CHART_COLORS.water }}
    >
      {onScreen && (
        <Suspense fallback={null}>
          <FlightMap
            legs={legs}
            airports={airports}
            pooled
            className={`${styles.fill} ${loaded ? '' : styles.loading}`}
            onLoad={() => setLoaded(true)}
          />
        </Suspense>
      )}
    </div>
  )
}

// The nearest ancestor that scrolls, or null for the window.
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}
