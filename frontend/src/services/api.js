import axios from 'axios'

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
})

// Request interceptor — attach JWT from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — redirect to /login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const auth = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),

  register: (username, email, password) =>
    api.post('/auth/register', { username, email, password }),

  verifyOtp: (email, otp) =>
    api.post('/auth/verify-otp', { email, otp }),

  resendOtp: (email) =>
    api.post('/auth/resend-otp', { email }),

  me: () =>
    api.get('/auth/me'),
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
export const vehicles = {
  getMyVehicles: () =>
    api.get('/vehicles/'),

  addVehicle: (plate, brand, model, year) =>
    api.post('/vehicles/', { plate, brand, model, year }),

  deleteVehicle: (id) =>
    api.delete(`/vehicles/${id}`),
}

// ---------------------------------------------------------------------------
// Violations
// ---------------------------------------------------------------------------
export const violations = {
  getMyViolations: () =>
    api.get('/violations/'),

  getViolationDetail: (id) =>
    api.get(`/violations/${id}`),

  /** @param {FormData} formData — must contain: photo, plate, location, speed? */
  createViolation: (formData) =>
    // Do NOT set Content-Type — axios auto-sets multipart/form-data with boundary
    api.post('/violations/', formData),

  updateViolation: (id, { speed, location }) =>
    api.put(`/violations/${id}`, { speed, location }),

  deleteViolation: (id) =>
    api.delete(`/violations/${id}`),
}

// ---------------------------------------------------------------------------
// Police
// ---------------------------------------------------------------------------
export const police = {
  getPoliceViolations: () =>
    api.get('/police/violations'),

  searchByPlate: (plate) =>
    api.get('/police/search', { params: { plate } }),
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const admin = {
  // Users
  getUsers: () =>
    api.get('/admin/users'),

  createUser: (username, email, password, role) =>
    api.post('/admin/users', { username, email, password, role }),

  deleteUser: (id) =>
    api.delete(`/admin/users/${id}`),

  updateUserRole: (id, role) =>
    api.put(`/admin/users/${id}/role`, { role }),

  // Vehicles
  getVehicles: () =>
    api.get('/admin/vehicles'),

  createVehicle: (plate, brand, model, year, owner_id) =>
    api.post('/admin/vehicles', { plate, brand, model, year, owner_id }),

  deleteVehicle: (id) =>
    api.delete(`/admin/vehicles/${id}`),

  // Violations
  getViolations: (filters = {}) =>
    api.get('/admin/violations', { params: filters }),

  getViolationDetail: (id) =>
    api.get(`/admin/violations/${id}`),

  deleteViolation: (id) =>
    api.delete(`/admin/violations/${id}`),

  // Stats
  getStats: () =>
    api.get('/admin/stats'),
}

export default api
