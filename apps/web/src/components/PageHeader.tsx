import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

type Props = {
  title: string
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
        <div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </header>
  )
}
