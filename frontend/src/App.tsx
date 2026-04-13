import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/layout/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardPage from './pages/DashboardPage'
import NewAssessmentPage from './pages/NewAssessmentPage'
import ReportsPage from './pages/ReportsPage'
import ReportDetailPage from './pages/ReportDetailPage'
import ProfilePage from './pages/ProfilePage'

// Root application component that sets up authentication context
// and defines all public and protected routes for the MindEcho frontend.
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes accessible without logging in */}
          <Route path="/login"            element={<LoginPage />} />
          <Route path="/register"         element={<RegisterPage />} />
          <Route path="/forgot-password"  element={<ForgotPasswordPage />} />

          {/* Protected routes wrapped with authentication and shared app layout */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard"       element={<DashboardPage />} />
            <Route path="/assessment/new"  element={<NewAssessmentPage />} />
            <Route path="/reports"         element={<ReportsPage />} />
            <Route path="/reports/:id"     element={<ReportDetailPage />} />
            <Route path="/profile"         element={<ProfilePage />} />
          </Route>

          {/* Default and fallback redirects */}
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
