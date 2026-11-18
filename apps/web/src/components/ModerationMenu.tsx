import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Ban, Ellipsis, Flag, type LucideIcon } from 'lucide-react'
import { REPORT_REASONS, type ReportReason, type ReportTarget } from '@hobbs/shared'
import { useBlock, useReport } from '../hooks/useModeration'
import type { Person } from '../lib/types'
import dialogStyles from './ConfirmDialog.module.css'
import styles from './ModerationMenu.module.css'

// The ⋯ button on someone else's post, comment or name, with Report and Block (App Review
// Guideline 1.2). Reporting hides the thing for you at once and sends it to be reviewed;
// blocking keeps you and them apart (no friendship, requests, posts, comments or props).

const REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment or bullying',
  inappropriate: 'Inappropriate or offensive',
  other: 'Something else',
}

// What's reported, in words: "Report post", "Report comment", "Report Jane".
const NOUNS: Record<ReportTarget, string> = { flight: 'post', checkride: 'post', comment: 'comment', user: 'person' }

export type MenuItem = { label: string; icon: LucideIcon; danger?: boolean; onSelect: () => void }

type Step = 'menu' | 'report' | 'reported' | 'block' | null

export default function ModerationMenu({
  type,
  id,
  person,
  items = [],
  className = '',
  iconSize = 20,
}: {
  type: ReportTarget
  id: string
  person: Person // whose it is (the person themselves, for a person)
  items?: MenuItem[] // more choices above Report (Delete, on a comment on your own post)
  className?: string
  iconSize?: number
}) {
  const [step, setStep] = useState<Step>(null)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const report = useReport()
  const block = useBlock()
  const noun = NOUNS[type]
  const first = person.firstName || 'them'
  const fullName = `${person.firstName} ${person.lastName}`.trim()

  const close = () => {
    if (report.isPending || block.isPending) return
    setStep(null)
    setReason(null)
    setDetails('')
    report.reset()
    block.reset()
  }

  const sendReport = () => {
    if (!reason) return
    report.mutate(
      { targetType: type, targetId: id, reason, details: details.trim() || undefined },
      { onSuccess: () => setStep('reported') },
    )
  }

  return (
    <>
      <button
        type="button"
        className={`icon-btn ${styles.trigger} ${className}`}
        aria-label={type === 'user' ? `More options for ${fullName}` : `More options for this ${noun}`}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault() // inside a card's cover link: don't open the card
          e.stopPropagation()
          setStep('menu')
        }}
        onPointerDown={(e) => e.stopPropagation()} // nor press the card in
        data-no-press
      >
        <Ellipsis size={iconSize} />
      </button>

      <Sheet open={step === 'menu'} onClose={close} label="Options">
        <div className={styles.choices}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`btn btn--block ${styles.choice} ${item.danger ? styles.danger : ''}`}
              onClick={() => {
                close()
                item.onSelect()
              }}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
          <button type="button" className={`btn btn--block ${styles.choice} ${styles.danger}`} onClick={() => setStep('report')}>
            <Flag size={18} /> {type === 'user' ? `Report ${first}` : `Report ${noun}`}
          </button>
          <button type="button" className={`btn btn--block ${styles.choice} ${styles.danger}`} onClick={() => setStep('block')}>
            <Ban size={18} /> Block {first}
          </button>
          <button type="button" className={`btn btn--block ${styles.choice}`} onClick={close}>
            Cancel
          </button>
        </div>
      </Sheet>

      <Sheet open={step === 'report'} onClose={close} label={type === 'user' ? `Report ${fullName}` : `Report this ${noun}`}>
        <h2 className={dialogStyles.title}>{type === 'user' ? `Report ${fullName}` : `Report this ${noun}`}</h2>
        <p className={dialogStyles.body}>Why are you reporting it? It’s hidden for you straight away.</p>
        <fieldset className={styles.reasons}>
          <legend className="visually-hidden">Reason</legend>
          {REPORT_REASONS.map((r) => (
            <label key={r} className={styles.reason}>
              <input type="radio" name={`reason-${id}`} value={r} checked={reason === r} onChange={() => setReason(r)} />
              {REASON_LABELS[r]}
            </label>
          ))}
        </fieldset>
        <textarea
          className={`input ${styles.details}`}
          placeholder="Anything else we should know? (optional)"
          maxLength={1000}
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        {report.error && <p className="error-text">{report.error.message}</p>}
        <div className={dialogStyles.buttons}>
          <button type="button" className={`btn ${dialogStyles.button}`} onClick={close} disabled={report.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${dialogStyles.button} ${dialogStyles.danger}`}
            onClick={sendReport}
            disabled={!reason || report.isPending}
          >
            {report.isPending ? 'Sending…' : 'Report'}
          </button>
        </div>
      </Sheet>

      <Sheet open={step === 'reported'} onClose={close} label="Thanks for reporting">
        <h2 className={dialogStyles.title}>Thanks for reporting</h2>
        <p className={dialogStyles.body}>
          We’ll review it within 24 hours and remove anything that breaks the rules. You can also block {first} so
          you won’t see each other at all.
        </p>
        <div className={dialogStyles.buttons}>
          <button type="button" className={`btn ${dialogStyles.button}`} onClick={() => setStep('block')}>
            Block {first}
          </button>
          <button type="button" className={`btn btn--primary ${dialogStyles.button}`} onClick={close}>
            Done
          </button>
        </div>
      </Sheet>

      <Sheet open={step === 'block'} onClose={close} label={`Block ${fullName}`}>
        <h2 className={dialogStyles.title}>Block {fullName}?</h2>
        <p className={dialogStyles.body}>
          You won’t see each other’s posts, comments or props, and they can’t send you friend requests. They won’t be
          told. You can unblock them in Settings.
        </p>
        {block.error && <p className="error-text">{block.error.message}</p>}
        <div className={dialogStyles.buttons}>
          <button type="button" className={`btn ${dialogStyles.button}`} onClick={close} disabled={block.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${dialogStyles.button} ${dialogStyles.danger}`}
            disabled={block.isPending}
            onClick={() =>
              block.mutate(
                { userId: person.id },
                {
                  onSuccess: () => {
                    block.reset()
                    setStep(null)
                  },
                },
              )
            }
          >
            {block.isPending ? 'Blocking…' : 'Block'}
          </button>
        </div>
      </Sheet>
    </>
  )
}

// A card over a dimmed page, like ConfirmDialog's (a native <dialog>: focus stays inside,
// Escape and a tap outside close it). Put on <body>, not inside the card the ⋯ sits in, so it
// takes none of the card's styles: its body has pointer-events: none (taps fall through to the
// card's link), which would leave the sheet's buttons and backdrop dead to taps.
function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // Focus starts on the card, so no choice is ringed in the focus color (ConfirmDialog too).
      el.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    } else if (!open && el.open) {
      el.close()
      // Closing hands focus back to the button that opened it, which the browser then rings in
      // the focus color. Nothing needs focus once it's closed.
      ;(document.activeElement as HTMLElement | null)?.blur()
    }
  }, [open])
  return createPortal(
    <dialog
      ref={dialog}
      className={`${dialogStyles.dialog} ${styles.sheet}`}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        e.stopPropagation() // a tap here isn't a tap on the card the menu sits in
        if (e.target === e.currentTarget) onClose()
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {open && (
        <div className={`card ${dialogStyles.card} ${styles.card}`} tabIndex={-1} data-initial-focus>
          {children}
        </div>
      )}
    </dialog>,
    document.body,
  )
}
