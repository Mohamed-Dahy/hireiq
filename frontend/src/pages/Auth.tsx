import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Layers, Loader2, CheckCircle, BrainCircuit, Target, TrendingUp } from 'lucide-react'
import { login, register, forgotPassword } from '../api'

type AuthMode = 'login' | 'register' | 'forgot-password'

interface Props {
  onAuth: () => void
  onBack?: () => void
  defaultMode?: AuthMode
  onNeedVerifyOtp?: (email: string, purpose: string) => void
}

const FEATURES = [
  { icon: BrainCircuit, text: 'AI-generated feedback on your answers' },
  { icon: Target,       text: 'Practice with curated interview questions' },
  { icon: TrendingUp,   text: 'Track your readiness and progress' },
]

export default function Auth({ onAuth, onBack, defaultMode = 'login', onNeedVerifyOtp }: Props) {
  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
      }
    } catch (err: any) {
      const status = err.response?.status
      if (status === 403 && mode === 'login') {
        setError('Your email is not verified.')
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

  const handleGoToVerify = () => {
    if (!email.trim()) { setError('Enter your email first'); return }
    onNeedVerifyOtp?.(email.trim(), 'registration')
  }

  const inputCls = 'w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white dark:focus:bg-zinc-800 transition-all'

  const title =
    mode === 'login'           ? 'Welcome back' :
    mode === 'register'        ? 'Create your account' :
    'Reset your password'

  const subtitle =
    mode === 'login'           ? 'Sign in to continue your interview prep.' :
    mode === 'register'        ? 'Start your AI-powered job interview coaching.' :
    "Enter your email and we'll send you a verification code."

  const showTabs = mode === 'login' || mode === 'register'

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel (lg+) ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-2/5 bg-linear-to-br from-primary-600 via-primary-700 to-primary-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute top-1/2 -right-8 w-40 h-40 rounded-full bg-white/5" />

        <div className="relative z-10 max-w-xs">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Layers size={20} strokeWidth={1.5} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">HireIQ</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-3 leading-snug">
            Ace your next interview
          </h2>
          <p className="text-primary-200 text-sm leading-relaxed mb-10">
            AI-powered coaching that adapts to your role and experience level.
          </p>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon size={15} strokeWidth={1.5} className="text-white" />
                </div>
                <span className="text-sm text-primary-100">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-white dark:bg-zinc-950">
        <div className="lg:hidden flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={18} strokeWidth={1.5} className="text-primary-500" />
            <span className="font-bold text-zinc-900 dark:text-zinc-50 text-lg tracking-tight">HireIQ</span>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 tracking-wide">AI-powered interview coaching</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          <div className="mb-7">
            <motion.h1
              key={mode + '-t'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1"
            >
              {title}
            </motion.h1>
            <motion.p
              key={mode + '-s'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="text-sm text-zinc-500 dark:text-zinc-400"
            >
              {subtitle}
            </motion.p>
          </div>

          {showTabs && (
            <div className="flex mb-7 border-b border-zinc-200 dark:border-zinc-800">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); setInfo(''); setShowPassword(false) }}
                  className={`relative flex-1 pb-3 text-sm font-semibold transition-colors duration-200 cursor-pointer ${
                    mode === m
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  {m === 'login' ? 'Sign in' : 'Sign up'}
                  {mode === m && (
                    <motion.div
                      layoutId="auth-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {info && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-green-700 dark:text-green-400 text-xs bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 px-3 py-2.5 rounded-xl mb-4 flex items-center gap-2"
            >
              <CheckCircle size={13} strokeWidth={2} />
              {info}
            </motion.div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                type="email" placeholder="you@example.com" required value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputCls}
              />
            </div>

            {mode === 'register' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.2 }}>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">Username</label>
                <input
                  type="text" placeholder="johndoe" required value={username}
                  onChange={(e) => setUsername(e.target.value)} className={inputCls}
                />
              </motion.div>
            )}

            {(mode === 'login' || mode === 'register') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Password</label>
                  {mode === 'login' && (
                    <button type="button"
                      onClick={() => { setMode('forgot-password'); setError(''); setInfo('') }}
                      className="text-xs text-primary-500 hover:text-primary-400 transition-colors cursor-pointer font-medium">
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
                    className={inputCls + ' pr-11'}
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2.5 rounded-xl">
                <p>{error}</p>
                {mode === 'login' && error.toLowerCase().includes('verif') && (
                  <button type="button" onClick={handleGoToVerify} disabled={loading}
                    className="mt-1.5 underline text-primary-500 hover:text-primary-400 disabled:opacity-50 cursor-pointer">
                    Verify your email →
                  </button>
                )}
              </motion.div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-primary-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-500 active:bg-primary-700 disabled:opacity-50 transition-colors cursor-pointer mt-1 flex items-center justify-center gap-2 shadow-sm shadow-primary-200 dark:shadow-primary-900/30"
            >
              {loading ? (
                <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> Please wait…</>
              ) : mode === 'login' ? 'Sign in to HireIQ'
                : mode === 'register' ? 'Create account'
                : 'Send reset code'}
            </button>
          </form>

          {mode === 'forgot-password' && (
            <button
              onClick={() => { setMode('login'); setError(''); setInfo('') }}
              className="mt-5 w-full text-center text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
              ← Back to sign in
            </button>
          )}

          {onBack && showTabs && (
            <button onClick={onBack}
              className="mt-4 w-full text-center text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
              ← Back to home
            </button>
          )}
        </motion.div>
      </div>
    </div>
  )
}
