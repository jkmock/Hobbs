import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useLogout, useMe } from '../hooks/useAuth'

export default function Layout() {
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <>
      <header className="header">
        <Link to="/" className="brand">Hobbs</Link>
        {user && (
          <nav>
            <NavLink to="/" end>Logbook</NavLink>
            <NavLink to="/aircraft">Aircraft</NavLink>
            <NavLink to="/instructors">Instructors</NavLink>
            <button onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}>
              Log out
            </button>
          </nav>
        )}
      </header>
      <main className="main">
        <Outlet />
      </main>
    </>
  )
}
