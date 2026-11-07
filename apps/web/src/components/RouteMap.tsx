import type { Leg, Point } from '../lib/types'
import styles from './RouteMap.module.css'

// A small chart of a route, drawn as SVG from the airport coordinates.
// Phase 6 replaces the full-screen map with MapLibre; cards can keep using this.

type RouteLeg = Pick<Leg, 'origin' | 'destination' | 'originPoint' | 'destinationPoint'>

type Props = {
  legs: RouteLeg[]
  height?: number
}

const WIDTH = 360
const PADDING = 30
const MIN_SPAN_DEG = 0.25 // so a local flight doesn't zoom in to a single runway
const GRID_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10]

export default function RouteMap({ legs, height = 150 }: Props) {
  const airports = new Map<string, Point>()
  for (const leg of legs) {
    airports.set(leg.origin, leg.originPoint)
    airports.set(leg.destination, leg.destinationPoint)
  }
  if (airports.size === 0) return null

  // Equirectangular projection: shrink longitude by cos(latitude) so shapes look right.
  const points = [...airports.values()]
  const lats = points.map((p) => p.lat)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const k = Math.cos((midLat * Math.PI) / 180)

  const xs = points.map((p) => p.lon * k)
  const ys = points.map((p) => -p.lat)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), MIN_SPAN_DEG)
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), MIN_SPAN_DEG)
  const scale = Math.min((WIDTH - 2 * PADDING) / spanX, (height - 2 * PADDING) / spanY)

  const toX = (lon: number) => WIDTH / 2 + (lon * k - cx) * scale
  const toY = (lat: number) => height / 2 + (-lat - cy) * scale

  // Latitude/longitude grid lines, like a sectional's graticule.
  const latMin = -cy - height / 2 / scale
  const latMax = -cy + height / 2 / scale
  const lonMin = (cx - WIDTH / 2 / scale) / k
  const lonMax = (cx + WIDTH / 2 / scale) / k
  const step = GRID_STEPS.find((s) => (latMax - latMin) / s <= 4) ?? 10
  const gridLats = range(latMin, latMax, step)
  const gridLons = range(lonMin, lonMax, step)

  const route = legs.map((l) => l.origin).concat(legs.at(-1)?.destination ?? [])

  return (
    <svg
      className={styles.map}
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={`Route ${route.join(' to ')}`}
    >
      <rect width={WIDTH} height={height} className={styles.background} />

      {gridLats.map((lat) => (
        <line key={`lat${lat}`} x1={0} x2={WIDTH} y1={toY(lat)} y2={toY(lat)} className={styles.grid} />
      ))}
      {gridLons.map((lon) => (
        <line key={`lon${lon}`} x1={toX(lon)} x2={toX(lon)} y1={0} y2={height} className={styles.grid} />
      ))}

      {legs.map((leg, i) =>
        leg.origin === leg.destination ? (
          // Pattern work or a local flight: a dashed ring around the airport.
          <circle
            key={i}
            cx={toX(leg.originPoint.lon)}
            cy={toY(leg.originPoint.lat)}
            r={12}
            className={styles.pattern}
          />
        ) : (
          <line
            key={i}
            x1={toX(leg.originPoint.lon)}
            y1={toY(leg.originPoint.lat)}
            x2={toX(leg.destinationPoint.lon)}
            y2={toY(leg.destinationPoint.lat)}
            className={styles.leg}
          />
        ),
      )}

      {[...airports].map(([ident, p]) => {
        const x = toX(p.lon)
        const y = toY(p.lat)
        const nearRightEdge = x > WIDTH - 60
        return (
          <g key={ident}>
            <circle cx={x} cy={y} r={4} className={styles.airport} />
            <text
              x={nearRightEdge ? x - 8 : x + 8}
              y={y - 7}
              textAnchor={nearRightEdge ? 'end' : 'start'}
              className={styles.label}
            >
              {ident}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Multiples of `step` between min and max. Built from integers to avoid float drift.
function range(min: number, max: number, step: number): number[] {
  const values: number[] = []
  for (let i = Math.ceil(min / step); i * step <= max; i++) {
    values.push(Number((i * step).toFixed(4)))
  }
  return values
}
