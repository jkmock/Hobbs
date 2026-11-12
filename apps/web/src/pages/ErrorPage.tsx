import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'

// Shown when a page crashes. Inside a layout (`nested`), the layout's chrome — the tab bar —
// stays around it; at the top level it fills the screen on its own.
export default function ErrorPage({ nested = false }: { nested?: boolean }) {
  const error = useRouteError()
  useEffect(() => console.error(error), [error])

  return (
    <div className={nested ? 'page' : 'app page'}>
      <div className="empty">
        <p>Something went wrong.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Try again
        </button>
        <Link to="/">Back to Hobbs</Link>
        {import.meta.env.DEV && error instanceof Error && (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, textAlign: 'left' }}>{error.message}</pre>
        )}
      </div>
    </div>
  )
}
