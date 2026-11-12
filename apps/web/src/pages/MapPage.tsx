import { lazy, Suspense, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Expand } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useAllFlights } from '../hooks/useFlights'
import styles from './MapPage.module.css'

// The chart library is large, so it loads only on this page.
const FlightMap = lazy(() => import('../components/FlightMap'))
const ChartViewer = lazy(() => import('../components/ChartViewer'))

export default function MapPage() {
  const { data: flights = [], isPending } = useAllFlights()
  // Memoized so the chart isn't rebuilt on every render.
  const legs = useMemo(() => flights.flatMap((f) => f.legs), [flights])
  const [chartOpen, setChartOpen] = useState(false)
  const airports = new Set(legs.flatMap((leg) => [leg.origin, leg.destination]))
  const longest = legs.reduce((max, leg) => Math.max(max, leg.distanceNm), 0)

  return (
    <>
      <PageHeader title="Map" subtitle="Every route you've logged" />
      <div className="page">

        {isPending && <p className="muted">Loading…</p>}

        {!isPending && legs.length === 0 && (
          <div className="empty">
            <p>Your routes will be drawn here.</p>
            <Link to="/flights/new" className="btn btn--primary">
              Log a flight
            </Link>
          </div>
        )}

        {legs.length > 0 && (
          <>
            <button
              type="button"
              className={`card ${styles.mapCard}`}
              onClick={() => setChartOpen(true)}
              aria-label="Open the map full screen"
            >
              <Suspense fallback={null}>
                <FlightMap legs={legs} />
              </Suspense>
              <span className={styles.expand} aria-hidden>
                <Expand size={20} strokeWidth={2} />
              </span>
            </button>
            {chartOpen && (
              <Suspense fallback={null}>
                <ChartViewer legs={legs} title="Your routes" onClose={() => setChartOpen(false)} />
              </Suspense>
            )}
            <dl className={styles.stats}>
              <div>
                <dt>Airports</dt>
                <dd className="mono">{airports.size}</dd>
              </div>
              <div>
                <dt>Legs</dt>
                <dd className="mono">{legs.length}</dd>
              </div>
              <div>
                <dt>Longest leg</dt>
                <dd className="mono">
                  {Math.round(longest)}
                  <small> nm</small>
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </>
  )
}
