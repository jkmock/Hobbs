import PageHeader from '../components/PageHeader'
import ProgressBar from '../components/ProgressBar'
import { useAllFlights } from '../hooks/useFlights'
import { privatePilotProgress } from '../lib/progress'
import styles from './GoalPage.module.css'

export default function GoalPage() {
  const { data: flights = [], isPending } = useAllFlights()
  const { total, sections } = privatePilotProgress(flights)

  return (
    <>
      <PageHeader title="Private Pilot" subtitle="14 CFR 61.109(a) · airplane single-engine" />
      <div className="page">

        {isPending ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className={`card ${styles.card}`}>
              <ProgressBar requirement={total} large />
            </div>

            {/* Styled like Profile's Stats card: a floating card with its heading inside, and a
                row per requirement. */}
            {sections.map((section) => (
              <section key={section.title} className={`card ${styles.card}`}>
                <h2>{section.title}</h2>
                <div className={styles.list}>
                  {section.items.map((item) => (
                    <ProgressBar key={item.label} requirement={item} />
                  ))}
                </div>
              </section>
            ))}

            <p className={styles.footnote}>
              Checkride prep counts dual time from the last 2 months. Towered-airport takeoffs and landings
              aren't tracked yet.
            </p>
          </>
        )}
      </div>
    </>
  )
}
