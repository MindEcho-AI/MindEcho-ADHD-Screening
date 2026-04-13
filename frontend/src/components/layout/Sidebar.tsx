import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  Brain, LayoutDashboard, FileText, User, LogOut,
  ChevronLeft, ChevronRight, X, AlertTriangle
} from 'lucide-react'

// Confirmation modal shown before logging the user out
function LogoutModal({ onConfirm, onCancel }: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal card */}
      <div className="relative bg-white rounded-card shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-bark-800 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <LogOut size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-display font-bold text-white text-lg leading-tight">Log Out?</h2>
            <p className="text-white/60 font-body text-xs">You'll need to sign in again</p>
          </div>
          <button
            type="button"
            className="ml-auto text-white/50 hover:text-white"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-bark-600 font-body text-sm leading-relaxed">
            Are you sure you want to log out of your account?
            Any unsaved progress will be lost.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          {/* Cancel — prominent, on the left */}
          <button
            type="button"
            className="flex-1 btn-outline"
            onClick={onCancel}
          >
            Cancel
          </button>
          {/* Logout — destructive, on the right */}
          <button
            type="button"
            className="flex-1 btn-danger"
            onClick={onConfirm}
          >
            <LogOut size={16} />
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

// Sidebar navigation used across authenticated pages,
// including user info, route links, logout, and collapse behavior.
export default function Sidebar() {
  const [collapsed, setCollapsed]       = useState(false)
  const [showLogoutModal, setShowLogout] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Clear the current session and return the user to the login page
  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Navigation links shown inside the sidebar
  const navItems = [
    { to: '/dashboard',      icon: LayoutDashboard, label: 'Home' },
    { to: '/reports',        icon: FileText,         label: 'View Past Reports' },
    { to: '/profile',        icon: User,             label: 'Profile' },
  ]

  return (
    <>
      {showLogoutModal && (
        <LogoutModal
          onConfirm={handleLogout}
          onCancel={() => setShowLogout(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full bg-white shadow-sidebar flex flex-col z-40
          transition-all duration-300
          ${collapsed ? 'w-16' : 'w-[260px]'}
        `}
      >
        {/* Sidebar logo and app branding */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-cream-200 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-9 h-9 bg-bark-800 rounded-xl flex items-center justify-center flex-shrink-0">
            <Brain size={18} className="text-cream-100" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-bark-900 text-lg">MindEcho</span>
          )}
        </div>

        {/* Logged-in user summary */}
        {!collapsed && user && (
          <div className="mx-3 mt-4 bg-cream-100 rounded-card px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-bold text-sm">
                {user.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-bark-900 text-sm truncate">{user.full_name}</p>
              <p className="text-bark-400 text-xs font-body capitalize">{user.role}</p>
            </div>
          </div>
        )}

        {/* Main navigation links */}
        <nav className="flex-1 px-2 mt-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-btn transition-colors font-body text-sm
                ${isActive
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-bark-500 hover:bg-cream-100 hover:text-bark-900'
                }
                ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout button */}
        <div className="px-2 pb-4 border-t border-cream-200 pt-3">
          <button
            type="button"
            onClick={() => setShowLogout(true)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-btn
              text-bark-500 hover:bg-red-50 hover:text-red-600
              transition-colors font-body text-sm
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? 'Log Out' : undefined}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span>Log Out</span>}
          </button>
        </div>

        {/* Button to collapse or expand the sidebar */}
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-16 w-6 h-6 bg-white border border-cream-200 rounded-full
            flex items-center justify-center shadow-sm hover:shadow-md transition-shadow text-bark-400 hover:text-bark-700"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>
    </>
  )
}
