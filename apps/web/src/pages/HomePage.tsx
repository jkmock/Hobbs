import { useState } from 'react'
import { Link } from 'react-router'
import { MessageCircle, Star, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FlightCard from '../components/FlightCard'
import { SAMPLE_FEED } from '../mocks/social'
import styles from './HomePage.module.css'

export default function HomePage() {
  // Props are local until the API stores them.
  const [given, setGiven] = useState<Set<string>>(new Set())

  const toggleProps = (id: string) =>
    setGiven((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="page page--tabs">
      <PageHeader
        title="Social"
        action={
          <Link to="/friends" className="icon-btn" aria-label="Friends">
            <Users size={22} strokeWidth={1.75} />
          </Link>
        }
      />

      <p className="notice">Sample feed. Your friends' real flights show up here once follows are built.</p>

      <div className="stack" style={{ marginTop: 16 }}>
        {SAMPLE_FEED.map((item) => {
          const hasGiven = given.has(item.id)
          return (
            <FlightCard
              key={item.id}
              flight={item.flight}
              navy
              pilot={`${item.pilot.firstName} ${item.pilot.lastName}`}
              footer={
                <>
                  <button
                    type="button"
                    className={`btn btn--ghost btn--sm ${hasGiven ? styles.given : ''}`}
                    aria-pressed={hasGiven}
                    onClick={() => toggleProps(item.id)}
                  >
                    <Star size={16} strokeWidth={1.75} fill={hasGiven ? 'currentColor' : 'none'} />
                    <span className="mono">{item.props + (hasGiven ? 1 : 0)}</span> Props
                  </button>
                  <span className={`btn btn--ghost btn--sm ${styles.static}`}>
                    <MessageCircle size={16} strokeWidth={1.75} />
                    <span className="mono">{item.comments}</span> Comments
                  </span>
                </>
              }
            />
          )
        })}
      </div>
    </div>
  )
}
