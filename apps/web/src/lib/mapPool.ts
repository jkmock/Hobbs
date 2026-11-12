import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import type { Leg } from './types'

// Live mini maps, kept alive between pages and scrolls.
//
// Building a map (WebGL setup, style, tiles) takes a moment, so a mini map that leaves the
// screen, or the page, isn't destroyed: its element, with the map still running inside, is
// set aside here. The next mini map of the same route takes it and puts it in its own box, so
// it shows instantly, fully drawn. Browsers allow only a handful of WebGL maps at once, so
// only the few most recently used are kept.

type RouteParts = Pick<Leg, 'origin' | 'destination' | 'originPoint' | 'destinationPoint'> & Partial<Pick<Leg, 'track'>>
type Point = { lat: number; lon: number }

// The same route always gives the same key, however the legs were built.
export function routeKey(legs: RouteParts[], airports: { ident: string; point: Point }[] = []) {
  return JSON.stringify([legs.map((l) => [l.origin, l.destination, l.originPoint, l.destinationPoint, l.track]), airports])
}

// A running map and what FlightMap tracks about it.
export type LiveMap = {
  map: MapLibreMap
  el: HTMLDivElement // the map's own element, moved between boxes
  markers: Marker[]
  routeKey: string | null // the route it shows
  loaded: boolean
  // Whoever is showing it now; events go to them.
  on: { load?: () => void }
}

const LIMIT = 4 // set-aside maps, on top of the ones on screen
const parked = new Map<string, LiveMap>()
// Routes of the maps on screen now, which go to the pool when their page goes.
const showing = new Map<string, number>()

// Whether a ready map of this route exists: set aside, or on screen now. When a page changes,
// the new page is drawn before the old one lets its maps go, so a map on screen now is about
// to be free for the new page to take.
export function hasReadyMap(key: string) {
  return parked.has(key) || (showing.get(key) ?? 0) > 0
}

export function markShowing(key: string, delta: 1 | -1) {
  const count = (showing.get(key) ?? 0) + delta
  if (count > 0) showing.set(key, count)
  else showing.delete(key)
}

export function takeParked(key: string): LiveMap | undefined {
  const live = parked.get(key)
  parked.delete(key)
  return live
}

export function park(live: LiveMap) {
  live.on = {}
  live.el.remove()
  const key = live.routeKey
  if (key === null) return live.map.remove()
  parked.get(key)?.map.remove() // already one for this route (two cards of the same route)
  parked.delete(key)
  parked.set(key, live)
  while (parked.size > LIMIT) {
    const [oldest, old] = parked.entries().next().value!
    parked.delete(oldest)
    old.map.remove()
  }
}
