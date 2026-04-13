// Shared Axios client used for all frontend API requests,
// including automatic token attachment and session-expiry handling.
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach the stored JWT token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mindecho_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to the login page only when an existing session expires.
// If no token is stored, the error is returned so the calling page
// can show the correct login or validation message.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const hasToken = !!localStorage.getItem('mindecho_token')

    if (status === 401 && hasToken) {
      // Clear expired session data and send the user back to login
      localStorage.removeItem('mindecho_token')
      localStorage.removeItem('mindecho_user')
      window.location.href = '/login'
    }

    // Return the error so the calling code can handle it
    return Promise.reject(err)
  }
)

export default api
