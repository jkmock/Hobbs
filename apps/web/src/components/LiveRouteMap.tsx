import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { LoneAirport, RouteLeg } from './FlightMap'
import { CHART_COLORS } from '../lib/mapStyle'
import styles from './LiveRouteMap.module.css'

// The map library is large, so it loads only when a map is first shown.
const FlightMap = lazy(() => import('./FlightMap'))

type Props = {
  legs: RouteLeg[]
  airports?: LoneAirport[] // airports to mark on their own, without a route line
  height?: number // the map keeps a 360-wide shape at this height
}

// A small, non-interactive route map on the FlightAware-style chart, for cards and previews.
// Each live map is a WebGL canvas and phones only allow a handful at once, so it's only live
// while on screen (or about to be). Until the map has fully loaded (tiles, route and all) the
// box is just the chart's ocean color, and then the finished map switches in.
export default function LiveRouteMap({ legs, airports, height = 150 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = !!entry?.isIntersecting
        setOnScreen(visible)
        if (!visible) setLoaded(false) // the live map is removed; the next one starts over
      },
      { rootMargin: '200px 0px' }, // start a little before it scrolls into view
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={box} className={styles.box} style={{ aspectRatio: `360 / ${height}`, background: CHART_COLORS.water }}>
      {onScreen && (
        <Suspense fallback={null}>
          <FlightMap
            legs={legs}
            airports={airports}
            className={`${styles.fill} ${loaded ? '' : styles.loading}`}
            onLoad={() => setLoaded(true)}
          />
        </Suspense>
      )}
    </div>
  )
}
