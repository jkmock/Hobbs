import { Link } from 'react-router'
import { Settings } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { Avatar } from '../components/controls'
import MyAircraft from '../components/MyAircraft'
import { useMe } from '../hooks/useAuth'
import { useAllFlights } from '../hooks/useFlights'
import { totals } from '../lib/progress'
import { formatHours } from '../lib/format'
import listStyles from '../components/FlightList.module.css'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const { data: user } = useMe()
  const { data: flights = [] } = useAllFlights()
  const stats = totals(flights)

  if (!user) return null

  return (
    <>
      <PageHeader
        title="Profile"
        className={listStyles.topHeader}
        action={
          <Link to="/settings" className="icon-btn" aria-label="Settings">
            <Settings size={22} strokeWidth={1.75} />
          </Link>
        }
      />
      <div className="page">

        <div className={styles.identity}>
          <Avatar firstName={user.firstName} lastName={user.lastName} size={88} className={styles.avatar} />
          <h2>
            {user.firstName} {user.lastName}
          </h2>
          <p className="muted">{user.email}</p>
        </div>

        {/* The same My Aircraft as the log-flight form, without picking one. */}
        <div className={styles.myAircraft}>
          <MyAircraft />
        </div>

        {/* Laid out like My Aircraft above it: heading in the card, then one row per stat. */}
        <section className={`card ${styles.statsCard}`}>
          <h2>Stats</h2>
          <dl className={styles.stats}>
            <div>
              <dt>Flights</dt>
              <dd className="mono">{stats.flights}</dd>
            </div>
            <div>
              <dt>Hours</dt>
              <dd className="mono">{formatHours(stats.hours)}</dd>
            </div>
            <div>
              <dt>Distance</dt>
              <dd className="mono">
                {stats.distanceNm.toLocaleString()}
                <small> nm</small>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  )
}
