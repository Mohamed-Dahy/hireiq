import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  login,
  register,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from '../api'

type AuthMode =
  | 'login'
  | 'register'
  | 'verification-pending'
  | 'forgot-password'
  | 'forgot-sent'
  | 'verify-email'
  | 'reset-password'

interface Props {
  onAuth: () => void
  onBack?: () => void
  defaultMode?: AuthMode
  /** Token from URL query string — used for verify-email and reset-password modes */
  urlToken?: string
}

export default function Auth({ onAuth, onBack, defaultMode = 'login', urlToken }: Props) {
  const reduced = useReducedMotion()
  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Auto-verify when arriving from email link
  useEffect(() => {
    if (mode === 'verify-email' && urlToken) {
      setLoading(true)
      verifyEmail(urlToken)
        .then(() => {
          setInfo('Email verified! You can now log in.')
          setMode('login')
        })
        .catch((err: any) => {
          const detail = err.response?.data?.detail
          setError(detail || 'Verification failed. The link may have expired.')
          setMode('login')
        })
        .finally(() => setLoading(false))
    }
  }, [])

  const handleErr = (err: any) => {
    const detail = err.response?.data?.detail
    setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : detail || 'Something went wrong')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    const trimEmail    = email.trim()
    const trimUsername = username.trim()

    try {
      if (mode === 'login') {
        const res = await login(trimEmail, password)
        localStorage.setItem('access_token', res.data.access_token)
        localStorage.setItem('refresh_token', res.data.refresh_token)
        onAuth()

      } else if (mode === 'register') {
        await register(trimEmail, trimUsername, password)
        setMode('verification-pending')

      } else if (mode === 'forgot-password') {
        await forgotPassword(trimEmail)
        setMode('forgot-sent')

      } else if (mode === 'reset-password' && urlToken) {
        await resetPassword(urlToken, newPassword)
        setInfo('Password reset successfully. You can now log in.')
        setMode('login')
      }
    } catch (err: any) {
      const status = err.response?.status

      if (status === 403 && mode === 'login') {
        // Email not verified — show resend option
        setError(err.response.data?.detail || 'Your email is not verified. Please check your inbox.')

      } else if (status === 423) {
        // Account locked — parse the ISO timestamp and show human-readable time
        const detail: string = err.response?.data?.detail ?? ''
        const match = detail.match(/until (.+)$/)
        if (match) {
          const until = new Date(match[1])
          const mins = Math.ceil((until.getTime() - Date.now()) / 60000)
          setError(`Too many failed attempts. Account locked — try again in ${mins > 0 ? mins : 1} minute${mins !== 1 ? 's' : ''}.`)
        } else {
          setError('Account temporarily locked due to too many failed attempts. Try again in 15 minutes.')
        }

      } else if (status === 429) {
        setError('Too many attempts. Please wait a few minutes before trying again.')

      } else {
        handleErr(err)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email) { setError('Enter your email first'); return }
    setError('')
    setLoading(true)
    try {
      await resendVerification(email)
      setInfo('Verification email sent. Check your inbox.')
    } catch {
      setInfo('Verification email sent. Check your inbox.')
    } finally {
      setLoading(false)
    }
  }

  // ── Verification pending ──────────────────────────────────────────────────
  if (mode === 'verification-pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="bg-white rounded-2xl shadow-xl shadow-purple-100 w-full max-w-md p-8 border border-purple-100 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-sm text-gray-500 mb-6">
            We sent a verification link to <span className="font-medium text-purple-700">{email}</span>.
            Click it to activate your account.
          </p>
          <button
            onClick={handleResend}
            disabled={loading}
            className="text-sm text-purple-600 hover:underline disabled:opacity-50"
          >
            Didn't receive it? Resend
          </button>
          {info && <p className="mt-3 text-xs text-green-600">{info}</p>}
          {onBack && (
            <button
              onClick={onBack}
              className="mt-5 w-full text-center text-sm text-gray-400 hover:text-purple-600 transition-colors cursor-pointer"
            >
              ← Back to home
            </button>
          )}
        </motion.div>
      </div>
    )
  }

  // ── Forgot-sent confirmation ──────────────────────────────────────────────
  if (mode === 'forgot-sent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="bg-white rounded-2xl shadow-xl shadow-purple-100 w-full max-w-md p-8 border border-purple-100 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6"/>
              <rect x="2" y="4" width="20" height="16" rx="2"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-sm text-gray-500 mb-6">
            If <span className="font-medium text-purple-700">{email}</span> is registered, a password reset link is on its way (valid 60 min).
          </p>
          <button
            onClick={() => { setMode('login'); setError(''); setInfo('') }}
            className="text-sm text-purple-600 hover:underline"
          >
            Back to log in
          </button>
        </motion.div>
      </div>
    )
  }

  // ── Main form (login / register / forgot-password / reset-password) ────────
  const title =
    mode === 'login' ? 'Welcome back' :
    mode === 'register' ? 'Create your account' :
    mode === 'forgot-password' ? 'Reset your password' :
    'Set new password'

  const subtitle =
    mode === 'login' ? 'Log in to continue your interview prep.' :
    mode === 'register' ? 'Start your AI-powered job interview coaching.' :
    mode === 'forgot-password' ? 'Enter your email and we\'ll send a reset link.' :
    'Enter your new password below.'

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <motion.div
        initial={reduced ? {} : { opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="bg-white rounded-2xl shadow-xl shadow-purple-100 w-full max-w-md p-8 border border-purple-100"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-purple-700 text-lg">HireIQ</span>
        </div>

        <motion.h2
          key={mode + '-title'}
          initial={reduced ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-xl font-bold text-gray-900 mb-1"
        >
          {title}
        </motion.h2>
        <motion.p
          key={mode + '-sub'}
          initial={reduced ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="text-sm text-gray-500 mb-6"
        >
          {subtitle}
        </motion.p>

        {/* Login / Register toggle — only show for login/register modes */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex gap-2 mb-6 bg-gray-50 p-1 rounded-xl">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setInfo(''); setShowPassword(false) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  mode === m
                    ? 'bg-white text-purple-700 shadow-sm border border-purple-100'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'login' ? 'Log in' : 'Register'}
              </button>
            ))}
          </div>
        )}

        {/* Success info banner */}
        {info && (
          <motion.p
            initial={reduced ? {} : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-green-700 text-xs bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-4"
          >
            {info}
          </motion.p>
        )}

        <form onSubmit={submit} className="space-y-4">
          {/* Email — shown on login, register, forgot-password */}
          {mode !== 'reset-password' && (
            <motion.input
              whileFocus={reduced ? {} : { scale: 1.01 }}
              transition={{ duration: 0.15 }}
              type="email" placeholder="Email address" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          )}

          {/* Username — register only */}
          {mode === 'register' && (
            <motion.input
              initial={reduced ? {} : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              whileFocus={reduced ? {} : { scale: 1.01 }}
              type="text" placeholder="Username" required value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          )}

          {/* Password — login and register */}
          {(mode === 'login' || mode === 'register') && (
            <div className="relative">
              <motion.input
                whileFocus={reduced ? {} : { scale: 1.01 }}
                transition={{ duration: 0.15 }}
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* New password — reset-password mode */}
          {mode === 'reset-password' && (
            <div className="relative">
              <motion.input
                whileFocus={reduced ? {} : { scale: 1.01 }}
                transition={{ duration: 0.15 }}
                type={showPassword ? 'text' : 'password'}
                placeholder="New password (min 6 chars)"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          )}

          {/* Forgot password link — login mode only */}
          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setMode('forgot-password'); setError(''); setInfo('') }}
                className="text-xs text-purple-500 hover:text-purple-700 transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg"
            >
              <p>{error}</p>
              {/* Resend link when email is unverified */}
              {mode === 'login' && error.toLowerCase().includes('verif') && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="mt-1 underline text-purple-600 hover:text-purple-800 disabled:opacity-50"
                >
                  Resend verification email
                </button>
              )}
            </motion.div>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={reduced ? {} : { scale: 1.02 }}
            whileTap={reduced ? {} : { scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="w-full bg-purple-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm shadow-purple-200 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Please wait…
              </span>
            ) : mode === 'login' ? 'Log in'
              : mode === 'register' ? 'Create account'
              : mode === 'forgot-password' ? 'Send reset link'
              : 'Set new password'}
          </motion.button>
        </form>

        {/* Back to login link for forgot-password / reset-password */}
        {(mode === 'forgot-password' || mode === 'reset-password') && (
          <button
            onClick={() => { setMode('login'); setError(''); setInfo('') }}
            className="mt-4 w-full text-center text-sm text-gray-400 hover:text-purple-600 transition-colors cursor-pointer"
          >
            ← Back to log in
          </button>
        )}

        {onBack && (mode === 'login' || mode === 'register') && (
          <motion.button
            onClick={onBack}
            whileHover={reduced ? {} : { x: -3 }}
            transition={{ duration: 0.15 }}
            className="mt-5 w-full text-center text-sm text-gray-400 hover:text-purple-600 transition-colors cursor-pointer"
          >
            ← Back to home
          </motion.button>
        )}
      </motion.div>
    </div>
  )
}
