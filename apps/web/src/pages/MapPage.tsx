import { Link } from 'react-router'
import PageHeader from '../components/PageHeader'
import RouteMap from '../components/RouteMap'
import { useAllFlights } from '../hooks/useFlights'
import styles from './MapPage.module.css'

export default function MapPage() {
  const { data: flights = [], isPending } = useAllFlights()
  const legs = flights.flatMap((f) => f.legs)
  const airports = new Set(legs.flatMap((leg) => [leg.origin, leg.destination]))
  const longest = legs.reduce((max, leg) => Math.max(max, leg.distanceNm), 0)

  return (
    <div className="page page--tabs">
      <PageHeader title="Map" subtitle="Every route you've logged" />

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
          <div className={`card ${styles.mapCard}`}>
            <RouteMap legs={legs} height={420} />
          </div>
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
  )
}
