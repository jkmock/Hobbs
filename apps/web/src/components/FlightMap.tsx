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
import { markShowing, park, routeKey, takeParked, type LiveMap } from '../lib/mapPool'
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
  onLoad?: () => void // once the map has first drawn, tiles and all
  // Keep the map alive when this goes away, for the next map of the same route to reuse
  // (lib/mapPool). For mini maps only.
  pooled?: boolean
  // Opening from a mini map: start framed exactly as the mini map in `startBox` (where it sits
  // on screen) shows the route, and stay that way while `holdView` is true. When it turns false
  // the map glides to frame the route full size; back to true, it glides back.
  startBox?: ScreenBox
  holdView?: boolean
}

export default function FlightMap({
  legs,
  airports = NO_AIRPORTS,
  interactive = false,
  base = 'chart',
  className = '',
  onLoad,
  pooled = false,
  startBox,
  holdView = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const liveRef = useRef<LiveMap | null>(null)
  const [zoomedOut, setZoomedOut] = useState(false)

  // Callers often build `legs` fresh on every render (the Route step does), so compare by content.
  const legsKey = useMemo(() => routeKey(legs, airports), [legs, airports])
  // The latest props, for the effects below (layout effects run before them).
  const routeRef = useRef({ legs, airports, legsKey })
  const onLoadRef = useRef(onLoad)
  const viewRef = useRef({ startBox, holdView })
  useLayoutEffect(() => {
    routeRef.current = { legs, airports, legsKey }
    onLoadRef.current = onLoad
    viewRef.current = { startBox, holdView }
  })

  // The map itself: rebuilt only when the base map or interactivity changes. A layout effect,
  // so a reused map is in place before the page is drawn (and before a page transition takes
  // its picture of the new page).
  useLayoutEffect(() => {
    const wrap = container.current
    if (!wrap) return
    const usePool = pooled && !interactive && base === 'chart'

    let live = usePool ? takeParked(routeRef.current.legsKey) : undefined
    if (live) {
      // A set-aside map of this route: move it in. If this box is a different size, refit.
      const before = live.el.getBoundingClientRect()
      wrap.append(live.el)
      const after = live.el.getBoundingClientRect()
      if (Math.round(before.width) !== Math.round(after.width) || Math.round(before.height) !== Math.round(after.height)) {
        live.map.resize()
        const { legs: current } = routeRef.current
        if (current.length > 0) live.map.fitBounds(boundsFor(current), { ...fitOptions(false), duration: 0 })
      }
      // Draw it now, not on the next frame, so a page transition's picture of the new page
      // has the map in it.
      live.map.redraw()
    } else {
      live = createMap(wrap, routeRef.current, viewRef.current, interactive, base, setZoomedOut)
    }

    const current = live
    const shownKey = usePool ? routeRef.current.legsKey : null
    if (shownKey) markShowing(shownKey, 1)
    current.on = { load: () => onLoadRef.current?.() }
    liveRef.current = current
    if (current.loaded) onLoadRef.current?.()

    return () => {
      liveRef.current = null
      if (shownKey) markShowing(shownKey, -1)
      if (usePool) park(current)
      else {
        current.map.remove()
        current.el.remove()
      }
    }
  }, [interactive, base, pooled])

  // The route, airports and view: updated in place when the legs change.
  useEffect(() => {
    const live = liveRef.current
    if (!live || live.routeKey === legsKey) return // a reused map already shows this route
    live.routeKey = legsKey
    const map = live.map
    const current = routeRef.current

    // Applied as soon as the route source exists, not after every map tile has loaded
    // (isStyleLoaded()/'load' wait for tiles, and 'load' only fires once, so an update made
    // while tiles were still loading used to be held back or lost).
    const apply = () => {
      const source = map.getSource('route') as GeoJSONSource | undefined
      if (!source) {
        map.once('styledata', apply) // the style is still being set up; try again when it is
        return
      }
      source.setData(routeGeoJson(current.legs))
      if (viewRef.current.holdView && viewRef.current.startBox) return // held on the mini map's view
      if (current.legs.length > 0) map.fitBounds(boundsFor(current.legs), { ...fitOptions(interactive), duration: 300 })
      else map.fitBounds(US_BOUNDS, { ...US_FIT, duration: 300 }) // back to the US when the route is cleared
    }
    apply()

    // Airports and pattern rings are DOM markers.
    for (const m of live.markers) m.remove()
    live.markers = []
    for (const [ident, point] of airportsOf(current)) {
      const el = document.createElement('div')
      el.className = styles.airport ?? ''
      const label = document.createElement('span')
      label.textContent = ident
      el.append(label)
      live.markers.push(new Marker({ element: el }).setLngLat([point.lon, point.lat]).addTo(map))
    }
    for (const leg of current.legs) {
      if (leg.origin !== leg.destination || hasTrack(leg)) continue
      const el = document.createElement('div')
      el.className = styles.pattern ?? ''
      live.markers.push(new Marker({ element: el }).setLngLat([leg.originPoint.lon, leg.originPoint.lat]).addTo(map))
    }
    return () => {
      map.off('styledata', apply)
    }
    // legsKey stands in for legs; base/interactive rebuild the map, which needs fresh markers too.
  }, [legsKey, base, interactive, pooled])

  // Gliding between the mini map's view (held) and the route framed full size.
  // A layout effect, so the glide starts on the same frame as the box's transition.
  const wasHolding = useRef(holdView)
  useLayoutEffect(() => {
    const map = liveRef.current?.map
    if (!map || wasHolding.current === holdView) return
    wasHolding.current = holdView
    const { startBox: box } = viewRef.current
    if (holdView && box) {
      map.easeTo({ ...miniCamera(map, routeRef.current.legs, box), duration: GLIDE_MS, easing: glideEasing, essential: true })
    } else if (!holdView) {
      const { legs: current } = routeRef.current
      const glide = { duration: GLIDE_MS, easing: glideEasing, essential: true }
      // Opening out from the mini map only ever zooms in. When the full-screen framing would be
      // further out than the mini map's (a long east-west route on a narrow screen, say), keep
      // the mini map's zoom and just center the route.
      const fit = current.length > 0 ? map.cameraForBounds(boundsFor(current), fitOptions(interactive)) : map.cameraForBounds(US_BOUNDS, US_FIT)
      if (fit) map.easeTo({ ...fit, zoom: Math.max(fit.zoom ?? 0, map.getZoom()), ...glide })
    }
  }, [holdView, interactive])

  return (
    <div ref={container} className={`${styles.wrap} ${className}`} data-base={base}>
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

// The glide between a mini map's view and the full-screen framing runs alongside the full-screen
// chart opening out (or shrinking back), so it matches that transition in ChartViewer.module.css:
// 700ms, cubic-bezier(0.2, 0.8, 0.2, 1).
const GLIDE_MS = 700
const glideEasing = cubicBezier(0.2, 0.8, 0.2, 1)

// CSS's cubic-bezier() timing function, for MapLibre's `easing`.
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3
  return (x: number) => {
    // Find the t where the curve's x is `x` (bisection; the curve's x only ever increases).
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < x) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}

// A new map in its own element inside `wrap` (its own element so it can be moved to another
// box later). It shows the route straight away; markers come from the route effect.
function createMap(
  wrap: HTMLDivElement,
  route: { legs: RouteLeg[] },
  hold: { startBox?: ScreenBox; holdView: boolean },
  interactive: boolean,
  base: BaseMap,
  setZoomedOut: (zoomedOut: boolean) => void,
): LiveMap {
  const el = document.createElement('div')
  el.className = styles.map ?? ''
  wrap.prepend(el)
  const navy = getComputedStyle(document.documentElement).getPropertyValue('--accent-light-mode').trim() || '#1b2f57'
  const startBox = hold.holdView ? hold.startBox : undefined

  const map = new MapLibreMap({
    container: el,
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
        route: { type: 'geojson', data: routeGeoJson(route.legs) },
      },
      layers: [...baseLayers(base), ...routeLayers(base, navy)],
    },
    ...(route.legs.length > 0
      ? { bounds: boundsFor(route.legs), fitBoundsOptions: fitOptions(interactive) }
      : { bounds: US_BOUNDS, fitBoundsOptions: US_FIT }),
  })
  // Opening from a mini map: framed as the mini map frames it, where the mini map is.
  if (startBox) map.jumpTo(miniCamera(map, route.legs, startBox))

  const live: LiveMap = { map, el, markers: [], routeKey: null, loaded: false, on: {} }
  map.once('load', () => {
    live.loaded = true
    live.on.load?.()
  })

  if (interactive) {
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.touchZoomRotate.disableRotation()
  }
  if (base === 'sectional') {
    const update = () => setZoomedOut(map.getZoom() < SECTIONAL_MIN_ZOOM)
    map.on('zoomend', update)
    map.on('load', update)
  }
  return live
}

// A box on screen, in pixels from the top left of the window.
export type ScreenBox = { top: number; left: number; right: number; bottom: number }

// The camera that shows the route inside `box` exactly as a mini map that size frames it
// (same fit, same padding), for a map that fills the window. Worked out from the route
// alone, so it doesn't need the mini map to have loaded.
function miniCamera(map: MapLibreMap, legs: RouteLeg[], box: ScreenBox) {
  const { clientWidth: width, clientHeight: height } = map.getContainer()
  const fit = legs.length > 0 ? fitOptions(false) : { padding: { top: 8, bottom: 8, left: 8, right: 8 }, maxZoom: undefined }
  const camera = map.cameraForBounds(legs.length > 0 ? boundsFor(legs) : US_BOUNDS, {
    padding: {
      top: box.top + fit.padding.top,
      bottom: height - box.bottom + fit.padding.bottom,
      left: box.left + fit.padding.left,
      right: width - box.right + fit.padding.right,
    },
    maxZoom: fit.maxZoom,
  })
  return camera ?? { center: map.getCenter(), zoom: map.getZoom() }
}

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
