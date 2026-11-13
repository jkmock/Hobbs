import { useState, type FormEvent } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { Avatar } from './controls'
import { useAddComment, useComments, useDeleteComment, usePropGivers } from '../hooks/useSocial'
import { timeAgo } from '../lib/format'
import styles from './FlightSocial.module.css'

// What opens under a flight's card on its page: who gave props, or the comments.

// Who gave props, newest first. (Props are given from the feed's Give Props button.)
export function PropsPanel({ flightId }: { flightId: string }) {
  const givers = usePropGivers(flightId)
  return (
    <div className={styles.panel}>
      {givers.isPending ? (
        <p className={styles.note}>Loading…</p>
      ) : givers.isError ? (
        <p className="error-text">{givers.error.message}</p>
      ) : givers.data.length === 0 ? (
        <p className={styles.note}>No props yet.</p>
      ) : (
        <ul className={styles.people}>
          {givers.data.map((p) => (
            <li key={p.id}>
              <Avatar firstName={p.firstName} lastName={p.lastName} size={28} />
              <span className={styles.name}>
                {p.firstName} {p.lastName}
              </span>
              <span className={styles.when}>{timeAgo(p.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// The conversation, oldest first, with a box to add to it. Your own comments, and any on your
// own flight, can be deleted.
export function CommentsPanel({ flightId }: { flightId: string }) {
  const comments = useComments(flightId)
  const add = useAddComment(flightId)
  const remove = useDeleteComment(flightId)
  const [draft, setDraft] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || add.isPending) return
    add.mutate(body, { onSuccess: () => setDraft('') })
  }

  return (
    <div className={styles.panel}>
      {comments.isPending ? (
        <p className={styles.note}>Loading…</p>
      ) : comments.isError ? (
        <p className="error-text">{comments.error.message}</p>
      ) : comments.data.length === 0 ? (
        <p className={styles.note}>No comments yet.</p>
      ) : (
        <ul className={styles.comments}>
          {comments.data.map((c) => (
            <li key={c.id}>
              <Avatar firstName={c.author.firstName} lastName={c.author.lastName} size={28} className={styles.commentAvatar} />
              <div className={styles.comment}>
                <p className={styles.byline}>
                  <span className={styles.name}>
                    {c.author.firstName} {c.author.lastName}
                  </span>
                  <span className={styles.when}>{timeAgo(c.createdAt)}</span>
                </p>
                <p className={styles.body}>{c.body}</p>
              </div>
              {c.canDelete && (
                <button
                  type="button"
                  className={`icon-btn ${styles.delete}`}
                  aria-label="Delete comment"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(c.id)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className={styles.compose} onSubmit={submit}>
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment"
          maxLength={1000}
          aria-label="Add a comment"
        />
        <button type="submit" className="btn btn--primary" disabled={!draft.trim() || add.isPending} aria-label="Post comment">
          <Send size={16} />
        </button>
      </form>
      {add.error && <p className="error-text">{add.error.message}</p>}
    </div>
  )
}
