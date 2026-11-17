import { useState, type FormEvent } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { isObjectionable, OBJECTIONABLE_MESSAGE } from '@hobbs/shared'
import ModerationMenu from './ModerationMenu'
import { useMe } from '../hooks/useAuth'
import { Avatar } from './controls'
import ConfirmDialog from './ConfirmDialog'
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
              <Avatar person={p} size={28} />
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
// own flight, can be deleted. Anyone else's has a ⋯ menu to report it or block its author
// (with Delete in it too, on your own flight).
export function CommentsPanel({ flightId }: { flightId: string }) {
  const comments = useComments(flightId)
  const add = useAddComment(flightId)
  const remove = useDeleteComment(flightId)
  const { data: me } = useMe()
  const [draft, setDraft] = useState('')
  const objectionable = isObjectionable(draft)
  // The comment Delete was tapped on, asked about before it's deleted.
  const [deleting, setDeleting] = useState<string | null>(null)
  const closeDelete = () => {
    setDeleting(null)
    remove.reset()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || add.isPending || objectionable) return
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
              <Avatar person={c.author} size={28} className={styles.commentAvatar} />
              <div className={styles.comment}>
                <p className={styles.byline}>
                  <span className={styles.name}>
                    {c.author.firstName} {c.author.lastName}
                  </span>
                  <span className={styles.when}>{timeAgo(c.createdAt)}</span>
                </p>
                <p className={styles.body}>{c.body}</p>
              </div>
              {c.author.id !== me?.id ? (
                <ModerationMenu
                  type="comment"
                  id={c.id}
                  person={c.author}
                  iconSize={18}
                  className={styles.delete}
                  items={c.canDelete ? [{ label: 'Delete comment', icon: Trash2, danger: true, onSelect: () => setDeleting(c.id) }] : []}
                />
              ) : (
                c.canDelete && <button
                  type="button"
                  className={`icon-btn ${styles.delete}`}
                  aria-label="Delete comment"
                  disabled={remove.isPending}
                  onClick={() => setDeleting(c.id)}
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
        <button type="submit" className="btn btn--primary" disabled={!draft.trim() || add.isPending || objectionable} aria-label="Post comment">
          <Send size={16} />
        </button>
      </form>
      {objectionable ? (
        <p className="error-text">{OBJECTIONABLE_MESSAGE}</p>
      ) : (
        add.error && <p className="error-text">{add.error.message}</p>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this comment?"
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={remove.isPending}
        error={remove.error?.message}
        danger
        onConfirm={() => deleting && remove.mutate(deleting, { onSuccess: closeDelete })}
        onCancel={closeDelete}
      >
        This can’t be undone.
      </ConfirmDialog>
    </div>
  )
}
