import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router'
import { Pencil, Plus, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FlightCard, { FlightReactions } from '../components/FlightCard'
import { useFlight, useFlightPages } from '../hooks/useFlights'
import type { Flight } from '../lib/types'
import FlightDetails from './FlightDetails'
import { POP_MS, POP_SCALE, PRESS_SCALE, pressIn, scaleOf, stopAnimations } from '../lib/press'
import styles from './FlightsPage.module.css'

// How long the outgoing parts fade before the swap, and how long the card takes to move
// when there's no press and pop (reduced motion).
const FADE_MS = 110
const MOVE_MS = 350
// Opening a flight: the card presses in as you tap it (while the rest fades), glides up to
// the top still pressed in, and once in place pops (grows just past full size and settles).
// Then the flight's details pop in under it. Closing it (the X) is the same the other way:
// it presses in as the details fade, glides back down to its place in the list, and pops.
const GLIDE_MS = 340
const GLIDE_EASING = 'cubic-bezier(0.25, 0.1, 0.15, 1)' // gets going quickly, settles gently
const DETAILS_AFTER = 0.4 // the details start this far into the pop
// A newly logged flight's card pops into the list, a moment after the list shows.
const ARRIVE_MS = 450
const ARRIVE_DELAY_MS = 150

// My flights, and a flight's page (/flights/:id), in one: the flight's page is this list
// showing just that flight's card, with its details under it. So the card you tap is the
// same element, live map and all, the whole time.
//
// Going in: the card presses in while the other cards and the header fade out, glides up to
// the top, and pops; the flight's header fades in and its details pop in after. Going back
// (the X): the card presses in while the details fade, glides back down to where it was in
// the list (scrolled as it was), and pops, while the other cards fade back in.
type PanelKind = 'props' | 'comments'

export default function FlightsPage() {
  const routeId = useMatch('/flights/:id')?.params.id ?? null
  const { data, isPending, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useFlightPages()
  const flights = data?.pages.flatMap((page) => page.items) ?? []

  // The flight on show. It follows the URL, but only after the outgoing parts have faded.
  const [shownId, setShownId] = useState(routeId)
  const leaving = routeId !== shownId
  // The flight just closed: the rest of the list fades back in around its card (and not on
  // the list's first load).
  const [cameBackFrom, setCameBackFrom] = useState<string | null>(null)

  // The flight itself: fresh from the server, or the list's copy meanwhile. Also covers a
  // flight opened by link that isn't in the loaded part of the list.
  const { data: fetched } = useFlight(shownId ?? undefined, { fromList: true })
  const inList = flights.find((f) => f.id === shownId)
  const flight: Flight | undefined = shownId ? (fetched ?? inList) : undefined

  // The flight's props or comments, under its card's footer. Kept (with open false) after
  // closing, so what was showing can slide shut.
  const [panel, setPanel] = useState<{ id: string; kind: PanelKind; open: boolean } | null>(null)
  // The flight whose card has finished moving into place: a panel asked for as the flight
  // opens waits for this, so it opens under a card that's sitting still.
  const [settledId, setSettledId] = useState<string | null>(routeId)
  // Open on the flight's page; it slides shut as soon as the X is pressed.
  const panelOpen = shownId !== null && routeId === shownId && settledId === shownId && panel?.id === shownId && panel.open
  const propsOpen = panelOpen && panel?.kind === 'props'
  const commentsOpen = panelOpen && panel?.kind === 'comments'
  function togglePanel(id: string, kind: PanelKind) {
    setPanel((p) => ({ id, kind, open: !(p?.id === id && p.kind === kind && p.open) }))
  }
  const panelBelow = (
    <p className={styles.noComments}>{panel?.kind === 'props' ? 'No props yet.' : 'No comments yet.'}</p>
  )

  const page = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<string, HTMLElement>())
  const listScroll = useRef(0) // where the list was scrolled, to come back to
  // The card to move, from where, and (opening a flight) how pressed in it is.
  const move = useRef<{ id: string; top: number; pressed: number | null } | null>(null)
  // When the details start popping in, after the card has slid up and popped.
  const [detailsDelay, setDetailsDelay] = useState(100)

  // Opening or closing a flight: its card presses in while the rest fades. (Opening, a tap
  // has usually pressed it already; this covers the keyboard and links.)
  useEffect(() => {
    if (!leaving) return
    const id = routeId ?? shownId
    const el = id ? cards.current.get(id) : undefined
    if (el) pressIn(el)
  }, [leaving, routeId, shownId])

  // After the fade, swap, noting where the card is now so it can slide from there.
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => {
      const id = routeId ?? shownId
      const el = id ? cards.current.get(id) : undefined
      // Where its unpressed outline is, and how pressed in it is now (it's scaled about its
      // middle, so its outline sits a little lower than its spot).
      const rect = el?.getBoundingClientRect()
      const scale = el ? scaleOf(el) : 1
      const top = rect ? rect.top - ((rect.height / scale) * (1 - scale)) / 2 : 0
      const pressed = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      move.current = id && el ? { id, top, pressed: pressed ? scale : null } : null
      if (shownId === null && page.current) listScroll.current = page.current.scrollTop
      setCameBackFrom(routeId === null ? shownId : null)
      // Already sliding shut; a plain tap reopens the flight without it.
      if (routeId === null) setPanel((p) => (p ? { ...p, open: false } : p))
      setSettledId(null) // the card is about to move
      setShownId(routeId)
    }, FADE_MS)
    return () => clearTimeout(timer)
  }, [leaving, routeId, shownId])

  // Right after the swap, before it's drawn: scroll to the top (or back to where the list
  // was), then move the card from its old spot to its new one. Opening a flight, it glides up
  // pressed in and then pops, all as one animation, and the details (whose start is set here)
  // follow.
  useLayoutEffect(() => {
    if (page.current) page.current.scrollTop = shownId ? 0 : listScroll.current
    const from = move.current
    move.current = null
    const el = from && cards.current.get(from.id)
    if (!from || !el) {
      setSettledId(shownId)
      return
    }
    // Settled once the move below finishes (or is cut short, by a press, say).
    const settle = (a: Animation) => {
      const done = () => setSettledId(shownId)
      a.finished.then(done, done)
    }
    stopAnimations(el) // the animation below picks up from the pressed-in size
    const dy = from.top - el.getBoundingClientRect().top
    const slides = Math.abs(dy) >= 1

    if (from.pressed === null) {
      if (slides) {
        settle(
          el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
            duration: MOVE_MS,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          }),
        )
      } else setSettledId(shownId)
      return
    }

    const glide = slides ? GLIDE_MS : 0
    const total = glide + POP_MS
    const atTop = glide / total // where the glide ends and the pop starts
    settle(el.animate(
      [
        { transform: `translateY(${dy}px) scale(${from.pressed})`, easing: GLIDE_EASING },
        { transform: `translateY(0px) scale(${PRESS_SCALE})`, offset: atTop, easing: 'ease-out' },
        { transform: `translateY(0px) scale(${POP_SCALE})`, offset: atTop + (1 - atTop) * 0.45, easing: 'ease-in-out' },
        { transform: 'translateY(0px) scale(1)' },
      ],
      { duration: total },
    ))
    setDetailsDelay(glide + POP_MS * DETAILS_AFTER)
  }, [shownId])

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
  // Its props or comments open once the card has moved into place.
  function openFlight(id: string, kind: PanelKind) {
    setPanel({ id, kind, open: true })
    navigate(`/flights/${id}`)
  }

  function cardRef(id: string) {
    return (el: HTMLElement | null) => {
      if (el) cards.current.set(id, el)
      else cards.current.delete(id)
    }
  }

  // The header and details: fading out ahead of a swap, or fading in after one (not on the
  // list's first load).
  const swapClass = leaving ? styles.fadeOut : shownId !== null || cameBackFrom !== null ? styles.fadeIn : ''
  // The cards other than the one moving: gone on a flight's page, fading on the way there.
  function otherClass(id: string) {
    if (shownId !== null) return id === shownId ? '' : styles.gone
    if (leaving && id !== routeId) return styles.fadeOut
    // The card coming back stays as it is; it never left the screen.
    return cameBackFrom !== null && id !== cameBackFrom ? styles.fadeIn : ''
  }

  const showingFlight = shownId !== null

  return (
    <>
      <div key={showingFlight ? 'flight' : 'list'} className={`${styles.header} ${swapClass}`}>
        {showingFlight ? (
          <PageHeader
            title="Flight"
            action={
              <>
                <Link to={`/flights/${shownId}/edit`} className="icon-btn" aria-label="Edit flight">
                  <Pencil size={20} />
                </Link>
                <Link to="/flights" className="icon-btn" aria-label="Close">
                  <X size={24} />
                </Link>
              </>
            }
          />
        ) : (
          <PageHeader
            title="My flights"
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
                // Kept on the card coming back to the list too, so open comments can finish sliding shut.
                below={(isShown || f.id === cameBackFrom) && panelBelow}
                belowOpen={panelOpen}
              />
            )
          })}
        </div>

        {/* Its sections pop in on their own; on the way out they just fade with the header. */}
        {flight && <FlightDetails flight={flight} delay={detailsDelay} className={leaving ? styles.fadeOut : ''} />}

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
