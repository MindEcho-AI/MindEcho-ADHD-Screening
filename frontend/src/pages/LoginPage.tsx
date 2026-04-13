import React, { useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Brain, Mail, Lock, ArrowRight, Eye, EyeOff, XCircle } from 'lucide-react'
import { Spinner } from '../components/ui'

// Login page for authenticating existing users and redirecting them
// to the dashboard after successful sign-in.
export default function LoginPage() {
  const emailRef    = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const { login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const message   = (location.state as any)?.message

  // Validate credentials, attempt login, and show backend error messages if sign-in fails
  const handleSignIn = async () => {
    const email    = emailRef.current?.value.trim().toLowerCase() ?? ''
    const password = passwordRef.current?.value ?? ''

    setError('')
    if (!email)    { setError('Please enter your email address.'); return }
    if (!password) { setError('Please enter your password.'); return }

    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      // Pull exact message from backend (e.g. "Incorrect password. Please try again.")
      const detail = err?.response?.data?.detail
      if (detail) {
        setError(detail)
      } else if (!err?.response) {
        setError('Cannot connect to server. Make sure the backend is running.')
      } else {
        setError('Incorrect email or password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex">

      {/* Left panel showing platform branding and key analysis features */}
      <div className="hidden lg:flex w-1/2 bg-primary-600 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Brain size={22} className="text-white" />
          </div>
          <span className="font-display font-bold text-white text-xl">MindEcho</span>
        </div>
        <div>
          <p className="font-display font-bold text-white text-4xl leading-tight mb-4">
            Small signals.<br />Big insights.
          </p>
          <p className="text-primary-200 font-body text-lg">
            AI-based behavioral and cognitive screening for early ADHD detection.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {['Eye Tracking', 'Movement Analysis', 'Speech Patterns'].map(s => (
            <div key={s} className="bg-white/10 rounded-card p-4 text-center">
              <p className="text-white font-display font-semibold text-sm">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel containing the login form and sign-in actions */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-md">

          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Brain size={28} className="text-primary-600" />
            <span className="font-display font-bold text-bark-900 text-xl">MindEcho</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display font-bold text-bark-900 text-3xl mb-2">Sign In To MindEcho</h1>
            <p className="text-bark-500 font-body">Your journey to understanding ADHD begins here.</p>
          </div>

          {message && (
            <div className="mb-4 bg-primary-50 border border-primary-200 rounded-btn px-4 py-3">
              <p className="text-primary-700 text-sm font-body">✓ {message}</p>
            </div>
          )}

          {/* Use a plain container instead of a form to avoid automatic page reload on submit */}
          <div className="space-y-5">

            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-400 pointer-events-none" />
                <input
                  ref={emailRef}
                  type="email"
                  className="input pl-10"
                  placeholder="Enter your email..."
                  autoComplete="email"
                  onKeyDown={e => e.key === 'Enter' && passwordRef.current?.focus()}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline font-body">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-400 pointer-events-none" />
                {/*
                  Keep a single password input and only switch its type
                  so the field does not lose focus or reset its value.
                */}
                <input
                  ref={passwordRef}
                  type={showPass ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  placeholder="Enter your password..."
                  autoComplete="current-password"
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-bark-400 hover:text-bark-700"
                  onMouseDown={e => {
                    // Prevent the input from losing focus when clicking eye icon
                    e.preventDefault()
                    setShowPass(v => !v)
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Show login error returned from validation or backend response */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-btn px-4 py-3 flex items-start gap-2">
                <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm font-body">{error}</p>
              </div>
            )}

            <button
              type="button"
              className="btn-primary w-full"
              disabled={loading}
              onClick={handleSignIn}
            >
              {loading && <Spinner size={18} className="text-white" />}
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight size={18} />}
            </button>

          </div>

          <p className="text-center text-bark-500 text-sm mt-6 font-body">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-semibold hover:underline">
              Sign Up For Free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
