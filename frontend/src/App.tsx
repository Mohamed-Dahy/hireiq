import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Layers, Menu, X, Loader2, ChevronDown, Map, BookOpen, Mic, Clock, Briefcase, Users, Share2, Zap } from 'lucide-react'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import VerifyOtp from './pages/VerifyOtp'
import ThemeToggle from './components/ThemeToggle'
import { getMe, logout as apiLogout, getJobStats, getReferralStats } from './api'
import type { CVUploadResponse, UserProfile } from './api'
import { useToast } from './components/Toast'

// Lazy load heavier pages for better initial load
const Upload = lazy(() => import('./pages/Upload'))
const Results = lazy(() => import('./pages/Results'))
const History = lazy(() => import('./pages/History'))
const SessionDetail = lazy(() => import('./pages/SessionDetail'))
const Interview = lazy(() => import('./pages/Interview'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const Jobs = lazy(() => import('./pages/Jobs'))
const Recruiter = lazy(() => import('./pages/Recruiter'))
const Referrals = lazy(() => import('./pages/Referrals'))
const CareerRoadmap = lazy(() => import('./pages/CareerRoadmap'))
const Bank = lazy(() => import('./pages/Bank'))

type Page = 'home' | 'upload' | 'results' | 'history' | 'detail' | 'interview' | 'profile' | 'jobs' | 'recruiter' | 'referrals' | 'roadmap' | 'bank'
type View = 'landing' | 'auth' | 'app' | 'verify-otp'

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 size={28} strokeWidth={1.5} className="animate-spin text-primary-500" />
  </div>
)

function getInitialViewAndMode(): { view: View; authMode: 'register' | 'login' } {
  const path = window.location.pathname
  if (path === '/verify-otp') return { view: 'verify-otp', authMode: 'register' }
  if (path === '/auth') return { view: 'auth', authMode: 'login' }
  if (path === '/referrals' && localStorage.getItem('access_token')) return { view: 'app', authMode: 'login' }
  if (localStorage.getItem('access_token')) return { view: 'app', authMode: 'login' }
  return { view: 'landing', authMode: 'register' }
}

const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0, 0, 0.2, 1] } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
}

function NavAvatar({ profile, onClick }: { profile: UserProfile | null; onClick: () => void }) {
  const initials = profile?.username ? profile.username.slice(0, 2).toUpperCase() : '?'
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors shrink-0"
      title={profile?.username ?? 'Profile'}
    >
      <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">{initials}</span>
    </button>
  )
}

export default function App() {
  const toast = useToast()
  const _init = getInitialViewAndMode()
  const [view, setView] = useState<View>(_init.view)
  const [authMode, setAuthMode] = useState<'register' | 'login'>(_init.authMode)
  const [page, setPage] = useState<Page>('home')
  const [result, setResult] = useState<CVUploadResponse | null>(null)
  const [interviewQuestions, setInterviewQuestions] = useState<string[]>([])
  const [interviewSessionId, setInterviewSessionId] = useState<number | undefined>()
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activePipelineCount, setActivePipelineCount] = useState<number | null>(null)
  const [referralConversionCount, setReferralConversionCount] = useState<number>(0)
  const [roadmapSessionId, setRoadmapSessionId] = useState<number | null>(null)
  const [offline, setOffline] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpPurpose, setOtpPurpose] = useState('registration')

  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')
  const [toolsOpen, setToolsOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const toolsRef = useRef<HTMLDivElement>(null)
  const manageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false)
      if (manageRef.current && !manageRef.current.contains(e.target as Node)) setManageOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toastRef = useRef(toast)
  toastRef.current = toast
  const sessionAuthenticated = useRef(false)

  useEffect(() => {
    const handle = () => {
      const wasActive = sessionAuthenticated.current
      sessionAuthenticated.current = false
      localStorage.clear()
      setProfile(null)
      setView('landing')
      if (wasActive) toastRef.current.error('Your session expired. Please sign in again.')
    }
    window.addEventListener('auth:expired', handle)
    return () => window.removeEventListener('auth:expired', handle)
  }, [])

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline  = () => { setOffline(false); toastRef.current.success('Connection restored.') }
    window.addEventListener('network:offline', goOffline)
    window.addEventListener('network:online',  goOnline)
    return () => {
      window.removeEventListener('network:offline', goOffline)
      window.removeEventListener('network:online',  goOnline)
    }
  }, [])

  useEffect(() => {
    if (view === 'app') {
      getMe().then((res) => { setProfile(res.data); sessionAuthenticated.current = true }).catch(() => {})
      getJobStats().then(res => setActivePipelineCount(res.data.total_active)).catch(() => {})
      getReferralStats().then(res => setReferralConversionCount(res.data.total_converted)).catch(() => {})
      if (window.location.pathname === '/referrals') setPage('referrals')
    }
  }, [view])

  const goToAuth = (mode: 'register' | 'login') => { setAuthMode(mode as any); setView('auth') }
  const onAuth = () => { sessionAuthenticated.current = true; setView('app'); setPage('home') }
  const goToVerifyOtp = (email: string, purpose: string) => { setOtpEmail(email); setOtpPurpose(purpose); setView('verify-otp') }
  const handleOtpSuccess = () => {
    if (otpPurpose === 'password_change') {
      setView('app')
    } else {
      setAuthMode('login')
      setView('auth')
    }
  }
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

  const openDetail = (sessionId: number) => { setDetailSessionId(sessionId); setPage('detail') }

  if (view === 'verify-otp') return <VerifyOtp email={otpEmail} purpose={otpPurpose} onSuccess={handleOtpSuccess} onBack={() => setView('auth')} />
  if (view === 'landing') return <Landing onGetStarted={() => goToAuth('register')} onLogin={() => goToAuth('login')} dark={dark} onToggleDark={() => setDark(d => !d)} />
  if (view === 'auth') return <Auth defaultMode={authMode} onAuth={onAuth} onNeedVerifyOtp={goToVerifyOtp} onBack={() => setView('landing')} />

  const activeNav = (id: Page) =>
    page === id || (page === 'detail' && id === 'history') || (page === 'results' && id === 'upload')

  const goToPage = (id: Page) => { setPage(id); setMobileOpen(false); setToolsOpen(false); setManageOpen(false) }

  const toolsItems: { id: Page; icon: React.ElementType; label: string; desc: string }[] = [
    { id: 'roadmap',   icon: Map,      label: 'Career Roadmap',  desc: 'Personalized skill growth path' },
    { id: 'bank',      icon: BookOpen, label: 'Interview Bank',  desc: 'Curated practice questions' },
    { id: 'interview', icon: Mic,      label: 'Mock Interview',  desc: 'AI-powered interview simulator' },
    { id: 'history',   icon: Clock,    label: 'Session History', desc: 'Review past CV analyses' },
  ]

  const manageItems: { id: Page; icon: React.ElementType; label: string; desc: string; badge?: number | null }[] = [
    { id: 'jobs',      icon: Briefcase, label: 'Jobs Pipeline', desc: 'Track applications & statuses', badge: activePipelineCount },
    { id: 'recruiter', icon: Users,     label: 'Recruiter',     desc: 'Source & evaluate candidates' },
    { id: 'referrals', icon: Share2,    label: 'Referrals',     desc: 'Earn rewards for introductions', badge: referralConversionCount > 0 ? referralConversionCount : null },
  ]

  const dropdownNavClass = (active: boolean) =>
    `flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
      active ? 'bg-primary-50 dark:bg-primary-950/40' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
    }`

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* Nav */}
      <nav className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 h-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => goToPage('home')}>
          <Layers size={18} strokeWidth={1.5} className="text-primary-500" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm tracking-tight">HireIQ</span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {/* Home */}
          <button
            onClick={() => setPage('home')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
              activeNav('home')
                ? 'text-zinc-900 dark:text-zinc-50 font-medium bg-zinc-100 dark:bg-zinc-800'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
          >
            Home
          </button>

          {/* Analyze CV — primary action */}
          <button
            onClick={() => result ? setPage('results') : setPage('upload')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors cursor-pointer ${
              activeNav('upload')
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40'
            }`}
          >
            <Zap size={13} strokeWidth={2} />
            Analyze CV
          </button>

          {/* Career Tools dropdown */}
          <div className="relative" ref={toolsRef}>
            <button
              onClick={() => { setToolsOpen(v => !v); setManageOpen(false) }}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                toolsItems.some(t => activeNav(t.id))
                  ? 'text-zinc-900 dark:text-zinc-50 font-medium bg-zinc-100 dark:bg-zinc-800'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              Career Tools
              <ChevronDown size={13} strokeWidth={2} className={`transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {toolsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
                  className="absolute top-full left-0 mt-1.5 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg shadow-black/10 p-2 z-50"
                >
                  {toolsItems.map(({ id, icon: Icon, label, desc }) => (
                    <button key={id} onClick={() => goToPage(id)} className={dropdownNavClass(activeNav(id))}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activeNav(id) ? 'bg-primary-100 dark:bg-primary-900/50' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                        <Icon size={15} strokeWidth={1.75} className={activeNav(id) ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-500 dark:text-zinc-400'} />
                      </div>
                      <div>
                        <div className={`text-sm font-medium ${activeNav(id) ? 'text-primary-700 dark:text-primary-300' : 'text-zinc-800 dark:text-zinc-200'}`}>{label}</div>
                        <div className="text-xs text-zinc-400 dark:text-zinc-500">{desc}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Manage dropdown */}
          <div className="relative" ref={manageRef}>
            <button
              onClick={() => { setManageOpen(v => !v); setToolsOpen(false) }}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                manageItems.some(t => activeNav(t.id))
                  ? 'text-zinc-900 dark:text-zinc-50 font-medium bg-zinc-100 dark:bg-zinc-800'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              Manage
              <ChevronDown size={13} strokeWidth={2} className={`transition-transform ${manageOpen ? 'rotate-180' : ''}`} />
              {/* Badge indicator if any manage item has a badge */}
              {manageItems.some(m => m.badge != null && m.badge > 0) && (
                <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" />
              )}
            </button>
            <AnimatePresence>
              {manageOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
                  className="absolute top-full left-0 mt-1.5 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg shadow-black/10 p-2 z-50"
                >
                  {manageItems.map(({ id, icon: Icon, label, desc, badge }) => (
                    <button key={id} onClick={() => goToPage(id)} className={dropdownNavClass(activeNav(id))}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activeNav(id) ? 'bg-primary-100 dark:bg-primary-900/50' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                        <Icon size={15} strokeWidth={1.75} className={activeNav(id) ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-500 dark:text-zinc-400'} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${activeNav(id) ? 'text-primary-700 dark:text-primary-300' : 'text-zinc-800 dark:text-zinc-200'}`}>{label}</span>
                          {badge != null && badge > 0 && (
                            <span className="bg-primary-600 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">{badge > 99 ? '99+' : badge}</span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 dark:text-zinc-500">{desc}</div>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle dark={dark} onToggle={() => setDark(d => !d)} />
          <div className="hidden md:block">
            <NavAvatar profile={profile} onClick={() => setPage('profile')} />
          </div>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            className="flex md:hidden w-8 h-8 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {mobileOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
        </div>
      </nav>

      {/* Offline banner */}
      <AnimatePresence>
        {offline && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-800 dark:text-amber-200 font-medium"
          >
            <svg className="w-3 h-3 animate-spin text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none">
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 md:hidden"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
              className="fixed top-0 right-0 bottom-0 w-72 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 z-60 flex flex-col md:hidden overflow-y-auto"
            >
              <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Menu</span>
                <button onClick={() => setMobileOpen(false)} aria-label="Close" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer">
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
              <nav className="flex flex-col p-3 gap-0.5 flex-1">
                {/* Home */}
                <button
                  onClick={() => goToPage('home')}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                    activeNav('home') ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  Home
                </button>
                {/* Analyze CV */}
                <button
                  onClick={() => { setMobileOpen(false); result ? setPage('results') : setPage('upload') }}
                  className={`flex items-center gap-2 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeNav('upload') ? 'bg-primary-600 text-white' : 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40'
                  }`}
                >
                  <Zap size={14} strokeWidth={2} /> Analyze CV
                </button>

                {/* Career Tools section */}
                <div className="pt-3 pb-1 px-3">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Career Tools</span>
                </div>
                {toolsItems.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => goToPage(id)}
                    className={`flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                      activeNav(id) ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.75} className="shrink-0 text-zinc-400 dark:text-zinc-500" />
                    {label}
                  </button>
                ))}

                {/* Manage section */}
                <div className="pt-3 pb-1 px-3">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Manage</span>
                </div>
                {manageItems.map(({ id, icon: Icon, label, badge }) => (
                  <button
                    key={id}
                    onClick={() => goToPage(id)}
                    className={`flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                      activeNav(id) ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.75} className="shrink-0 text-zinc-400 dark:text-zinc-500" />
                    <span className="flex-1">{label}</span>
                    {badge != null && badge > 0 && (
                      <span className="bg-primary-600 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">{badge > 99 ? '99+' : badge}</span>
                    )}
                  </button>
                ))}

                {/* Profile */}
                <div className="pt-3 pb-1 px-3">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Account</span>
                </div>
                <button
                  onClick={() => goToPage('profile')}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                    page === 'profile' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-medium' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  Profile
                </button>
              </nav>
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
                <button
                  onClick={() => { setMobileOpen(false); logout() }}
                  className="w-full px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
                >
                  Log out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {page === 'home' && (
          <motion.div key="home" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <Dashboard onAnalyze={() => setPage('upload')} onHistory={() => setPage('history')} onInterview={() => setPage('interview')} onSession={openDetail} onRoadmap={() => setPage('roadmap')} />
            </Suspense>
          </motion.div>
        )}
        {page === 'upload' && (
          <motion.div key="upload" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <Upload onDone={(r) => { setResult(r); setPage('results') }} onViewLastSession={result ? () => setPage('results') : undefined} />
            </Suspense>
          </motion.div>
        )}
        {page === 'results' && result && (
          <motion.div key="results" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <Results
                result={result}
                onBack={() => { setResult(null); setPage('upload') }}
                onDiscard={() => { setResult(null); setPage('upload') }}
                onPractice={(qs) => goToPractice(qs, result.session_id)}
                onRoadmap={(sid) => { setRoadmapSessionId(sid); setPage('roadmap') }}
              />
            </Suspense>
          </motion.div>
        )}
        {page === 'results' && !result && (
          <motion.div key="no-results" variants={pageVariants} initial="initial" animate="animate" exit="exit"
            className="text-center py-20 text-zinc-400 text-sm">
            Upload a CV first.
          </motion.div>
        )}
        {page === 'history' && (
          <motion.div key="history" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <History onSelect={openDetail} />
            </Suspense>
          </motion.div>
        )}
        {page === 'detail' && detailSessionId != null && (
          <motion.div key={`detail-${detailSessionId}`} variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <SessionDetail sessionId={detailSessionId} onBack={() => setPage('history')} onPractice={(qs) => goToPractice(qs, detailSessionId)} />
            </Suspense>
          </motion.div>
        )}
        {page === 'interview' && (
          <motion.div key="interview" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <Interview sessionId={interviewSessionId} questions={interviewQuestions} />
            </Suspense>
          </motion.div>
        )}
        {page === 'jobs' && (
          <motion.div key="jobs" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <Jobs />
            </Suspense>
          </motion.div>
        )}
        {page === 'recruiter' && (
          <motion.div key="recruiter" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <Recruiter />
            </Suspense>
          </motion.div>
        )}
        {page === 'referrals' && (
          <motion.div key="referrals" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <Referrals />
            </Suspense>
          </motion.div>
        )}
        {page === 'roadmap' && (
          <motion.div key="roadmap" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <CareerRoadmap initialSessionId={roadmapSessionId} onNavigateToUpload={() => setPage('upload')} />
            </Suspense>
          </motion.div>
        )}
        {page === 'profile' && (
          <motion.div key="profile" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <Profile onBack={() => setPage('home')} onLogout={logout} onReferrals={() => setPage('referrals')} />
            </Suspense>
          </motion.div>
        )}
        {page === 'bank' && (
          <motion.div key="bank" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <Suspense fallback={<PageLoader />}>
              <Bank />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
