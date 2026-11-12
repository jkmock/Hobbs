import { Link } from 'react-router'
import { MessageCircle, Plus, Star } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FlightCard from '../components/FlightCard'
import { useFlightPages } from '../hooks/useFlights'
import styles from './FlightsPage.module.css'

export default function FlightsPage() {
  const { data, isPending, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useFlightPages()
  const flights = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <>
      <PageHeader
        title="My flights"
        action={
          <Link to="/flights/new" className="btn btn--primary">
            <Plus size={16} /> Log flight
          </Link>
        }
      />
      <div className="page">

        {isPending && <p className="muted">Loading flights…</p>}
        {isError && <p className="error-text">{error.message}</p>}

        {!isPending && flights.length === 0 && (
          <div className="empty">
            <p>No flights yet. Your first entry starts the logbook.</p>
            <Link to="/flights/new" className="btn btn--primary">
              Log your first flight
            </Link>
          </div>
        )}

        <div className={`stack ${styles.list}`}>
          {flights.map((flight) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              to={`/flights/${flight.id}/edit`}
              footer={
                // Hobbs doesn't store props or comments yet, so these show 0 and do nothing.
                <>
                  <span className={`btn btn--ghost btn--sm ${styles.reaction}`}>
                    <Star size={16} strokeWidth={1.75} aria-hidden />
                    <span className="mono">0</span> Props
                  </span>
                  <span className={`btn btn--ghost btn--sm ${styles.reaction}`}>
                    <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
                    <span className="mono">0</span> Comments
                  </span>
                </>
              }
            />
          ))}
        </div>

        {hasNextPage && (
          <button
            type="button"
            className="btn btn--block"
            style={{ marginTop: 16 }}
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load older flights'}
          </button>
        )}
      </div>
    </>
  )
}
