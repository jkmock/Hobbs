import PropellerIcon from './PropellerIcon'
import styles from './PageLoading.module.css'

// A page's content while it loads: the launch splash's spinning propeller, in grey, in the
// middle of the screen. The page's header and the tab bar stay as they are around it.
export default function PageLoading() {
  return (
    <div className={styles.box} role="status" aria-label="Loading">
      <PropellerIcon size={56} strokeWidth={1.3} className={styles.prop} aria-hidden />
    </div>
  )
}
