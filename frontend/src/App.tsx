import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Upload from './pages/Upload'
import Results from './pages/Results'
import History from './pages/History'
import SessionDetail from './pages/SessionDetail'
import Interview from './pages/Interview'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import { getMe, logout as apiLogout } from './api'
import type { CVUploadResponse, UserProfile } from './api'
import { useToast } from './components/Toast'

type Page = 'home' | 'upload' | 'results' | 'history' | 'detail' | 'interview' | 'profile'
type View = 'landing' | 'auth' | 'app'

function getInitialViewAndMode(): { view: View; authMode: 'register' | 'login' | 'verify-email' | 'reset-password'; urlToken?: string } {
  const path = window.location.pathname
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') ?? undefined
  if (path === '/verify-email' && token) return { view: 'auth', authMode: 'verify-email', urlToken: token }
  if (path === '/reset-password' && token) return { view: 'auth', authMode: 'reset-password', urlToken: token }
  if (localStorage.getItem('access_token')) return { view: 'app', authMode: 'login' }
  return { view: 'landing', authMode: 'register' }
}

const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
}

function NavAvatar({ profile, onClick }: { profile: UserProfile | null; onClick: () => void }) {
  const reduced = useReducedMotion()
  const initials = profile?.username ? profile.username.slice(0, 2).toUpperCase() : '?'
  return (
    <motion.button
      onClick={onClick}
      whileHover={reduced ? {} : { scale: 1.08 }}
      whileTap={reduced ? {} : { scale: 0.94 }}
      transition={{ duration: 0.15 }}
      className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm shadow-purple-200 cursor-pointer"
      title={profile?.username ?? 'Profile'}
    >
      <span className="text-xs font-bold text-white">{initials}</span>
    </motion.button>
  )
}

export default function App() {
  const toast = useToast()
  const _init = getInitialViewAndMode()
  const [view, setView] = useState<View>(_init.view)
  const [authMode, setAuthMode] = useState<'register' | 'login' | 'verify-email' | 'reset-password'>(_init.authMode)
  const [urlToken] = useState<string | undefined>(_init.urlToken)
  const [page, setPage] = useState<Page>('home')
  const [result, setResult] = useState<CVUploadResponse | null>(null)
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([])
  const [interviewSessionId, setInterviewSessionId] = useState<number | undefined>()
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Force logout when the token refresh fails (interceptor dispatches this)
  const [offline, setOffline] = useState(false)

  const toastRef = useRef(toast)
  toastRef.current = toast

  // True only after the user has authenticated in THIS browser session.
  // Prevents the "session expired" toast from firing on page load when the
  // user simply has stale tokens from a previous session.
  const sessionAuthenticated = useRef(false)

  // Session expiry — interceptor fires this when refresh token is invalid
  useEffect(() => {
    const handle = () => {
      const wasActive = sessionAuthenticated.current
      sessionAuthenticated.current = false
      localStorage.clear()
      setProfile(null)
      setView('landing')
      if (wasActive) {
        toastRef.current.error('Your session expired. Please sign in again.')
      }
    }
    window.addEventListener('auth:expired', handle)
    return () => window.removeEventListener('auth:expired', handle)
  }, [])

  // Backend connectivity banner
  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline  = () => {
      setOffline(false)
      toastRef.current.success('Connection restored.')
    }
    window.addEventListener('network:offline', goOffline)
    window.addEventListener('network:online',  goOnline)
    return () => {
      window.removeEventListener('network:offline', goOffline)
      window.removeEventListener('network:online',  goOnline)
    }
  }, [])

  // Fetch user profile once logged in
  useEffect(() => {
    if (view === 'app') {
      getMe()
        .then((res) => {
          setProfile(res.data)
          sessionAuthenticated.current = true  // tokens confirmed valid
        })
        .catch(() => {})
    }
  }, [view])

  const goToAuth = (mode: 'register' | 'login') => { setAuthMode(mode as any); setView('auth') }
  const onAuth = () => { sessionAuthenticated.current = true; setView('app'); setPage('home') }
  const logout = () => {
    const refreshToken = localStorage.getItem('refresh_token') ?? undefined
    apiLogout(refreshToken).catch(() => {})
    localStorage.clear()
    setProfile(null)
    setView('landing')
  }

  const goToPractice = (questions: string[], sessionId?: number) => {
    setInterviewQuestions(questions)
    setInterviewSessionId(sessionId)
    setPage('interview')
  }

  const openDetail = (sessionId: number) => {
    setDetailSessionId(sessionId)
    setPage('detail')
  }

  if (view === 'landing') return <Landing onGetStarted={() => goToAuth('register')} onLogin={() => goToAuth('login')} />
  if (view === 'auth') return <Auth defaultMode={authMode as any} urlToken={urlToken} onAuth={onAuth} onBack={authMode === 'login' || authMode === 'register' ? () => setView('landing') : undefined} />

  const navItems = [
    { id: 'home'      as const, label: 'Home' },
    { id: 'upload'    as const, label: 'Analyze' },
    { id: 'history'   as const, label: 'History' },
    { id: 'interview' as const, label: 'Interview' },
  ]

  const activeNav = (id: Page) =>
    page === id || (page === 'detail' && id === 'history') || (page === 'results' && id === 'upload')

  const goToPage = (id: Page) => { setPage(id); setMobileOpen(false) }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-purple-100 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm shadow-purple-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => goToPage('home')}>
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-purple-700 text-lg tracking-tight">HireIQ</span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map(({ id, label }) => (
            <motion.button
              key={id}
              onClick={() => setPage(id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={`text-sm font-medium transition-colors cursor-pointer ${
                activeNav(id) ? 'text-purple-600' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
              {activeNav(id) && (
                <motion.div layoutId="nav-underline" className="h-0.5 bg-purple-600 rounded-full mt-0.5" />
              )}
            </motion.button>
          ))}
          <NavAvatar profile={profile} onClick={() => setPage('profile')} />
        </div>

        {/* Mobile: avatar + hamburger */}
        <div className="flex md:hidden items-center gap-3">
          <NavAvatar profile={profile} onClick={() => goToPage('profile')} />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:bg-purple-50 hover:text-purple-600 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              {mobileOpen ? (
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Offline banner */}
      <AnimatePresence>
        {offline && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-800 font-medium"
          >
            <svg className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Cannot reach the server — waiting for connection…
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
              className="fixed top-0 right-0 bottom-0 w-72 bg-white z-[60] shadow-2xl flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">Menu</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col p-2 gap-1 flex-1">
                {navItems.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => goToPage(id)}
                    className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      activeNav(id)
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => goToPage('profile')}
                  className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    page === 'profile' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Profile
                </button>
              </nav>
              <button
                onClick={() => { setMobileOpen(false); logout() }}
                className="m-4 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors cursor-pointer"
              >
                Log out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {page === 'home' && (
          <motion.div key="home" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Dashboard
              onAnalyze={() => setPage('upload')}
              onHistory={() => setPage('history')}
              onInterview={() => setPage('interview')}
              onSession={openDetail}
            />
          </motion.div>
        )}

        {page === 'upload' && (
          <motion.div key="upload" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Upload onDone={(r) => { setResult(r); setPage('results') }} />
          </motion.div>
        )}

        {page === 'results' && result && (
          <motion.div key="results" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Results
              result={result}
              onBack={() => setPage('upload')}
              onPractice={(qs) => goToPractice(qs, result.session_id)}
            />
          </motion.div>
        )}
        {page === 'results' && !result && (
          <motion.div key="no-results" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="text-center py-20 text-gray-400 text-sm">
            Upload a CV first.
          </motion.div>
        )}

        {page === 'history' && (
          <motion.div key="history" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <History onSelect={openDetail} />
          </motion.div>
        )}

        {page === 'detail' && detailSessionId != null && (
          <motion.div key={`detail-${detailSessionId}`} variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <SessionDetail
              sessionId={detailSessionId}
              onBack={() => setPage('history')}
              onPractice={(qs) => goToPractice(qs, detailSessionId)}
            />
          </motion.div>
        )}

        {page === 'interview' && (
          <motion.div key="interview" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Interview sessionId={interviewSessionId} questions={interviewQuestions} />
          </motion.div>
        )}

        {page === 'profile' && (
          <motion.div key="profile" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Profile onBack={() => setPage('home')} onLogout={logout} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
