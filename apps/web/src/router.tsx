import { createBrowserRouter } from 'react-router'
import { BareLayout, TabLayout } from './components/AppLayout'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import HomePage from './pages/HomePage'
import FlightsPage from './pages/FlightsPage'
import MapPage from './pages/MapPage'
import GoalPage from './pages/GoalPage'
import ProfilePage from './pages/ProfilePage'
import FriendsPage from './pages/FriendsPage'
import SettingsPage from './pages/SettingsPage'
import LogFlightPage from './pages/log-flight/LogFlightPage'
import NotFoundPage from './pages/NotFoundPage'

export const router = createBrowserRouter([
  // Public
  {
    element: <BareLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
    ],
  },

  // Logged in only
  {
    element: <RequireAuth />,
    children: [
      {
        element: <TabLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          // A flight's page is My flights showing just that flight, so its card stays put.
          { path: '/flights', element: <FlightsPage />, children: [{ path: ':id' }] },
          { path: '/map', element: <MapPage /> },
          { path: '/goal', element: <GoalPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
      {
        element: <BareLayout />,
        children: [
          { path: '/flights/new', element: <LogFlightPage /> },
          { path: '/flights/:id/edit', element: <LogFlightPage /> },
          { path: '/friends', element: <FriendsPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])
