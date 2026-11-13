import { useLayoutEffect, useRef } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router'
import { ArrowLeft, Plus } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FlightCard, { FlightReactions } from '../components/FlightCard'
import { useFlight, useFlightPages } from '../hooks/useFlights'
import { useCardExpand } from '../hooks/useCardExpand'
import type { Flight } from '../lib/types'
import FlightDetails from './FlightDetails'
import { POP_SCALE } from '../lib/press'
import styles from '../components/FlightList.module.css'

// A newly logged flight's card pops into the list, a moment after the list shows.
const ARRIVE_MS = 450
const ARRIVE_DELAY_MS = 150

// My flights, and a flight's page (/flights/:id), in one: see useCardExpand for how the card
// you tap stays the same element while it opens into the flight's page and back.
export default function FlightsPage() {
  const routeId = useMatch('/flights/:id')?.params.id ?? null
  const { data, isPending, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useFlightPages()
  const flights = data?.pages.flatMap((page) => page.items) ?? []

  const expand = useCardExpand(routeId)
  const { shownId, leaving, page, cards, cardRef, detailsDelay, swapClass, otherClass, panel, panelOpen, propsOpen, commentsOpen, togglePanel } = expand

  // The flight itself: fresh from the server, or the list's copy meanwhile. Also covers a
  // flight opened by link that isn't in the loaded part of the list.
  const { data: fetched } = useFlight(shownId ?? undefined, { fromList: true })
  const inList = flights.find((f) => f.id === shownId)
  const flight: Flight | undefined = shownId ? (fetched ?? inList) : undefined

  const panelBelow = (
    <p className={styles.panelText}>{panel?.kind === 'props' ? 'No props yet.' : 'No comments yet.'}</p>
  )

  // A flight just logged (LogFlightPage passes its id): its card pops into the list, scrolled
  // into view if it's further down. Once only: the id is then cleared from the history entry,
  // so going back here or reloading doesn't pop it again.
  const newFlightId = (useLocation().state as { newFlightId?: string } | null)?.newFlightId
  const navigate = useNavigate()
  const arrived = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (!newFlightId || arrived.current === newFlightId || shownId !== null) return
    const el = cards.current.get(newFlightId)
    if (!el) return // not loaded yet
    arrived.current = newFlightId
    const box = el.getBoundingClientRect()
    const view = page.current?.getBoundingClientRect()
    if (view && (box.top < view.top || box.bottom > view.bottom)) el.scrollIntoView({ block: 'center' })
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.animate(
        [
          { opacity: 0, transform: 'scale(0.95)', easing: 'ease-out' },
          { opacity: 1, transform: `scale(${POP_SCALE})`, offset: 0.6, easing: 'ease-in-out' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: ARRIVE_MS, delay: ARRIVE_DELAY_MS, fill: 'backwards' },
      )
    }
    navigate('/flights', { replace: true, state: null })
  })

  // Opening a flight from its Props or Comments in the list (the card's own tap is its link).
  function openFlight(id: string, kind: 'props' | 'comments') {
    expand.openPanel(id, kind)
    navigate(`/flights/${id}`)
  }

  const showingFlight = shownId !== null

  return (
    <>
      <div key={showingFlight ? 'flight' : 'list'} className={`${styles.header} ${swapClass}`}>
        {showingFlight ? (
          <PageHeader
            className={styles.topHeader}
            leading={
              <Link to="/flights" className={`btn ${styles.headerButton}`}>
                <ArrowLeft size={22} /> Back
              </Link>
            }
            action={
              <Link to={`/flights/${shownId}/edit`} className={`btn ${styles.headerButton} ${styles.editButton}`}>
                Edit
              </Link>
            }
          />
        ) : (
          <PageHeader
            title="My flights"
            className={styles.topHeader}
            action={
              <Link to="/flights/new" className="btn btn--primary">
                <Plus size={16} /> Log flight
              </Link>
            }
          />
        )}
      </div>
      <div className="page" ref={page}>
        {!showingFlight && (
          <>
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
          </>
        )}

        <div className={`stack ${styles.list}`}>
          {/* A flight opened by link that isn't in the loaded part of the list. */}
          {showingFlight && !inList && flight && (
            <FlightCard
              key={flight.id}
              flight={flight}
              cardRef={cardRef(flight.id)}
              pressable
              footer={
                <FlightReactions
                propsOpen={propsOpen}
                commentsOpen={commentsOpen}
                onProps={() => togglePanel(flight.id, 'props')}
                onComments={() => togglePanel(flight.id, 'comments')}
              />
              }
              below={panelBelow}
              belowOpen={panelOpen}
            />
          )}
          {flights.map((f) => {
            const isShown = f.id === shownId
            return (
              <FlightCard
                key={f.id}
                flight={isShown && flight ? flight : f}
                cardRef={cardRef(f.id)}
                className={otherClass(f.id)}
                to={showingFlight ? undefined : `/flights/${f.id}`}
                pressable={isShown} // on the flight's page, its card presses and pops for fun
                footer={
                  isShown ? (
                    <FlightReactions
                      propsOpen={propsOpen}
                      commentsOpen={commentsOpen}
                      onProps={() => togglePanel(f.id, 'props')}
                      onComments={() => togglePanel(f.id, 'comments')}
                    />
                  ) : (
                    // In the list, either one opens the flight, then its props or comments.
                    <FlightReactions onProps={() => openFlight(f.id, 'props')} onComments={() => openFlight(f.id, 'comments')} />
                  )
                }
                // Hobbs doesn't store props or comments yet, so there are never any to show.
                below={expand.hasPanel(f.id) && panelBelow}
                belowOpen={panelOpen}
              />
            )
          })}
        </div>

        {/* Its sections pop in on their own; on the way out they just fade with the header. */}
        {flight && <FlightDetails flight={flight} delay={detailsDelay} className={leaving ? expand.fadeOut : ''} />}

        {!showingFlight && hasNextPage && (
          <button
            type="button"
            className={`btn btn--block ${otherClass('')}`}
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
