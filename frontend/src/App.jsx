import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyOTP from './pages/VerifyOTP'
import CitizenDashboard from './pages/CitizenDashboard'
import PoliceDashboard from './pages/PoliceDashboard'
import AdminPanel from './pages/AdminPanel'
import ViolationDetail from './pages/ViolationDetail'
import { getUser, isAuthenticated } from './utils/auth'
import ErrorBoundary from './components/ErrorBoundary'

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
    <ErrorBoundary>
      <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'police', 'admin']}>
                  <CitizenDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/police"
              element={
                <ProtectedRoute allowedRoles={['police', 'admin']}>
                  <PoliceDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/violations/:id"
              element={
                <ProtectedRoute allowedRoles={['citizen', 'police', 'admin']}>
                  <ViolationDetail />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
    </ErrorBoundary>
  )
}
