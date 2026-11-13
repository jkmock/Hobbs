import { lazy, Suspense, useState } from 'react'
import { Expand } from 'lucide-react'
import LiveRouteMap from '../../components/LiveRouteMap'
import { useAirports, useDetectedTouchAndGoesFor, useFlightTracks } from '../../hooks/useLookups'
import { useLegDistances, type Draft } from './draft'
import styles from './LogFlight.module.css'

// The chart library is large, so it loads only when someone opens the map.
const ChartViewer = lazy(() => import('../../components/ChartViewer'))

// The Route step's map of the route so far. The flight form keeps it mounted on every step
// (hidden, but at its real size, on the others), so it's already built, with the FlightAware
// paths and the map tiles loaded, by the time the Route step shows it: picking flights on the
// Aircraft step loads them in the background.
export default function RoutePreview({ draft, hidden }: { draft: Draft; hidden: boolean }) {
  const { find } = useLegDistances(draft.legs)
  const [mapFrom, setMapFrom] = useState<HTMLElement | null>(null) // the map tapped, while open
  // Legs picked from FlightAware are drawn along the path actually flown.
  const tracks = useFlightTracks(draft.legs.flatMap((leg) => (leg.faFlightId ? [leg.faFlightId] : [])))

  // Preview every leg whose two airports are known, so the map keeps showing the finished
  // legs while a new one is being typed.
  const preview = draft.legs.flatMap((leg) => {
    const a = find(leg.origin)
    const b = find(leg.destination)
    if (!a || !b) return []
    return [
      {
        origin: a.ident, // the code the app shows (RDU), whatever was typed
        destination: b.ident,
        originPoint: { lat: a.latitude, lon: a.longitude },
        destinationPoint: { lat: b.latitude, lon: b.longitude },
        // A straight (great-circle) line until the track arrives, or if there isn't one.
        track: leg.faFlightId ? tracks.get(leg.faFlightId) : undefined,
      },
    ]
  })

  // Airports of legs still missing their other end (the first one typed, say), marked on the
  // map as dots as soon as the code matches. They don't move the map; only finished legs do.
  const inPreview = new Set(preview.flatMap((leg) => [leg.origin, leg.destination]))
  const lone = new Map<string, { ident: string; point: { lat: number; lon: number } }>()
  for (const leg of draft.legs) {
    if (find(leg.origin) && find(leg.destination)) continue
    for (const airport of [find(leg.origin), find(leg.destination)]) {
      if (airport && !inPreview.has(airport.ident)) {
        lone.set(airport.ident, { ident: airport.ident, point: { lat: airport.latitude, lon: airport.longitude } })
      }
    }
  }
  // Airports with touch-and-goes, detected or included, as dots on the track. Discarding
  // them on the Route step takes the dot away.
  const detected = useDetectedTouchAndGoesFor(draft.legs.flatMap((leg) => (leg.faFlightId ? [leg.faFlightId] : [])))
  const touchAndGoIdents = draft.legs.flatMap((leg) => {
    const dismissed = new Set(leg.dismissedStops ?? [])
    const found = (leg.faFlightId && detected.get(leg.faFlightId)) || []
    return [...found.map((d) => d.airport).filter((a) => !dismissed.has(a)), ...(leg.stops ?? []).map((s) => s.airport)]
  })
  const touchAndGoAirports = useAirports(touchAndGoIdents)
  for (const ident of touchAndGoIdents) {
    const airport = touchAndGoAirports.get(ident)
    if (airport && !inPreview.has(airport.ident)) {
      lone.set(airport.ident, { ident: airport.ident, point: { lat: airport.latitude, lon: airport.longitude } })
    }
  }
  const loneAirports = [...lone.values()]

  return (
    <>
      {/* On the Route step it stays put above the legs, which scroll on their own. Hidden, it
          can't be seen, tapped or focused, but still loads (it's on screen, just invisible). */}
      <div className={hidden ? styles.routePreviewHidden : styles.routePreview} inert={hidden} aria-hidden={hidden || undefined}>
        <div className={`card ${styles.routePreviewCard}`}>
          {/* Shows the continental US until a leg's two airports are known. Tapping the map opens
              it full screen to explore. It sits over the form, so nothing entered is lost; the X
              closes it. */}
          <button type="button" className={styles.mapButton} onClick={(e) => setMapFrom(e.currentTarget)} aria-label="Open the route map full screen">
            <LiveRouteMap legs={preview} airports={loneAirports} height={170} />
            {/* Same full-screen badge as the Map page's preview. */}
            <span className={styles.mapExpand} aria-hidden>
              <Expand size={20} strokeWidth={2} />
            </span>
          </button>
        </div>
      </div>
      {mapFrom && !hidden && (
        <Suspense fallback={null}>
          <ChartViewer legs={preview} airports={loneAirports} title="Route map" from={mapFrom} onClose={() => setMapFrom(null)} />
        </Suspense>
      )}
    </>
  )
}
