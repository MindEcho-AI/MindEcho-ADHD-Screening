import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Brain } from 'lucide-react'

// Route guard that only allows authenticated users to access
// protected pages and redirects unauthenticated users to login.
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream-100">
        <div className="text-center">
          <Brain size={40} className="text-primary-600 mx-auto animate-pulse-slow" />
          <p className="mt-3 font-body text-bark-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
