import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Layers, Loader2, CheckCircle } from 'lucide-react'
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
  urlToken?: string
  onNeedVerifyOtp?: (email: string, purpose: string) => void
}

export default function Auth({ onAuth, onBack, defaultMode = 'login', urlToken, onNeedVerifyOtp }: Props) {
  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (mode === 'verify-email' && urlToken) {
      setLoading(true)
      verifyEmail(urlToken)
        .then(() => { setInfo('Email verified! You can now log in.'); setMode('login') })
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
        onNeedVerifyOtp?.(trimEmail, 'registration')
        return
      } else if (mode === 'forgot-password') {
        await forgotPassword(trimEmail)
        onNeedVerifyOtp?.(trimEmail, 'password_reset')
        return
      } else if (mode === 'reset-password' && urlToken) {
        await resetPassword(urlToken, newPassword)
        setInfo('Password reset successfully. You can now log in.')
        setMode('login')
      }
    } catch (err: any) {
      const status = err.response?.status
      if (status === 403 && mode === 'login') {
        setError(err.response.data?.detail || 'Your email is not verified. Please check your inbox.')
      } else if (status === 423) {
        const detail: string = err.response?.data?.detail ?? ''
        const match = detail.match(/until (.+)$/)
        if (match) {
          const until = new Date(match[1])
          const mins = Math.ceil((until.getTime() - Date.now()) / 60000)
          setError(`Too many failed attempts. Account locked — try again in ${mins > 0 ? mins : 1} minute${mins !== 1 ? 's' : ''}.`)
        } else {
          setError('Account temporarily locked. Try again in 15 minutes.')
        }
      } else if (status === 429) {
        setError('Too many attempts. Please wait a few minutes.')
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

  const inputCls = 'w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors'

  // ── Confirmation screens ────────────────────────────────────────────────────
  if (mode === 'verification-pending' || mode === 'forgot-sent') {
    const isVerify = mode === 'verification-pending'
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 dark:[background-image:radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.12),transparent)] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md p-8 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={22} strokeWidth={1.5} className="text-violet-500" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Check your inbox</h2>
          <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
            {isVerify
              ? <>Verification link sent to <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>. Click it to activate your account.</>
              : <>If <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span> is registered, a reset link is on its way (valid 60 min).</>
            }
          </p>
          {isVerify && (
            <button onClick={handleResend} disabled={loading} className="text-sm text-violet-500 hover:text-violet-400 disabled:opacity-50 mb-5 block mx-auto transition-colors cursor-pointer">
              Didn't receive it? Resend
            </button>
          )}
          {info && <p className="text-xs text-green-600 dark:text-green-400 mb-4">{info}</p>}
          <button
            onClick={() => { setMode('login'); setError(''); setInfo('') }}
            className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            ← Back to sign in
          </button>
          {onBack && (
            <button onClick={onBack} className="mt-3 block w-full text-center text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
              ← Back to home
            </button>
          )}
        </motion.div>
      </div>
    )
  }

  const title =
    mode === 'login'           ? 'Welcome back' :
    mode === 'register'        ? 'Create your account' :
    mode === 'forgot-password' ? 'Reset your password' :
    'Set new password'

  const subtitle =
    mode === 'login'           ? 'Sign in to continue your interview prep.' :
    mode === 'register'        ? 'Start your AI-powered job interview coaching.' :
    mode === 'forgot-password' ? "Enter your email and we'll send a reset link." :
    'Enter your new password below.'

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 dark:[background-image:radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(139,92,246,0.12),transparent)] flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <Layers size={20} strokeWidth={1.5} className="text-violet-500" />
        <span className="font-semibold text-zinc-900 dark:text-zinc-50 text-base tracking-tight">HireIQ</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8"
      >
        <div className="mb-6">
          <motion.h1 key={mode + '-t'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
            {title}
          </motion.h1>
          <motion.p key={mode + '-s'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.05 }}
            className="text-sm text-zinc-500">
            {subtitle}
          </motion.p>
        </div>

        {/* Tab toggle */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex gap-0 mb-6 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setInfo(''); setShowPassword(false) }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
                  mode === m
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        {info && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-green-700 dark:text-green-400 text-xs bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 px-3 py-2.5 rounded-md mb-4 flex items-center gap-2">
            <CheckCircle size={13} strokeWidth={2} />
            {info}
          </motion.div>
        )}

        <form onSubmit={submit} className="space-y-3.5">
          {mode !== 'reset-password' && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Email address</label>
              <input type="email" placeholder="you@example.com" required value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
          )}

          {mode === 'register' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.2 }}>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Username</label>
              <input type="text" placeholder="johndoe" required value={username}
                onChange={(e) => setUsername(e.target.value)} className={inputCls} />
            </motion.div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Password</label>
                {mode === 'login' && (
                  <button type="button"
                    onClick={() => { setMode('forgot-password'); setError(''); setInfo('') }}
                    className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? 'Min 6 characters' : '••••••••'}
                  required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls + ' pr-10'}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
          )}

          {mode === 'reset-password' && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} placeholder="Min 6 characters"
                  required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputCls + ' pr-10'}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2.5 rounded-md">
              <p>{error}</p>
              {mode === 'login' && error.toLowerCase().includes('verif') && (
                <button type="button" onClick={handleResend} disabled={loading}
                  className="mt-1.5 underline text-violet-500 hover:text-violet-400 disabled:opacity-50 cursor-pointer">
                  Resend verification email
                </button>
              )}
            </motion.div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-violet-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-violet-500 disabled:opacity-50 transition-colors cursor-pointer mt-1 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> Please wait…</>
            ) : mode === 'login' ? 'Sign in to HireIQ'
              : mode === 'register' ? 'Create account'
              : mode === 'forgot-password' ? 'Send reset link'
              : 'Set new password'}
          </button>
        </form>

        {(mode === 'forgot-password' || mode === 'reset-password') && (
          <button
            onClick={() => { setMode('login'); setError(''); setInfo('') }}
            className="mt-5 w-full text-center text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
            ← Back to sign in
          </button>
        )}

        {onBack && (mode === 'login' || mode === 'register') && (
          <button onClick={onBack}
            className="mt-4 w-full text-center text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
            ← Back to home
          </button>
        )}
      </motion.div>
    </div>
  )
}
