import { Minus, Plus } from 'lucide-react'
import { initials } from '../lib/format'
import styles from './controls.module.css'

// A number with − and + buttons. The value is a string so typing "1." isn't rewritten mid-edit.
type StepperProps = {
  label: string
  value: string
  onChange: (value: string) => void
  step?: number // 0.1 for hours, 1 for counts
  max?: number
  error?: string
}

export function Stepper({ label, value, onChange, step = 0.1, max = 24, error }: StepperProps) {
  const decimals = step < 1 ? 1 : 0
  const bump = (direction: 1 | -1) => {
    const current = Number(value) || 0
    const next = Math.min(max, Math.max(0, current + direction * step))
    onChange(next.toFixed(decimals))
  }

  return (
    <div className={styles.stepperRow}>
      <label className={styles.stepperLabel}>
        {label}
        {error && <span className="error-text">{error}</span>}
      </label>
      <div className={`${styles.stepper} ${Number(value) ? styles.filled : ''} ${error ? styles.invalid : ''}`}>
        <button type="button" onClick={() => bump(-1)} aria-label={`Decrease ${label}`}>
          <Minus size={16} />
        </button>
        <input
          className="mono"
          inputMode={decimals ? 'decimal' : 'numeric'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label={label}
        />
        <button type="button" onClick={() => bump(1)} aria-label={`Increase ${label}`}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

type SegmentedProps<T extends string> = {
  label: string
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T) => void
  onClear?: () => void // when given, tapping the selected option unselects it
}

export function Segmented<T extends string>({ label, options, value, onChange, onClear }: SegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => (onClear && value === option.value ? onClear() : onChange(option.value))}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ firstName, lastName, size = 40 }: { firstName: string; lastName: string; size?: number }) {
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials(firstName, lastName)}
    </span>
  )
}
