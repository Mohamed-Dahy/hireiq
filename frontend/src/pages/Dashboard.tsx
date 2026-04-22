import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { getMe, getSessions } from '../api'
import type { UserProfile, CVSession } from '../api'

interface Props {
  onAnalyze:  () => void
  onHistory:  () => void
  onInterview: () => void
  onSession:  (id: number) => void
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.2, 1] as const } },
}

function StatCard({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col gap-3"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </motion.div>
  )
}

function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-gray-300">—</span>
  const color = score >= 70 ? 'text-green-600 bg-green-50' : score >= 40 ? 'text-yellow-600 bg-yellow-50' : 'text-red-500 bg-red-50'
  return <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${color}`}>{score}%</span>
}

function QuickAction({
  icon, label, desc, onClick, primary,
}: { icon: React.ReactNode; label: string; desc: string; onClick: () => void; primary?: boolean }) {
  const reduced = useReducedMotion()
  return (
    <motion.button
      onClick={onClick}
      whileHover={reduced ? {} : { y: -3, boxShadow: '0 10px 30px rgba(124,58,237,0.12)' }}
      whileTap={reduced ? {} : { scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className={`w-full text-left rounded-2xl p-5 border transition-colors cursor-pointer ${
        primary
          ? 'bg-purple-600 border-purple-600 hover:bg-purple-700'
          : 'bg-white border-gray-100 hover:border-purple-200'
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${primary ? 'bg-purple-500' : 'bg-purple-50'}`}>
        {icon}
      </div>
      <p className={`text-sm font-semibold ${primary ? 'text-white' : 'text-gray-800'}`}>{label}</p>
      <p className={`text-xs mt-0.5 ${primary ? 'text-purple-200' : 'text-gray-400'}`}>{desc}</p>
    </motion.button>
  )
}

function getGreeting(username: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${username}`
}

export default function Dashboard({ onAnalyze, onHistory, onInterview, onSession }: Props) {
  const reduced = useReducedMotion()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<CVSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMe(), getSessions()])
      .then(([meRes, sessRes]) => {
        setProfile(meRes.data)
        setSessions(sessRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const recent = sessions.slice(0, 4)

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-2xl mx-auto py-12 px-4 space-y-8"
    >
      {/* Header */}
      <div>
        <p className="text-xs text-gray-400 mb-1">{today}</p>
        <h1 className="text-2xl font-extrabold text-gray-900">
          {profile ? getGreeting(profile.username) : 'Welcome back'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's what's happening with your applications.</p>
      </div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      >
        <StatCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" className="w-4.5 h-4.5 w-5 h-5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="CVs Analyzed"
          value={String(profile?.total_sessions ?? 0)}
          color="bg-purple-50"
        />
        <StatCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" className="w-5 h-5">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="Avg Match Score"
          value={profile?.avg_match_score != null ? `${profile.avg_match_score}%` : '—'}
          color="bg-green-50"
        />
        <StatCard
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.8" className="w-5 h-5">
              <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="Interviews Done"
          value={String(profile?.total_interviews ?? 0)}
          color="bg-amber-50"
        />
      </motion.div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction
            primary
            onClick={onAnalyze}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label="Analyze CV"
            desc="Upload a new CV"
          />
          <QuickAction
            onClick={onInterview}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" className="w-5 h-5">
                <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label="Practice"
            desc="Mock interview"
          />
          <QuickAction
            onClick={onHistory}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" className="w-5 h-5">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            label="History"
            desc="All sessions"
          />
        </div>
      </div>

      {/* Recent sessions */}
      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Recent Sessions</h2>
            <button
              onClick={onHistory}
              className="text-xs text-purple-500 hover:underline cursor-pointer"
            >
              View all →
            </button>
          </div>

          <motion.div
            className="space-y-2"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          >
            {recent.map((s) => (
              <motion.button
                key={s.id}
                variants={fadeUp}
                onClick={() => onSession(s.id)}
                whileHover={reduced ? {} : { y: -2, boxShadow: '0 6px 20px rgba(124,58,237,0.08)' }}
                whileTap={reduced ? {} : { scale: 0.99 }}
                transition={{ duration: 0.18 }}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3.5 flex items-center justify-between hover:border-purple-200 transition-colors cursor-pointer text-left shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" className="w-4 h-4">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate max-w-[240px]">{s.cv_filename}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ScoreChip score={s.match_score} />
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-gray-300">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </div>
      )}

      {/* Empty state — first-time user */}
      {sessions.length === 0 && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-2xl p-8 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" className="w-7 h-7">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">Upload your first CV</h3>
          <p className="text-sm text-gray-400 mb-5">Get an instant match score and personalized interview questions.</p>
          <motion.button
            onClick={onAnalyze}
            whileHover={reduced ? {} : { scale: 1.03 }}
            whileTap={reduced ? {} : { scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="bg-purple-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-purple-700 transition-colors cursor-pointer"
          >
            Get Started →
          </motion.button>
        </motion.div>
      )}

      {/* Best score card — show only if there's data */}
      {profile?.best_score != null && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-6 flex items-center justify-between shadow-lg shadow-purple-200"
        >
          <div>
            <p className="text-purple-200 text-xs font-medium mb-1">Your best performance</p>
            <p className="text-white text-3xl font-extrabold">{profile.best_score}%</p>
            <p className="text-purple-300 text-xs mt-0.5">match score</p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-purple-500 bg-opacity-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-8 h-8">
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
