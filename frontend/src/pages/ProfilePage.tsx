import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../api/endpoints'
import { User, Mail, Phone, Shield, Save } from 'lucide-react'
import { Spinner } from '../components/ui'

// Profile page where the authenticated user can view and update
// editable account details such as full name and phone number.
export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({
    full_name: user?.full_name ?? '',
    phone_number: user?.phone_number ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Save updated profile details and refresh the user data in local auth state
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess(false)
    try {
      const updated = await authApi.updateMe(form)
      updateUser(updated)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Update failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <h1 className="font-display font-bold text-bark-900 text-3xl mb-8">Profile</h1>

      {/* Profile summary card showing the user's basic account information */}
      <div className="card flex items-center gap-5 mb-6">
        <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center font-display font-bold text-white text-2xl flex-shrink-0">
          {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <div>
          <p className="font-display font-bold text-bark-900 text-xl">{user?.full_name}</p>
          <p className="text-bark-400 font-body text-sm capitalize">{user?.role}</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-xs text-bark-400 font-body">Active account</span>
          </div>
        </div>
      </div>

      {/* Form for updating editable profile fields */}
      <form onSubmit={handleSave} className="card space-y-5">
        <h2 className="font-display font-semibold text-bark-800 text-lg">Edit Profile</h2>

        <div>
          <label className="label">Full Name</label>
          <div className="relative">
            <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-400" />
            <input className="input pl-10" value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Email Address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-300" />
            <input className="input pl-10 opacity-60 cursor-not-allowed" value={user?.email ?? ''} disabled />
          </div>
          <p className="text-xs text-bark-400 mt-1 font-body">Email cannot be changed</p>
        </div>

        <div>
          <label className="label">Phone Number</label>
          <div className="relative">
            <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-400" />
            <input className="input pl-10" placeholder="+971 ..." value={form.phone_number}
              onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))} />
          </div>
        </div>

        <div className="bg-cream-100 rounded-btn px-4 py-3 flex items-center gap-3">
          <Shield size={16} className="text-primary-600 flex-shrink-0" />
          <div>
            <p className="font-display font-semibold text-bark-700 text-sm">Account Role</p>
            <p className="text-bark-400 text-xs font-body capitalize">{user?.role}</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-btn px-4 py-3 text-red-700 text-sm">{error}</div>}
        {success && <div className="bg-primary-50 border border-primary-200 rounded-btn px-4 py-3 text-primary-700 text-sm">Profile updated!</div>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading && <Spinner size={16} className="text-white" />}
          <Save size={16} />
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
