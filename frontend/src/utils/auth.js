export function getUser() {
  try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
}

export function isAuthenticated() {
  return !!localStorage.getItem('token') && !!getUser()
}

export function saveAuth(token, user) {
  localStorage.setItem('token', token)
  localStorage.setItem('user', JSON.stringify(user))
}
