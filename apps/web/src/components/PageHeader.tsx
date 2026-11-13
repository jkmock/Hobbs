import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

type Props = {
  title?: string // left out when the header has only a back button
  subtitle?: string
  leading?: ReactNode // e.g. a back button
  action?: ReactNode
  className?: string
}

export default function PageHeader({ title, subtitle, leading, action, className = '' }: Props) {
  return (
    <header className={`${styles.header} ${className}`}>
      <div className={styles.titleRow}>
        {leading}
        {(title || subtitle) && (
          <div>
            {title && <h1 className={styles.title}>{title}</h1>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        )}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  )
}
