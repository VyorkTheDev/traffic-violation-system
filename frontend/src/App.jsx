import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import CitizenDashboard from './pages/CitizenDashboard'
import PoliceDashboard from './pages/PoliceDashboard'
import AdminPanel from './pages/AdminPanel'

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function getUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function isAuthenticated() {
  return !!localStorage.getItem('token') && !!getUser()
}

// ---------------------------------------------------------------------------
// ProtectedRoute
// Checks: (1) logged in, (2) role matches allowedRoles list
// ---------------------------------------------------------------------------
function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const user = getUser()
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to their own dashboard
    const home = rolePath(user?.role)
    return <Navigate to={home} replace />
  }

  return children
}

function rolePath(role) {
  if (role === 'admin') return '/admin'
  if (role === 'police') return '/police'
  return '/dashboard'
}

// ---------------------------------------------------------------------------
// RootRedirect — sends logged-in users to their dashboard
// ---------------------------------------------------------------------------
function RootRedirect() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  const user = getUser()
  return <Navigate to={rolePath(user?.role)} replace />
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Citizen */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['citizen', 'police', 'admin']}>
              <CitizenDashboard />
            </ProtectedRoute>
          }
        />

        {/* Police */}
        <Route
          path="/police"
          element={
            <ProtectedRoute allowedRoles={['police', 'admin']}>
              <PoliceDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
