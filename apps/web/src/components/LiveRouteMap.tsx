import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import RouteMap from './RouteMap'
import type { LoneAirport, RouteLeg } from './FlightMap'
import styles from './LiveRouteMap.module.css'

// The map library is large, so it loads only when a map is first shown.
const FlightMap = lazy(() => import('./FlightMap'))

type Props = {
  legs: RouteLeg[]
  airports?: LoneAirport[] // airports to mark on their own, without a route line
  height?: number // of the drawn fallback; the map keeps the same 360-wide shape
}

// A small, non-interactive route map on the FlightAware-style chart, for cards and previews.
// Each live map is a WebGL canvas and phones only allow a handful at once, so it's only live
// while on screen (or about to be); otherwise, and while the map code loads, the simple
// drawn RouteMap stands in at the same size.
export default function LiveRouteMap({ legs, airports, height = 150 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(!!entry?.isIntersecting), {
      rootMargin: '200px 0px', // start a little before it scrolls into view
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const drawn = <RouteMap legs={legs} height={height} />
  return (
    <div ref={box} className={styles.box} style={{ aspectRatio: `360 / ${height}` }}>
      {onScreen ? (
        <Suspense fallback={drawn}>
          <FlightMap legs={legs} airports={airports} className={styles.fill} />
        </Suspense>
      ) : (
        drawn
      )}
    </div>
  )
}
