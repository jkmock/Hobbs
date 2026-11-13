import { Link, useMatch } from 'react-router'
import { ArrowLeft, UserPlus, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FlightCard, { FlightReactions } from '../components/FlightCard'
import { CommentsPanel } from '../components/FlightSocial'
import { useCardExpand } from '../hooks/useCardExpand'
import { useFeedFlight, useFeedPages, useFriends, useToggleProps } from '../hooks/useSocial'
import type { FeedFlight } from '../lib/types'
import FlightDetails from './FlightDetails'
import { keptSlot } from '../hooks/useKeptMaps'
import { useMorphWidth } from '../lib/morphWidth'
import listStyles from '../components/FlightList.module.css'

// The feed: your flights and your friends', newest first. A feed flight's page (/feed/:id) is
// the same screen, the same way as My flights (see useCardExpand): the card you tap opens into
// the flight's page and back.
export default function HomePage() {
  const routeId = useMatch('/feed/:id')?.params.id ?? null
  const expand = useCardExpand(routeId)
  const { shownId, leaving, page, cardRef, detailsDelay, swapClass, otherClass, panel, togglePanel } = expand

  const { data, isPending, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useFeedPages()
  const feed = data?.pages.flatMap((p) => p.items) ?? []
  const { data: friends } = useFriends()
  const hasFriends = (friends?.friends.length ?? 0) > 0
  const requests = friends?.incoming.length ?? 0

  // The flight shown: from the feed, or fetched on its own (a link to one further down).
  const { data: fetched } = useFeedFlight(shownId && !feed.some((f) => f.id === shownId) ? shownId : undefined)
  const shown: FeedFlight | undefined = feed.find((f) => f.id === shownId) ?? (fetched?.id === shownId ? fetched : undefined)
  const showingFlight = shownId !== null
  // A flight that was opened by link and isn't in the loaded feed still gets its card.
  const items = shown && !feed.some((f) => f.id === shown.id) ? [shown, ...feed] : feed

  // Give Props / Gave Props gives (or takes back) props right away, with no count shown here;
  // Comments opens under the card's footer, in the feed or on the flight's page.
  const toggleProps = useToggleProps()
  const panelBelow = panel?.kind === 'comments' && <CommentsPanel flightId={panel.id} />
  // Add friends shrinks into the Friends page's Done, and Done grows back into it.
  const friendsMorph = useMorphWidth<HTMLAnchorElement>('friends-button')

  return (
    <>
      <div key={showingFlight ? 'flight' : 'list'} className={`${listStyles.header} ${swapClass}`}>
        {showingFlight ? (
          <PageHeader
            className={listStyles.topHeader}
            leading={
              <Link to="/" className={`btn ${listStyles.headerButton}`}>
                <ArrowLeft size={22} /> Back
              </Link>
            }
          />
        ) : (
          <PageHeader
            title="Feed"
            className={listStyles.topHeader}
            action={
              // Like My flights' Log flight button, with the icon after the text.
              <Link to="/friends" className={`btn btn--primary ${listStyles.morphButton}`} {...friendsMorph}>
                {hasFriends ? 'My Friends' : 'Add friends'}
                {requests > 0 && <span className="mono"> ({requests})</span>}
                {hasFriends ? <Users size={16} /> : <UserPlus size={16} />}
              </Link>
            }
          />
        )}
      </div>
      <div className="page" ref={page}>
        {!showingFlight && (
          <>
            {isPending && <p className="muted">Loading the feed…</p>}
            {isError && <p className="error-text">{error.message}</p>}
            {!isPending && !isError && feed.length === 0 && (
              <div className="empty">
                <p>
                  {hasFriends
                    ? 'No flights yet. Yours and your friends’ show up here as they’re logged.'
                    : 'Your flights and your friends’ show up here. Add friends to see theirs.'}
                </p>
                <Link to={hasFriends ? '/flights/new' : '/friends'} className="btn btn--primary">
                  {hasFriends ? 'Log a flight' : 'Add friends'}
                </Link>
              </div>
            )}
          </>
        )}

        <div className={`stack ${listStyles.list}`}>
          {items.map((flight, i) => {
            const isShown = flight.id === shownId
            return (
              <FlightCard
                key={flight.id}
                // The top maps stay ready (hooks/useKeptMaps), so this tab never shows them loading.
                keepMapAs={keptSlot('feed', i)}
                flight={flight}
                pilot={flight.pilot}
                cardRef={cardRef(flight.id)}
                className={otherClass(flight.id)}
                to={showingFlight ? undefined : `/feed/${flight.id}`}
                pressable={isShown} // on the flight's page, its card presses and pops for fun
                footer={
                  <FlightReactions
                    giveProps
                    propped={flight.proppedByMe}
                    commentsCount={flight.commentsCount}
                    commentsOpen={expand.isOpen(flight.id, 'comments')}
                    onProps={() => toggleProps.mutate({ flightId: flight.id, give: !flight.proppedByMe })}
                    onComments={() => togglePanel(flight.id, 'comments')}
                  />
                }
                below={expand.hasPanel(flight.id) && panel?.id === flight.id && panelBelow}
                belowOpen={expand.panelOpenFor(flight.id)}
              />
            )
          })}
        </div>

        {/* Its sections pop in on their own; on the way out they just fade with the header. */}
        {shown && <FlightDetails flight={shown} delay={detailsDelay} className={leaving ? expand.fadeOut : ''} />}

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
