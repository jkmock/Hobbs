import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerCount,
  setWorkerUrl,
  type GeoJSONSource,
  type GeoJSONSourceSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Vite's dependency bundling breaks MapLibre's own worker lookup, so point it at the file.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { legPath } from '../lib/geo'
import type { Leg } from '../lib/types'
import { baseLayers, baseSources, GLYPHS, routeLayers, type BaseMap } from '../lib/mapStyle'
import styles from './FlightMap.module.css'

// A route drawn on a real map: our FlightAware-colored chart by default, or the FAA sectional.
// Used for the flight cards, the Route step preview, the Map page and the full-screen viewer.

setWorkerUrl(workerUrl)
// MapLibre starts several background workers to process map tiles, one per CPU core up to a
// limit, and each has to load the 500 KB worker script first. Two are plenty for these small
// maps and start much sooner.
setWorkerCount(2)

const SECTIONAL_MIN_ZOOM = 6.5 // below about this, MapLibre stops drawing the zoom 8 sectional tiles
// With no route to show, frame the continental US (the lower 48), whatever the map's size.
const US_BOUNDS: [[number, number], [number, number]] = [
  [-125, 24.5],
  [-66.9, 49.4],
]
const US_FIT = { padding: 8 }

export type RouteLeg = Pick<Leg, 'origin' | 'destination' | 'originPoint' | 'destinationPoint'> &
  Partial<Pick<Leg, 'track'>>

// An airport shown on its own, without a route line: one end of a leg still being typed.
export type LoneAirport = { ident: string; point: RouteLeg['originPoint'] }

type Props = {
  legs: RouteLeg[]
  airports?: LoneAirport[] // drawn as dots; they don't move the view, only legs do
  interactive?: boolean
  base?: BaseMap
  className?: string // sizes the map; it fills this box
}

export default function FlightMap({ legs, airports = NO_AIRPORTS, interactive = false, base = 'chart', className = '' }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [zoomedOut, setZoomedOut] = useState(false)

  // Callers often build `legs` fresh on every render (the Route step does), so compare by content.
  const legsKey = useMemo(
    () =>
      JSON.stringify([
        legs.map((l) => [l.origin, l.destination, l.originPoint, l.destinationPoint, l.track]),
        airports,
      ]),
    [legs, airports],
  )
  // The latest legs and lone airports, for the effects below (layout effects run before them).
  const routeRef = useRef({ legs, airports })
  useLayoutEffect(() => {
    routeRef.current = { legs, airports }
  })

  // The map itself: rebuilt only when the base map or interactivity changes.
  useEffect(() => {
    if (!container.current) return
    const navy = getComputedStyle(document.documentElement).getPropertyValue('--accent-light-mode').trim() || '#1b2f57'
    const initial = routeRef.current

    const map = new MapLibreMap({
      container: container.current,
      interactive,
      attributionControl: interactive ? { compact: true } : false,
      minZoom: 2,
      maxZoom: 15,
      dragRotate: false,
      pitchWithRotate: false,
      style: {
        version: 8,
        glyphs: GLYPHS,
        sources: {
          ...baseSources(base),
          // Part of the initial style so the route draws at once, not after the map tiles load.
          route: { type: 'geojson', data: routeGeoJson(initial.legs) },
        },
        layers: [...baseLayers(base), ...routeLayers(base, navy)],
      },
      ...(initial.legs.length > 0
        ? { bounds: boundsFor(initial.legs), fitBoundsOptions: fitOptions(interactive) }
        : { bounds: US_BOUNDS, fitBoundsOptions: US_FIT }),
    })
    mapRef.current = map

    if (interactive) {
      map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
      map.touchZoomRotate.disableRotation()
    }
    if (base === 'sectional') {
      const update = () => setZoomedOut(map.getZoom() < SECTIONAL_MIN_ZOOM)
      map.on('zoomend', update)
      map.on('load', update)
    }

    return () => {
      mapRef.current = null
      map.remove()
    }
  }, [interactive, base])

  // The route, airports and view: updated in place when the legs change.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const current = routeRef.current

    const apply = () => {
      ;(map.getSource('route') as GeoJSONSource | undefined)?.setData(routeGeoJson(current.legs))
      if (current.legs.length > 0) map.fitBounds(boundsFor(current.legs), { ...fitOptions(interactive), duration: 300 })
      else map.fitBounds(US_BOUNDS, { ...US_FIT, duration: 300 }) // back to the US when the route is cleared
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)

    // Airports and pattern rings are DOM markers.
    const markers: Marker[] = []
    for (const [ident, point] of airportsOf(current)) {
      const el = document.createElement('div')
      el.className = styles.airport ?? ''
      const label = document.createElement('span')
      label.textContent = ident
      el.append(label)
      markers.push(new Marker({ element: el }).setLngLat([point.lon, point.lat]).addTo(map))
    }
    for (const leg of current.legs) {
      if (leg.origin !== leg.destination || hasTrack(leg)) continue
      const el = document.createElement('div')
      el.className = styles.pattern ?? ''
      markers.push(new Marker({ element: el }).setLngLat([leg.originPoint.lon, leg.originPoint.lat]).addTo(map))
    }
    return () => {
      for (const m of markers) m.remove()
    }
    // legsKey stands in for legs; base/interactive rebuild the map, which needs fresh markers too.
  }, [legsKey, base, interactive])

  return (
    <div className={`${styles.wrap} ${className}`} data-base={base}>
      <div ref={container} className={styles.map} />
      {interactive && base === 'sectional' && zoomedOut && <p className={styles.hint}>Zoom in to see the sectional chart</p>}
    </div>
  )
}

// Airport labels sit to the right of their dots, so leave more room on the right.
const fitOptions = (interactive: boolean) => ({
  padding: interactive ? { top: 80, bottom: 80, left: 80, right: 110 } : { top: 30, bottom: 22, left: 24, right: 56 },
  maxZoom: 10,
})

const NO_AIRPORTS: LoneAirport[] = []

type Route = { legs: RouteLeg[]; airports: LoneAirport[] }


// Every airport to mark: both ends of each leg, then the lone ones.
function airportsOf({ legs, airports: lone }: Route) {
  const airports = new Map<string, RouteLeg['originPoint']>()
  for (const leg of legs) {
    airports.set(leg.origin, leg.originPoint)
    airports.set(leg.destination, leg.destinationPoint)
  }
  for (const a of lone) airports.set(a.ident, a.point)
  return airports
}

// The view fits the legs only; lone airports are marked but don't move it.
function boundsFor(legs: RouteLeg[]): LngLatBounds {
  const bounds = new LngLatBounds()
  for (const p of airportsOf({ legs, airports: NO_AIRPORTS }).values()) bounds.extend([p.lon, p.lat])
  // The track or great-circle arc can bow out past the airports.
  for (const leg of legs) if (leg.origin !== leg.destination || hasTrack(leg)) for (const point of legPath(leg)) bounds.extend(point)
  // A local flight is a single point; give it some area so the fit doesn't max out.
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  if (ne.lat - sw.lat < 0.2 && ne.lng - sw.lng < 0.2) {
    const c = bounds.getCenter()
    return new LngLatBounds([c.lng - 0.15, c.lat - 0.1], [c.lng + 0.15, c.lat + 0.1])
  }
  return bounds
}

function routeGeoJson(legs: RouteLeg[]): GeoJSONSourceSpecification['data'] {
  return {
    type: 'FeatureCollection' as const,
    features: legs
      .filter((leg) => hasTrack(leg) || leg.origin !== leg.destination)
      .map((leg) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          // The path actually flown when FlightAware has it, otherwise the great-circle route.
          coordinates: legPath(leg),
        },
      })),
  }
}

const hasTrack = (leg: RouteLeg) => (leg.track?.length ?? 0) >= 2
