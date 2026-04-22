import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { login, register } from '../api'

interface Props {
  onAuth: () => void
  onBack?: () => void
  defaultMode?: 'login' | 'register'
}

export default function Auth({ onAuth, onBack, defaultMode = 'login' }: Props) {
  const reduced = useReducedMotion()
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = mode === 'login'
        ? await login(email, password)
        : await register(email, username, password)
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      onAuth()
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

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
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </motion.h2>
        <motion.p
          key={mode + '-sub'}
          initial={reduced ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="text-sm text-gray-500 mb-6"
        >
          {mode === 'login' ? 'Log in to continue your interview prep.' : 'Start your AI-powered job interview coaching.'}
        </motion.p>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6 bg-gray-50 p-1 rounded-xl">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
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

        <form onSubmit={submit} className="space-y-4">
          <motion.input
            whileFocus={reduced ? {} : { scale: 1.01 }}
            transition={{ duration: 0.15 }}
            type="email" placeholder="Email address" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
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
          <motion.input
            whileFocus={reduced ? {} : { scale: 1.01 }}
            transition={{ duration: 0.15 }}
            type="password" placeholder="Password" required value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />

          {error && (
            <motion.p
              initial={reduced ? {} : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg"
            >
              {error}
            </motion.p>
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
            ) : mode === 'login' ? 'Log in' : 'Create account'}
          </motion.button>
        </form>

        {onBack && (
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
