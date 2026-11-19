import { useState } from 'react'
import { Link } from 'react-router'
import PageHeader from '../components/PageHeader'
import { Segmented } from '../components/controls'
import { useAdminReports, useReportTarget, useResolveReport } from '../hooks/useModeration'
import FlightCard, { CheckrideCard } from '../components/FlightCard'
import { Avatar } from '../components/controls'
import { useMe } from '../hooks/useAuth'
import { timeAgo } from '../lib/format'
import type { AdminReport, ReportedPost } from '../lib/types'
import listStyles from '../components/FlightList.module.css'
import styles from './AdminReportsPage.module.css'

// Reports, for admins (users.is_admin): the open ones first, oldest at the top, each with what
// was reported and three choices. Apple expects reports acted on within 24 hours.
//   Remove: a comment is deleted; a post leaves the feed (kept private in its pilot's logbook);
//           a person loses their profile picture.
//   Suspend: the person who posted it can't sign in, and everything of theirs is hidden.
//   Dismiss: nothing wrong with it.
const REASONS: Record<AdminReport['reason'], string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate: 'Inappropriate',
  other: 'Other',
}
const KINDS: Record<AdminReport['targetType'], string> = { flight: 'Flight', checkride: 'Checkride', comment: 'Comment', user: 'Person' }
const OUTCOMES: Record<AdminReport['status'], string> = { open: 'Open', removed: 'Removed', banned: 'Suspended', dismissed: 'Dismissed' }

export default function AdminReportsPage() {
  const { data: me } = useMe()
  const [status, setStatus] = useState<'open' | 'all'>('open')
  const reports = useAdminReports(status)

  return (
    <>
      <PageHeader
        title="Reports"
        className={listStyles.topHeader}
        action={
          <Link to="/settings" className="btn btn--primary">
            Done
          </Link>
        }
      />
      <div className="page">
        {me && !me.isAdmin ? (
          <p className="empty">Only admins can see reports.</p>
        ) : (
          <div className="stack">
            <Segmented
              label="Show"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'all', label: 'All' },
              ]}
            />
            {reports.isPending && <p className="muted">Loading…</p>}
            {reports.isError && <p className="error-text">{reports.error.message}</p>}
            {reports.data?.length === 0 && (
              <p className={`empty ${styles.empty}`}>{status === 'open' ? 'No reports waiting.' : 'No reports yet.'}</p>
            )}
            {reports.data?.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
        )}
      </div>
    </>
  )
}

function ReportCard({ report: r }: { report: AdminReport }) {
  const resolve = useResolveReport()
  const busy = resolve.isPending
  const act = (action: 'remove' | 'ban' | 'dismiss') => resolve.mutate({ id: r.id, action })
  const removeLabel = r.targetType === 'comment' ? 'Delete comment' : r.targetType === 'user' ? 'Remove photo' : 'Remove post'

  return (
    <article className={`card ${styles.card}`}>
      <p className={styles.meta}>
        <span className={styles.kind}>{KINDS[r.targetType]}</span>
        <span className={styles.reason}>{REASONS[r.reason]}</span>
        <span className="muted">{timeAgo(r.createdAt)}</span>
        {r.status !== 'open' && <span className={styles.outcome}>{OUTCOMES[r.status]}</span>}
      </p>
      <ReportedThing report={r} />
      {r.details && (
        <p className={styles.details}>
          <span className="muted">Reporter says:</span> {r.details}
        </p>
      )}
      <dl className={styles.people}>
        <dt>Posted by</dt>
        {/* Name, email, and anything more about them, each on its own line. */}
        <dd>
          {r.targetUser ? (
            <>
              <span>{r.targetUser.name}</span>
              <span>{r.targetUser.email}</span>
            </>
          ) : (
            <span>Deleted account</span>
          )}
          {r.targetUser?.banned && <span className={styles.outcome}>Suspended</span>}
          {r.reportsAgainstUser > 1 && <span className="muted">{r.reportsAgainstUser} reports in all</span>}
        </dd>
        <dt>Reported by</dt>
        <dd>
          {r.reporter ? (
            <>
              <span>{r.reporter.name}</span>
              <span>{r.reporter.email}</span>
            </>
          ) : (
            <span>Deleted account</span>
          )}
        </dd>
      </dl>
      {r.status === 'open' && (
        <div className={styles.actions}>
          <button type="button" className="btn btn--sm btn--danger" disabled={busy} onClick={() => act('remove')}>
            {removeLabel}
          </button>
          {r.targetUser && !r.targetUser.banned && (
            <button type="button" className="btn btn--sm btn--danger" disabled={busy} onClick={() => act('ban')}>
              Suspend {r.targetUser.name.split(' ')[0]}
            </button>
          )}
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => act('dismiss')}>
            Dismiss
          </button>
        </div>
      )}
      {resolve.error && <p className="error-text">{resolve.error.message}</p>}
    </article>
  )
}

// What was reported, as it is now: the post itself (its map and all), a comment with the post
// it's on, or the person. Once deleted, the copy taken when it was reported.
function ReportedThing({ report }: { report: AdminReport }) {
  const target = useReportTarget(report.id)
  if (target.isPending) return <p className="muted">Loading what was reported…</p>
  if (target.isError || !target.data) {
    return (
      <>
        <p className={styles.note}>{target.isError ? target.error.message : 'Deleted since it was reported. As reported:'}</p>
        {report.content && <pre className={styles.content}>{report.content}</pre>}
      </>
    )
  }
  const t = target.data
  if (t.kind === 'user') {
    return (
      <div className={styles.person}>
        <Avatar person={t.person} size={64} />
        <span>
          {t.person.firstName} {t.person.lastName}
        </span>
      </div>
    )
  }
  if (t.kind === 'comment') {
    return (
      <>
        <div className={styles.comment}>
          <Avatar person={t.comment.author} size={28} />
          <div>
            <p className={styles.commentAuthor}>
              {t.comment.author.firstName} {t.comment.author.lastName}
            </p>
            <p className={styles.commentBody}>{t.comment.body}</p>
          </div>
        </div>
        {t.post && (
          <>
            <p className={styles.note}>On this post:</p>
            <Post post={t.post} />
          </>
        )}
      </>
    )
  }
  return <Post post={t} />
}

function Post({ post }: { post: ReportedPost }) {
  const hidden = (post.kind === 'flight' ? post.flight.visibility : post.checkride.visibility) === 'private'
  return (
    <>
      {hidden && <p className={styles.note}>Private now: only its pilot sees it.</p>}
      {post.kind === 'flight' ? (
        <FlightCard
          flight={post.flight}
          pilot={post.flight.pilot}
          className={styles.post}
          // The instructor's name, which the card alone doesn't show (it shows the notes).
          below={
            post.flight.instructorName && (
              <div className={styles.postText}>
                <p>
                  <span className={styles.postLabel}>Instructor</span> {post.flight.instructorName}
                </p>
              </div>
            )
          }
        />
      ) : (
        <CheckrideCard checkride={post.checkride} pilot={post.checkride.pilot} className={styles.post} />
      )}
    </>
  )
}
