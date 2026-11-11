import { useEffect, useRef, useState } from 'react'
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSourceSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Vite's dependency bundling breaks MapLibre's own worker lookup, so point it at the file.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Leg } from '../lib/types'
import styles from './SectionalMap.module.css'

// Routes drawn over the FAA's VFR sectional charts. The FAA serves them as public-domain
// map tiles, refreshed every 56 days. They only exist between zoom 8 and 12; MapLibre
// stretches the zoom 12 tiles when you zoom in further.
const SECTIONAL_TILES =
  'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}'
const CHART_MIN_ZOOM = 6.5 // below about this, MapLibre stops drawing the zoom 8 chart tiles

setWorkerUrl(workerUrl)

export type RouteLeg = Pick<Leg, 'origin' | 'destination' | 'originPoint' | 'destinationPoint' | 'track'>

type Props = {
  legs: RouteLeg[]
  interactive?: boolean
}

export default function SectionalMap({ legs, interactive = false }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const [zoomedOut, setZoomedOut] = useState(false)

  useEffect(() => {
    if (!container.current || legs.length === 0) return

    const map = new MapLibreMap({
      container: container.current,
      interactive,
      attributionControl: interactive ? { compact: true } : false,
      minZoom: 4,
      maxZoom: 15,
      dragRotate: false,
      pitchWithRotate: false,
      style: {
        version: 8,
        sources: {
          sectional: {
            type: 'raster',
            tiles: [SECTIONAL_TILES],
            tileSize: 256,
            minzoom: 8,
            maxzoom: 12,
            attribution: 'Charts: FAA Aeronautical Information Services',
          },
          // Part of the initial style so the route draws at once, not after every chart tile loads.
          route: { type: 'geojson', data: routeGeoJson(legs) },
        },
        layers: [
          { id: 'paper', type: 'background', paint: { 'background-color': '#e9e5d9' } },
          { id: 'sectional', type: 'raster', source: 'sectional' },
          // A white casing under the line keeps it readable over the busy chart.
          {
            id: 'route-casing',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#ffffff', 'line-width': 6 },
          },
          {
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            // MapLibre can't read CSS variables, so take the stylesheet's accent color.
            paint: { 'line-color': accentColor(container.current), 'line-width': 3 },
          },
        ],
      },
      bounds: boundsFor(legs),
      fitBoundsOptions: { padding: interactive ? 80 : 36, maxZoom: 10 },
    })

    if (interactive) {
      map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
      map.touchZoomRotate.disableRotation()
    }

    const updateZoomedOut = () => setZoomedOut(map.getZoom() < CHART_MIN_ZOOM)
    map.on('zoomend', updateZoomedOut)
    map.on('load', updateZoomedOut)

    // Airports and pattern rings are DOM markers, so labels need no font files.
    const markers: Marker[] = []
    for (const [ident, point] of airportsOf(legs)) {
      const el = document.createElement('div')
      el.className = styles.airport ?? ''
      const label = document.createElement('span')
      label.textContent = ident
      el.append(label)
      markers.push(new Marker({ element: el }).setLngLat([point.lon, point.lat]).addTo(map))
    }
    for (const leg of legs) {
      if (leg.origin !== leg.destination || hasTrack(leg)) continue
      const el = document.createElement('div')
      el.className = styles.pattern ?? ''
      markers.push(
        new Marker({ element: el }).setLngLat([leg.originPoint.lon, leg.originPoint.lat]).addTo(map),
      )
    }

    return () => {
      for (const m of markers) m.remove()
      map.remove()
    }
  }, [legs, interactive])

  return (
    <div className={styles.wrap}>
      <div ref={container} className={styles.map} />
      {interactive && zoomedOut && <p className={styles.hint}>Zoom in to see the sectional chart</p>}
    </div>
  )
}

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

// The chart is light in both modes, so the route uses the light-mode accent.
const accentColor = (el: Element) => getComputedStyle(el).getPropertyValue('--accent-light-mode').trim() || '#1b2f57'
