import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FlightCard from '../components/FlightCard'
import { useFlightPages } from '../hooks/useFlights'

export default function FlightsPage() {
  const { data, isPending, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useFlightPages()
  const flights = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="page page--tabs">
      <PageHeader
        title="My flights"
        action={
          <Link to="/flights/new" className="btn btn--primary">
            <Plus size={16} /> Log flight
          </Link>
        }
      />

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

      <div className="stack">
        {flights.map((flight) => (
          <FlightCard key={flight.id} flight={flight} to={`/flights/${flight.id}/edit`} />
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
  )
}
