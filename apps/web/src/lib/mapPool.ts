import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import type { Leg } from './types'

// Live mini maps, kept alive between pages and scrolls.
//
// Building a map (WebGL setup, style, tiles) takes a moment, so a mini map that leaves the
// screen, or the page, isn't destroyed: its element, with the map still running inside, is
// set aside here. The next mini map of the same route takes it and puts it in its own box, so
// it shows instantly, fully drawn. Browsers allow only a handful of WebGL maps at once, so
// only the few most recently used are kept, plus the maps kept ready on purpose (keepReady):
// the top cards of the tabs, so switching tabs never shows them loading.

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

const LIMIT = 4 // set-aside maps, on top of the ones on screen and the ones kept ready
const parked = new Map<string, LiveMap>()
// Routes kept ready, by slot ("flights-0": the first card on My Flights). A slot holds one
// route; a new route in the slot (the list changed) lets the old one go back to normal.
const kept = new Map<string, string>()
const isKept = (key: string) => [...kept.values()].includes(key)

export function keepReady(slot: string, key: string) {
  kept.set(slot, key)
  trim()
}
// Routes of the maps on screen now, which go to the pool when their page goes.
const showing = new Map<string, number>()

// Whether a ready map of this route exists: set aside, or on screen now. When a page changes,
// the new page is drawn before the old one lets its maps go, so a map on screen now is about
// to be free for the new page to take.
export function hasReadyMap(key: string) {
  return parked.has(key) || (showing.get(key) ?? 0) > 0
}

// Interactive maps kept alive by slot (the Map tab's): put aside when their page closes and
// taken back, view and all, when it opens again. Never dropped; there's one per slot.
const keptInteractive = new Map<string, LiveMap>()

export function hasKeptMap(slot: string) {
  return keptInteractive.has(slot)
}

export function takeKept(slot: string): LiveMap | undefined {
  const live = keptInteractive.get(slot)
  keptInteractive.delete(slot)
  return live
}

export function parkKept(slot: string, live: LiveMap) {
  live.on = {}
  live.el.remove()
  keptInteractive.get(slot)?.map.remove()
  keptInteractive.set(slot, live)
}

// Whether a map of this route is set aside, ready to take.
export function hasParkedMap(key: string) {
  return parked.has(key)
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
  trim()
}

// Down to LIMIT set-aside maps, dropping the least recently used; kept-ready ones don't count.
function trim() {
  const droppable = [...parked.keys()].filter((key) => !isKept(key))
  for (const key of droppable.slice(0, Math.max(0, droppable.length - LIMIT))) {
    parked.get(key)?.map.remove()
    parked.delete(key)
  }
}
