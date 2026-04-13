import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Brain, Mail, Lock, ArrowRight, Eye, EyeOff,
  XCircle, CheckCircle2, RefreshCw
} from 'lucide-react'
import api from '../api/client'
import { Spinner } from '../components/ui'

type Step = 'email' | 'otp' | 'newpassword' | 'success'
const OTP_COOLDOWN = 48

// Password rules used to validate the new password before submission
const passwordRules = [
  { id: 'length',  label: 'At least 8 characters',        test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'One uppercase letter (A–Z)',    test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'One lowercase letter (a–z)',    test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',  label: 'One number (0–9)',              test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (!@#$…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

// Forgot password page that guides the user through email verification,
// OTP confirmation, password reset, and final success feedback.
export default function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [step, setStep]       = useState<Step>('email')
  const [email, setEmail]     = useState('')   // saved after step 1
  const [otp, setOtp]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Step 1 input — uncontrolled ref so cursor never jumps
  const emailRef = useRef<HTMLInputElement>(null)

  // Step 3 inputs — uncontrolled refs so focus never jumps between fields
  const newPassRef     = useRef<HTMLInputElement>(null)
  const confirmPassRef = useRef<HTMLInputElement>(null)

  // These state vars ONLY drive the visual checklist & match indicator.
  // They do NOT control the input values.
  const [passDisplay, setPassDisplay]       = useState('')
  const [confirmDisplay, setConfirmDisplay] = useState('')

  // Show/hide password toggles — stored separately so toggling never re-mounts inputs
  const [showPass, setShowPass]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const passOk    = passwordRules.every(r => r.test(passDisplay))
  const passMatch = passDisplay === confirmDisplay && confirmDisplay.length > 0

  // Run the resend countdown timer for OTP requests
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  // Send a password reset OTP to the entered email address
  const sendOtp = useCallback(async (emailVal: string) => {
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/forgot-password', { email: emailVal })
      setCooldown(OTP_COOLDOWN)
      return true
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to send OTP. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // Step 1: validate the email and request an OTP
  const handleSendOtp = async () => {
    const val = emailRef.current?.value.trim().toLowerCase() ?? ''
    setError('')
    if (!val) { setError('Please enter your email address.'); return }
    const ok = await sendOtp(val)
    if (ok) { setEmail(val); setStep('otp') }
  }

  // Step 2: verify the OTP entered by the user
  const handleVerifyOtp = async () => {
    setError('')
    if (otp.length !== 6) { setError('Please enter the full 6-digit code.'); return }
    setLoading(true)
    try {
      await api.post('/auth/verify-otp', { email, otp })
      setStep('newpassword')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Incorrect code. Please try again.')
    } finally { setLoading(false) }
  }

  // Step 3: validate and submit the new password
  const handleReset = async () => {
    // Read directly from DOM refs — not from state
    const np = newPassRef.current?.value ?? ''
    const cp = confirmPassRef.current?.value ?? ''
    setError('')
    if (!passwordRules.every(r => r.test(np))) {
      setError('Password does not meet all requirements below.'); return
    }
    if (np !== cp) { setError('Passwords do not match. Please re-enter.'); return }
    setLoading(true)
    try {
      const res = await api.post('/auth/reset-password', { email, otp, new_password: np })
      localStorage.setItem('mindecho_token', res.data.access_token)
      localStorage.setItem('mindecho_user', JSON.stringify(res.data.user))
      setStep('success')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Reset failed. Please try again.')
    } finally { setLoading(false) }
  }

  // Reusable error message box shown when a request fails or input is invalid
  const ErrorBox = () => !error ? null : (
    <div className="bg-red-50 border border-red-200 rounded-btn px-4 py-3 flex items-start gap-2">
      <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-red-700 text-sm font-body">{error}</p>
    </div>
  )

  // Step 1 screen: collect the registered email address
  if (step === 'email') return (
    <Shell title="Forgot Password" subtitle="Enter your registered email to receive a reset code">
      <div className="space-y-4">
        <div>
          <label className="label">Registered Email Address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-400 pointer-events-none" />
            <input
              ref={emailRef}
              type="email"
              className="input pl-10"
              placeholder="your@email.com"
              autoFocus
              autoComplete="email"
              onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
            />
          </div>
          <p className="text-xs text-bark-400 font-body mt-1">Must be registered in MindEcho.</p>
        </div>
        <ErrorBox />
        <button type="button" className="btn-primary w-full" disabled={loading} onClick={handleSendOtp}>
          {loading && <Spinner size={18} className="text-white" />}
          {loading ? 'Sending code...' : 'Send Reset Code'}
          {!loading && <ArrowRight size={18} />}
        </button>
        <p className="text-center text-bark-400 text-sm font-body">
          Remembered it?{' '}
          <Link to="/login" className="text-primary-600 font-semibold hover:underline">Sign In</Link>
        </p>
      </div>
    </Shell>
  )

  // Step 2 screen: verify the 6-digit OTP code
  if (step === 'otp') return (
    <Shell title="Enter the Code" subtitle={`We sent a 6-digit code to ${email}`}>
      <div className="space-y-4">
        <div className="bg-primary-50 border border-primary-200 rounded-btn px-4 py-3">
          <p className="text-primary-700 text-sm font-body">
            📧 Check your inbox. No email set up? The code prints in the <strong>backend terminal</strong>.
          </p>
        </div>
        <div>
          <label className="label">6-Digit Code</label>
          <input
            type="text" inputMode="numeric"
            className="input text-center text-2xl font-display font-bold tracking-[0.5em]"
            placeholder="000000" maxLength={6} autoFocus
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
          />
        </div>

        {/* Resend with countdown */}
        <div className="text-center">
          {cooldown > 0 ? (
            <span className="text-bark-400 text-sm font-body">
              Didn't get your OTP?{' '}
              <span className="text-primary-600 font-semibold">Resend in {cooldown}s</span>
            </span>
          ) : (
            <button type="button"
              className="inline-flex items-center gap-1.5 text-primary-600 text-sm font-semibold hover:underline"
              disabled={loading}
              onClick={async () => { setOtp(''); await sendOtp(email) }}>
              <RefreshCw size={13} />
              Didn't get your OTP? Resend OTP
            </button>
          )}
        </div>

        <ErrorBox />
        <button type="button" className="btn-primary w-full"
          disabled={loading || otp.length !== 6} onClick={handleVerifyOtp}>
          {loading && <Spinner size={18} className="text-white" />}
          {loading ? 'Verifying...' : 'Verify Code'}
          {!loading && <ArrowRight size={18} />}
        </button>
        <button type="button"
          className="w-full text-center text-bark-400 text-sm font-body hover:text-bark-700 py-1"
          onClick={() => { setStep('email'); setOtp(''); setCooldown(0); setError('') }}>
          ← Wrong email? Go back
        </button>
      </div>
    </Shell>
  )

  // Step 3 screen: set and confirm the new password
  if (step === 'newpassword') return (
    <Shell title="Set New Password" subtitle="Choose a strong new password">
      <div className="space-y-4">

        {/* New password */}
        <div>
          <label className="label">New Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-400 pointer-events-none" />
            {/*
            Use an uncontrolled input so typing stays smooth.
            State is only used for checklist feedback, not for controlling the input value.
          */}
            <input
              ref={newPassRef}
              type={showPass ? 'text' : 'password'}
              className="input pl-10 pr-10"
              placeholder="Create a strong password"
              autoFocus
              autoComplete="new-password"
              onChange={e => setPassDisplay(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-bark-400 hover:text-bark-700"
              onMouseDown={e => { e.preventDefault(); setShowPass(v => !v) }}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {passDisplay.length > 0 && (
            <div className="mt-2 space-y-1 bg-cream-100 rounded-btn p-3">
              {passwordRules.map(r => {
                const ok = r.test(passDisplay)
                return (
                  <div key={r.id} className="flex items-center gap-2">
                    {ok ? <CheckCircle2 size={13} className="text-primary-600 flex-shrink-0" />
                        : <XCircle      size={13} className="text-bark-300 flex-shrink-0" />}
                    <span className={`text-xs font-body ${ok ? 'text-primary-700' : 'text-bark-400'}`}>
                      {r.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="label">Confirm New Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bark-400 pointer-events-none" />
            <input
              ref={confirmPassRef}
              type={showConfirm ? 'text' : 'password'}
              className={`input pl-10 pr-10 ${
                confirmDisplay.length > 0 ? (passMatch ? 'border-primary-500' : 'border-red-400') : ''
              }`}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              onChange={e => setConfirmDisplay(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-bark-400 hover:text-bark-700"
              onMouseDown={e => { e.preventDefault(); setShowConfirm(v => !v) }}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {confirmDisplay.length > 0 && (
            <p className={`text-xs mt-1 font-body ${passMatch ? 'text-primary-600' : 'text-red-500'}`}>
              {passMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
            </p>
          )}
        </div>

        <ErrorBox />

        <button type="button" className="btn-primary w-full"
          disabled={loading || !passOk || !passMatch} onClick={handleReset}>
          {loading && <Spinner size={18} className="text-white" />}
          {loading ? 'Resetting...' : 'Reset Password'}
          {!loading && <ArrowRight size={18} />}
        </button>
      </div>
    </Shell>
  )

  // Step 4 screen: show success message after password reset
  if (step === 'success') return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card text-center space-y-6 py-10">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={48} className="text-primary-600" />
            </div>
          </div>
          <div>
            <h1 className="font-display font-bold text-bark-900 text-2xl mb-2">Password Changed! 🎉</h1>
            <p className="text-bark-500 font-body text-sm leading-relaxed">
              Your password has been successfully updated.<br />
              You are now logged in and ready to go.
            </p>
          </div>
          <div className="bg-primary-50 border border-primary-200 rounded-card px-5 py-4 text-left space-y-2">
            {[
              'Password updated successfully',
              'You are now logged in automatically',
              'Old password can no longer be used',
            ].map(t => (
              <div key={t} className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-primary-600 flex-shrink-0" />
                <span className="text-sm font-body text-primary-700">{t}</span>
              </div>
            ))}
          </div>
          <button type="button" className="btn-green w-full text-lg py-4"
            onClick={() => navigate('/dashboard')}>
            Go to Dashboard <ArrowRight size={20} />
          </button>
          <p className="text-bark-400 text-xs font-body">
            Changed on {new Date().toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </p>
        </div>
      </div>
    </div>
  )

  return null
}

// Shared layout wrapper used across all forgot-password steps
function Shell({ title, subtitle, children }: {
  title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-bark-800 rounded-2xl mb-3">
            <Brain size={28} className="text-cream-100" />
          </div>
          <h1 className="font-display font-bold text-bark-900 text-2xl">{title}</h1>
          <p className="text-bark-400 font-body text-sm mt-1 max-w-xs mx-auto">{subtitle}</p>
        </div>
        <div className="card space-y-4">{children}</div>
      </div>
    </div>
  )
}