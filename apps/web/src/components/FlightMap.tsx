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
const US_VIEW = { center: [-96, 38] as [number, number], zoom: 3 }

export type RouteLeg = Pick<Leg, 'origin' | 'destination' | 'originPoint' | 'destinationPoint'> &
  Partial<Pick<Leg, 'track'>>

type Props = {
  legs: RouteLeg[]
  interactive?: boolean
  base?: BaseMap
  className?: string // sizes the map; it fills this box
}

export default function FlightMap({ legs, interactive = false, base = 'chart', className = '' }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [zoomedOut, setZoomedOut] = useState(false)

  // Callers often build `legs` fresh on every render (the Route step does), so compare by content.
  const legsKey = useMemo(
    () => JSON.stringify(legs.map((l) => [l.origin, l.destination, l.originPoint, l.destinationPoint, l.track])),
    [legs],
  )
  // The latest legs, for the effects below (layout effects run before them).
  const legsRef = useRef(legs)
  useLayoutEffect(() => {
    legsRef.current = legs
  })

  // The map itself: rebuilt only when the base map or interactivity changes.
  useEffect(() => {
    if (!container.current) return
    const navy = getComputedStyle(document.documentElement).getPropertyValue('--accent-light-mode').trim() || '#1b2f57'
    const initial = legsRef.current

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
          route: { type: 'geojson', data: routeGeoJson(initial) },
        },
        layers: [...baseLayers(base), ...routeLayers(base, navy)],
      },
      ...(initial.length > 0
        ? { bounds: boundsFor(initial), fitBoundsOptions: fitOptions(interactive) }
        : US_VIEW),
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
    const current = legsRef.current

    const apply = () => {
      ;(map.getSource('route') as GeoJSONSource | undefined)?.setData(routeGeoJson(current))
      if (current.length > 0) map.fitBounds(boundsFor(current), { ...fitOptions(interactive), duration: 300 })
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
    for (const leg of current) {
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

function airportsOf(legs: RouteLeg[]) {
  const airports = new Map<string, RouteLeg['originPoint']>()
  for (const leg of legs) {
    airports.set(leg.origin, leg.originPoint)
    airports.set(leg.destination, leg.destinationPoint)
  }
  return airports
}

function boundsFor(legs: RouteLeg[]): LngLatBounds {
  const bounds = new LngLatBounds()
  for (const p of airportsOf(legs).values()) bounds.extend([p.lon, p.lat])
  for (const leg of legs) for (const point of leg.track ?? []) bounds.extend(point)
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
          // The path actually flown when FlightAware has it, otherwise a straight line.
          coordinates: hasTrack(leg)
            ? leg.track!
            : [
                [leg.originPoint.lon, leg.originPoint.lat],
                [leg.destinationPoint.lon, leg.destinationPoint.lat],
              ],
        },
      })),
  }
}

const hasTrack = (leg: RouteLeg) => (leg.track?.length ?? 0) >= 2
