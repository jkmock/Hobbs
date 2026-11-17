import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '../hooks/useAuth'
import { useSplashHold } from '../lib/splash'
import PageLoading from './PageLoading'

// Wraps every page that needs a logged-in user.
// This is only for UX: the real protection is requireAuth on the API.
export default function RequireAuth() {
  const { data: user, isPending } = useMe()
  const location = useLocation()
  useSplashHold(isPending)

  if (isPending) return <div className="app"><PageLoading /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  return <Outlet />
}
