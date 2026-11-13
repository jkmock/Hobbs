import { Link, useMatch, useNavigate } from 'react-router'
import { ArrowLeft, UserPlus, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FlightCard, { FlightReactions } from '../components/FlightCard'
import { useCardExpand, type PanelKind } from '../hooks/useCardExpand'
import { SAMPLE_FEED, SAMPLE_FRIENDS } from '../mocks/social'
import FlightDetails from './FlightDetails'
import { keptSlot } from '../hooks/useKeptMaps'
import listStyles from '../components/FlightList.module.css'

// The social feed, and a feed flight's page (/feed/:id), in one, the same way as My flights
// (see useCardExpand): the card you tap opens into the flight's page and back.
export default function HomePage() {
  const routeId = useMatch('/feed/:id')?.params.id ?? null
  const navigate = useNavigate()
  const expand = useCardExpand(routeId)
  const { shownId, leaving, page, cardRef, detailsDelay, swapClass, otherClass, panel, panelOpen, propsOpen, commentsOpen, togglePanel } = expand

  const shown = SAMPLE_FEED.find((item) => item.id === shownId)
  const showingFlight = shownId !== null
  const hasFriends = SAMPLE_FRIENDS.length > 0

  // The sample feed has counts, but not who gave props or what the comments say.
  const panelItem = SAMPLE_FEED.find((item) => item.id === panel?.id)
  const panelCount = panel?.kind === 'props' ? panelItem?.props : panelItem?.comments
  const panelBelow = (
    <p className={listStyles.panelText}>
      {panel?.kind === 'props' ? (panelCount ? `${panelCount} props` : 'No props yet.') : panelCount ? `${panelCount} comments` : 'No comments yet.'}
    </p>
  )

  // Opening a flight from its Props or Comments in the feed (the card's own tap is its link).
  function openFlight(id: string, kind: PanelKind) {
    expand.openPanel(id, kind)
    navigate(`/feed/${id}`)
  }

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
              <Link to="/friends" className="btn btn--primary">
                {hasFriends ? 'My Friends' : 'Add friends'}
                {hasFriends ? <Users size={16} /> : <UserPlus size={16} />}
              </Link>
            }
          />
        )}
      </div>
      <div className="page" ref={page}>
        <div className={`stack ${listStyles.list}`}>
          {SAMPLE_FEED.map((item, i) => {
            const isShown = item.id === shownId
            const counts = { propsCount: item.props, commentsCount: item.comments }
            return (
              <FlightCard
                key={item.id}
                // The top maps stay ready (hooks/useKeptMaps), so this tab never shows them loading.
                keepMapAs={keptSlot('feed', i)}
                flight={item.flight}
                pilot={item.pilot}
                cardRef={cardRef(item.id)}
                className={otherClass(item.id)}
                to={showingFlight ? undefined : `/feed/${item.id}`}
                pressable={isShown} // on the flight's page, its card presses and pops for fun
                footer={
                  isShown ? (
                    <FlightReactions
                      {...counts}
                      propsOpen={propsOpen}
                      commentsOpen={commentsOpen}
                      onProps={() => togglePanel(item.id, 'props')}
                      onComments={() => togglePanel(item.id, 'comments')}
                    />
                  ) : (
                    // In the feed, either one opens the flight, then its props or comments.
                    <FlightReactions {...counts} onProps={() => openFlight(item.id, 'props')} onComments={() => openFlight(item.id, 'comments')} />
                  )
                }
                below={expand.hasPanel(item.id) && panelBelow}
                belowOpen={panelOpen}
              />
            )
          })}
        </div>

        {/* Its sections pop in on their own; on the way out they just fade with the header. */}
        {shown && <FlightDetails flight={shown.flight} delay={detailsDelay} className={leaving ? expand.fadeOut : ''} />}
      </div>
    </>
  )
}
