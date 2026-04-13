// Authentication context provider that stores the logged-in user,
// restores saved session data, and exposes login/logout helpers to the app.
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { User } from '../types'
import { authApi } from '../api/endpoints'
import api from '../api/client'

// Shape of the authentication context shared across the frontend
interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (u: Partial<User>) => void
}

// React context used to provide authentication state and actions
const AuthContext = createContext<AuthContextType | null>(null)

// Wrap the app with authentication state and helper functions
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [token, setToken]     = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore the saved session from localStorage when the app first loads
  useEffect(() => {
    const storedToken = localStorage.getItem('mindecho_token')
    const storedUser  = localStorage.getItem('mindecho_user')
    if (storedToken && storedUser) {
      // Inject token into axios immediately so any API calls work
      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  // Log in the user, store the session locally, and refresh the full profile data
  const login = async (email: string, password: string) => {
    // This throws on wrong credentials — caller (LoginPage) must catch it
    const res = await authApi.login(email, password)

    // Immediately inject token into axios defaults so getMe() works
    api.defaults.headers.common['Authorization'] = `Bearer ${res.access_token}`

    localStorage.setItem('mindecho_token', res.access_token)
    localStorage.setItem('mindecho_user', JSON.stringify(res.user))
    setToken(res.access_token)
    setUser(res.user)

    // Try to fetch full profile — but don't let this crash the login
    try {
      const me = await authApi.getMe()
      setUser(me)
      localStorage.setItem('mindecho_user', JSON.stringify(me))
    } catch {
      // Use the basic user from login response — that's fine
    }
  }

  // Clear the saved session and reset authentication state
  const logout = () => {
    localStorage.removeItem('mindecho_token')
    localStorage.removeItem('mindecho_user')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    setToken(null)
  }

  // Update the stored user information after profile changes
  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...updates }
      setUser(updated)
      localStorage.setItem('mindecho_user', JSON.stringify(updated))
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

  // Custom hook for accessing authentication state and actions
  export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
