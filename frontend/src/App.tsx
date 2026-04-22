import { useEffect, useState } from 'react'
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
import { getMe } from './api'
import type { CVUploadResponse, UserProfile } from './api'

type Page = 'home' | 'upload' | 'results' | 'history' | 'detail' | 'interview' | 'profile'
type View = 'landing' | 'auth' | 'app'

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
  const [view, setView] = useState<View>(
    localStorage.getItem('access_token') ? 'app' : 'landing'
  )
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register')
  const [page, setPage] = useState<Page>('home')
  const [result, setResult] = useState<CVUploadResponse | null>(null)
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([])
  const [interviewSessionId, setInterviewSessionId] = useState<number | undefined>()
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  // Fetch user profile once logged in
  useEffect(() => {
    if (view === 'app') {
      getMe().then((res) => setProfile(res.data)).catch(() => {})
    }
  }, [view])

  const goToAuth = (mode: 'register' | 'login') => { setAuthMode(mode); setView('auth') }
  const onAuth = () => { setView('app'); setPage('home') }
  const logout = () => { localStorage.clear(); setProfile(null); setView('landing') }

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
  if (view === 'auth') return <Auth defaultMode={authMode} onAuth={onAuth} onBack={() => setView('landing')} />

  const navItems = [
    { id: 'home'      as const, label: 'Home' },
    { id: 'upload'    as const, label: 'Analyze' },
    { id: 'history'   as const, label: 'History' },
    { id: 'interview' as const, label: 'Interview' },
  ]

  const activeNav = (id: Page) =>
    page === id || (page === 'detail' && id === 'history') || (page === 'results' && id === 'upload')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-purple-100 px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm shadow-purple-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setPage('home')}>
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-purple-700 text-lg tracking-tight">HireIQ</span>
        </div>

        <div className="flex items-center gap-6">
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

          {/* Profile avatar */}
          <NavAvatar profile={profile} onClick={() => setPage('profile')} />
        </div>
      </nav>

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
