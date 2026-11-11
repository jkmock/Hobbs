import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import SectionalMap, { type RouteLeg } from './SectionalMap'
import styles from './ChartViewer.module.css'

type Props = {
  legs: RouteLeg[]
  title: string
  onClose: () => void
}

// A full-screen sectional chart you can pan and zoom, opened from a route map.
export default function ChartViewer({ legs, title, onClose }: Props) {
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
      <SectionalMap legs={legs} interactive />
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close map" autoFocus>
        <X size={22} strokeWidth={2} />
      </button>
    </div>,
    document.body,
  )
}
