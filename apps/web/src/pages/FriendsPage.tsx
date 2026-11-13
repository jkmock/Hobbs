import { useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Check, Search, UserCheck, UserPlus, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Avatar, Segmented } from '../components/controls'
import { useFriends, useFriendship, usePeople } from '../hooks/useSocial'
import { usePress } from '../hooks/usePress'
import { useMorphWidth } from '../lib/morphWidth'
import type { PersonWithStatus } from '../lib/types'
import listStyles from '../components/FlightList.module.css'
import styles from './FriendsPage.module.css'

type Tab = 'friends' | 'find'

// Your friends, requests to and from you, and finding people to add. Friendship is mutual:
// you ask, they accept (or the other way round).
export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>('friends')
  const [query, setQuery] = useState('')
  const friends = useFriends()
  const people = usePeople(tab === 'find' ? query : '')
  const friendship = useFriendship()

  const lists = friends.data ?? { friends: [], incoming: [], outgoing: [] }
  const matches = (p: PersonWithStatus) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.trim().toLowerCase())
  const busy = (p: PersonWithStatus) => friendship.isPending && friendship.variables?.userId === p.id
  const ask = (p: PersonWithStatus) => friendship.mutate({ userId: p.id })
  const drop = (p: PersonWithStatus) => friendship.mutate({ userId: p.id, remove: true })

  // What can be done with someone, by how you're connected.
  const actionsFor = (p: PersonWithStatus): ReactNode => {
    const name = `${p.firstName} ${p.lastName}`
    switch (p.status) {
      case 'friend':
        return tab === 'friends' ? (
          <button type="button" className="icon-btn" aria-label={`Remove ${name}`} disabled={busy(p)} onClick={() => drop(p)}>
            <X size={18} />
          </button>
        ) : (
          <span className="btn btn--sm btn--ghost muted">
            <UserCheck size={15} /> Friends
          </span>
        )
      case 'incoming':
        return (
          <div className={styles.actions}>
            <button type="button" className="btn btn--sm btn--primary" disabled={busy(p)} onClick={() => ask(p)}>
              <Check size={15} /> Accept
            </button>
            <button type="button" className="icon-btn" aria-label={`Decline ${name}`} disabled={busy(p)} onClick={() => drop(p)}>
              <X size={18} />
            </button>
          </div>
        )
      case 'requested':
        // Tapping it takes the request back.
        return (
          <button type="button" className="btn btn--sm btn--ghost muted" disabled={busy(p)} onClick={() => drop(p)} aria-label={`Cancel request to ${name}`}>
            <UserCheck size={15} /> Requested
          </button>
        )
      default:
        return (
          <button type="button" className="btn btn--sm" disabled={busy(p)} onClick={() => ask(p)}>
            <UserPlus size={15} /> Add
          </button>
        )
    }
  }

  const row = (p: PersonWithStatus) => (
    <li key={p.id}>
      <Avatar firstName={p.firstName} lastName={p.lastName} />
      <div className={styles.name}>
        <span>
          {p.firstName} {p.lastName}
        </span>
        {p.status === 'incoming' && <span className="muted">Wants to be friends</span>}
      </div>
      {actionsFor(p)}
    </li>
  )

  const searching = query.trim().length >= 2
  const myFriends = lists.friends.filter(matches)

  const searchBox = (
    <label className={styles.search}>
      <Search size={17} aria-hidden />
      <input
        className="input"
        type="search"
        placeholder={tab === 'friends' ? 'Search your friends' : 'Search by name or email'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={tab === 'friends' ? 'Search your friends' : 'Search by name or email'}
      />
    </label>
  )

  // My friends / Find friends, at the top of the main card.
  const doneMorph = useMorphWidth<HTMLAnchorElement>('friends-button')

  const toggle = (
    <Segmented<Tab>
      label="Friends view"
      value={tab}
      onChange={(next) => {
        setTab(next)
        setQuery('')
      }}
      options={[
        { value: 'friends', label: `My friends (${lists.friends.length})` },
        { value: 'find', label: 'Find friends' },
      ]}
    />
  )

  return (
    <>
      <PageHeader
        title="Friends"
        className={listStyles.topHeader}
        action={
          // Like the Feed's Add friends, which shrinks into it (and it grows back into).
          <Link to="/" className={`btn btn--primary ${styles.done}`} {...doneMorph}>
            Done
          </Link>
        }
      />
      <div className="page">
        {friendship.error && <p className="error-text">{friendship.error.message}</p>}

        {/* One main card for both views, so switching between them doesn't make it pop in again. */}
        <Panel order={0}>
          {toggle}
          {tab === 'friends' ? (
            <>
              {lists.friends.length > 0 && searchBox}
              {friends.isPending && <p className="muted">Loading…</p>}
              {friends.isError && <p className="error-text">{friends.error.message}</p>}
              {myFriends.length > 0 && <ul className={styles.list}>{myFriends.map(row)}</ul>}
              {friends.isSuccess && lists.friends.length === 0 && (
                <>
                  <p className={`muted ${styles.emptyText}`}>Add friends to see their flights in your feed.</p>
                  <button type="button" className="btn btn--primary" onClick={() => setTab('find')}>
                    <UserPlus size={16} /> Find friends
                  </button>
                </>
              )}
              {query && lists.friends.length > 0 && myFriends.length === 0 && <p className="muted">No friends match "{query}".</p>}
            </>
          ) : (
            <>
              {searchBox}
              {searching && people.isError && <p className="error-text">{people.error.message}</p>}
              {searching && people.data && people.data.length > 0 && <ul className={styles.list}>{people.data.map(row)}</ul>}
              {searching && people.data?.length === 0 && !people.isFetching && (
                <p className="muted">No one matches "{query.trim()}".</p>
              )}
            </>
          )}
        </Panel>

        {tab === 'friends' && lists.incoming.length > 0 && (
          <Panel title="Requests" order={1}>
            <ul className={styles.list}>{lists.incoming.map(row)}</ul>
          </Panel>
        )}

        {tab === 'friends' && lists.outgoing.length > 0 && (
          <Panel title="Sent requests" order={2}>
            <ul className={styles.list}>{lists.outgoing.map(row)}</ul>
          </Panel>
        )}
      </div>
    </>
  )
}

// A section of the screen as a floating card with its heading inside, like My Aircraft. The
// main card has the My friends / Find friends toggle at its top instead of a heading.
// Like the cards on a flight's page, it pops in when it appears (after the cards before it,
// `order`), presses in under a finger and pops when let go; a press on one of its controls (a
// button, the search box, the toggle) is that control's own.
function Panel({ title, order, children }: { title?: string; order: number; children: ReactNode }) {
  const press = usePress()
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.target instanceof Element && e.target.closest('button, input, a, label, [role="radio"]')) return
    press.onPointerDown(e)
  }
  return (
    <section
      className={`card ${styles.panel}`}
      style={{ '--pop-order': order } as CSSProperties}
      {...press}
      onPointerDown={onPointerDown}
    >
      {title && <h2>{title}</h2>}
      {children}
    </section>
  )
}
