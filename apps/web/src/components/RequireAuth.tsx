import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '../hooks/useAuth'

// Wraps every page that needs a logged-in user.
// This is only for UX: the real protection is requireAuth on the API.
export default function RequireAuth() {
  const { data: user, isPending } = useMe()
  const location = useLocation()

  if (isPending) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}
