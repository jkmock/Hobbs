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

// Points along the great-circle route from a to b, as [lon, lat] pairs, for drawing a leg
// the way it would actually be flown direct. Longitudes are unwrapped so a route across
// the antimeridian stays continuous (some may fall outside -180..180).
export function greatCirclePath(a: Point, b: Point, maxStepNm = 25): [number, number][] {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const deg = (r: number) => (r * 180) / Math.PI
  const d = distanceNm(a, b) / EARTH_RADIUS_NM // angular distance
  if (d < 1e-9) return [[a.lon, a.lat], [b.lon, b.lat]]

  const steps = Math.min(256, Math.max(2, Math.ceil((d * EARTH_RADIUS_NM) / maxStepNm)))
  const [lat1, lon1, lat2, lon2] = [rad(a.lat), rad(a.lon), rad(b.lat), rad(b.lon)]
  const points: [number, number][] = []
  let prevLon = a.lon
  for (let i = 0; i <= steps; i++) {
    // Spherical interpolation between the two endpoints.
    const f = i / steps
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2)
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)
    let lon = deg(Math.atan2(y, x))
    while (lon - prevLon > 180) lon -= 360
    while (lon - prevLon < -180) lon += 360
    prevLon = lon
    points.push([lon, deg(Math.atan2(z, Math.hypot(x, y)))])
  }
  return points
}

// The line to draw for a leg: the track actually flown when FlightAware has one, otherwise
// the great-circle route between the airports.
export function legPath(leg: {
  originPoint: Point
  destinationPoint: Point
  track?: [number, number][] | null
}): [number, number][] {
  return leg.track && leg.track.length >= 2 ? leg.track : greatCirclePath(leg.originPoint, leg.destinationPoint)
}
