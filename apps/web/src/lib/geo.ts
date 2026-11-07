import type { Point } from './types'

const EARTH_RADIUS_NM = 3440.065

// Great-circle distance in nautical miles. The API computes the same thing with PostGIS
// for saved flights; this is for the flight form, before anything is saved.
export function distanceNm(a: Point, b: Point): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(h))
}
