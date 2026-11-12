import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import FlightMap, { type LoneAirport, type RouteLeg } from './FlightMap'
import type { BaseMap } from '../lib/mapStyle'
import styles from './ChartViewer.module.css'

type Props = {
  legs: RouteLeg[]
  airports?: LoneAirport[] // airports marked on their own (one end of a leg still being typed)
  title: string
  onClose: () => void
}

// A full-screen map you can pan and zoom, opened from a route map. It starts on our
// FlightAware-style chart, with a switch to the FAA sectional.
export default function ChartViewer({ legs, airports, title, onClose }: Props) {
  const [base, setBase] = useState<BaseMap>('chart')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    // Stop the page underneath from scrolling while the chart is open.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
      <FlightMap legs={legs} airports={airports} interactive base={base} />
      <div className={styles.baseSwitch} role="radiogroup" aria-label="Map type">
        {(
          [
            ['chart', 'Map'],
            ['sectional', 'Sectional'],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={base === value} onClick={() => setBase(value)}>
            {label}
          </button>
        ))}
      </div>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close map" autoFocus>
        <X size={22} strokeWidth={2} />
      </button>
    </div>,
    document.body,
  )
}
