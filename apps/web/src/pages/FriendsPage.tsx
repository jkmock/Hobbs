import { useState } from 'react'
import { Link } from 'react-router'
import { Search, UserCheck, UserPlus, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Avatar, Segmented } from '../components/controls'
import { SAMPLE_FRIENDS, SAMPLE_SUGGESTIONS, type Person } from '../mocks/social'
import styles from './FriendsPage.module.css'

type Tab = 'friends' | 'find'

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>('friends')
  const [query, setQuery] = useState('')
  const [friends, setFriends] = useState(SAMPLE_FRIENDS)
  const [requested, setRequested] = useState<Set<string>>(new Set())

  const matches = (p: Person) =>
    `${p.firstName} ${p.lastName} ${p.homeAirport}`.toLowerCase().includes(query.trim().toLowerCase())
  const people = (tab === 'friends' ? friends : SAMPLE_SUGGESTIONS).filter(matches)

  return (
    <div className="page">
      <PageHeader
        title="Friends"
        action={
          <Link to="/" className="icon-btn" aria-label="Close">
            <X size={24} />
          </Link>
        }
      />

      <Segmented<Tab>
        label="Friends view"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'friends', label: `My friends (${friends.length})` },
          { value: 'find', label: 'Find friends' },
        ]}
      />

      <label className={styles.search}>
        <Search size={17} aria-hidden />
        <input
          className="input"
          type="search"
          placeholder={tab === 'friends' ? 'Search your friends' : 'Search by name or home airport'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <ul className={styles.list}>
        {people.map((person) => (
          <li key={person.id}>
            <Avatar firstName={person.firstName} lastName={person.lastName} />
            <div className={styles.name}>
              <span>
                {person.firstName} {person.lastName}
              </span>
              <span className="mono muted">{person.homeAirport}</span>
            </div>
            {tab === 'friends' ? (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${person.firstName} ${person.lastName}`}
                onClick={() => setFriends((prev) => prev.filter((p) => p.id !== person.id))}
              >
                <X size={18} />
              </button>
            ) : requested.has(person.id) ? (
              <span className="btn btn--sm btn--ghost muted">
                <UserCheck size={15} /> Requested
              </span>
            ) : (
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => setRequested((prev) => new Set(prev).add(person.id))}
              >
                <UserPlus size={15} /> Add
              </button>
            )}
          </li>
        ))}
      </ul>

      {people.length === 0 && <p className="muted">No one matches "{query}".</p>}
      <p className={styles.note}>Sample people. Real accounts arrive with the social phase.</p>
    </div>
  )
}
