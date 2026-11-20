import { Check } from 'lucide-react'
import type { Requirement } from '../lib/progress'
import { formatHours } from '../lib/format'
import styles from './ProgressBar.module.css'

export default function ProgressBar({ requirement, large = false }: { requirement: Requirement; large?: boolean }) {
  const { label, value, target, unit } = requirement
  const show = (n: number) => (unit === 'hours' ? formatHours(n) : String(n))

  // No target (No Specific Goal's totals): the label and the number, no bar.
  if (target === undefined) {
    return (
      <div className={`${styles.row} ${large ? styles.large : ''}`}>
        <div className={styles.labels}>
          <span className={styles.label}>{label}</span>
          <span className={`mono ${styles.value}`}>{show(value)}</span>
        </div>
      </div>
    )
  }

  const done = value >= target
  const percent = Math.min(100, (value / target) * 100)

  return (
    <div className={`${styles.row} ${large ? styles.large : ''} ${done ? styles.done : ''}`}>
      <div className={styles.labels}>
        <span className={styles.label}>
          {label}
          {done && <Check size={14} strokeWidth={2.5} aria-label="complete" />}
        </span>
        <span className={`mono ${styles.value}`}>
          {show(value)}
          <span className={styles.target}> / {show(target)}</span>
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(value, target)}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
