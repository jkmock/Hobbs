import { createBrowserRouter } from 'react-router'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import LogbookPage from './pages/LogbookPage'
import FlightFormPage from './pages/FlightFormPage'
import AircraftPage from './pages/AircraftPage'
import InstructorsPage from './pages/InstructorsPage'
import NotFoundPage from './pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      // Public
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },

      // Logged in only
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <LogbookPage /> },
          { path: '/flights/new', element: <FlightFormPage /> },
          { path: '/flights/:id/edit', element: <FlightFormPage /> },
          { path: '/aircraft', element: <AircraftPage /> },
          { path: '/instructors', element: <InstructorsPage /> },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
