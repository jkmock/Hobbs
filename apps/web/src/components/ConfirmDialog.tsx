import { useEffect, useRef, type ReactNode } from 'react'
import styles from './ConfirmDialog.module.css'

// A small card over a dimmed page, asking before something that can't be undone (deleting a
// flight). A native <dialog> opened with showModal, so focus stays inside it, Escape cancels,
// and the page behind can't be tapped. Tapping the dimmed area cancels too.
type Props = {
  open: boolean
  title: string
  children?: ReactNode // a line or two about what will happen
  confirmLabel: string // e.g. "Delete"
  busyLabel?: string // shown on the confirm button while working, e.g. "Deleting…"
  busy?: boolean
  error?: string | null
  danger?: boolean // the confirm button in red
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  busy = false,
  error,
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="confirm-title"
      // Escape: cancel through React state, rather than letting the dialog close itself.
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      // A tap on the backdrop lands on the <dialog> itself; taps on the card land inside it.
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div className={`card ${styles.card}`}>
        <h2 id="confirm-title" className={styles.title}>
          {title}
        </h2>
        {children && <div className={styles.body}>{children}</div>}
        {error && <p className="error-text">{error}</p>}
        <div className={styles.buttons}>
          <button type="button" className={`btn ${styles.button}`} onClick={onCancel} disabled={busy} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${styles.button} ${danger ? styles.danger : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
