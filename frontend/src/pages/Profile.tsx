import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { getMe } from '../api'
import type { UserProfile } from '../api'

interface Props {
  onBack: () => void
  onLogout: () => void
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.2, 1] as const } },
}

interface Achievement {
  id: string
  label: string
  desc: string
  icon: React.ReactNode
  earned: boolean
}

function buildAchievements(p: UserProfile): Achievement[] {
  return [
    {
      id: 'first',
      label: 'First Step',
      desc: 'Uploaded your first CV',
      earned: p.total_sessions >= 1,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id: 'five',
      label: 'On a Roll',
      desc: 'Analyzed 5 CVs',
      earned: p.total_sessions >= 5,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id: 'ten',
      label: 'Power User',
      desc: 'Analyzed 10 CVs',
      earned: p.total_sessions >= 10,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id: 'good',
      label: 'Solid Match',
      desc: 'Hit 70%+ on a CV',
      earned: (p.best_score ?? 0) >= 70,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.539 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.075 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.521-4.673z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id: 'great',
      label: 'Top Tier',
      desc: 'Hit 90%+ on a CV',
      earned: (p.best_score ?? 0) >= 90,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      id: 'practice',
      label: 'Public Speaker',
      desc: 'Recorded 5 interview answers',
      earned: p.total_interviews >= 5,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
          <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ]
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-1 shadow-sm"
    >
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-extrabold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </motion.div>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300 text-2xl font-bold">—</span>
  const color = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-500' : 'text-red-500'
  const bg    = score >= 70 ? 'bg-green-50'   : score >= 40 ? 'bg-yellow-50'    : 'bg-red-50'
  return (
    <span className={`text-2xl font-extrabold px-4 py-1 rounded-full ${color} ${bg}`}>
      {score}%
    </span>
  )
}

export default function Profile({ onBack, onLogout }: Props) {
  const reduced = useReducedMotion()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getMe()
      .then((res) => setProfile(res.data))
      .catch(() => setError('Could not load profile'))
      .finally(() => setLoading(false))
  }, [])

  const initials = profile?.username
    ? profile.username.slice(0, 2).toUpperCase()
    : '??'

  const achievements = useMemo(
    () => (profile ? buildAchievements(profile) : []),
    [profile],
  )
  const earnedCount = achievements.filter((a) => a.earned).length

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center text-gray-400 text-sm animate-pulse">
        Loading profile…
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center text-red-400 text-sm">
        {error || 'Profile not found.'}
      </div>
    )
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-xl mx-auto py-12 px-4 space-y-8"
    >
      {/* Back */}
      <motion.button
        onClick={onBack}
        whileHover={reduced ? {} : { x: -3 }}
        transition={{ duration: 0.15 }}
        className="text-sm text-purple-600 hover:underline cursor-pointer"
      >
        ← Back
      </motion.button>

      {/* Avatar card */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="bg-white border border-purple-100 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-sm"
      >
        {/* Avatar */}
        <motion.div
          initial={reduced ? {} : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-200"
        >
          <span className="text-2xl font-extrabold text-white">{initials}</span>
        </motion.div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">@{profile.username}</h2>
          <p className="text-sm text-gray-400 mt-0.5">{profile.email}</p>
          <p className="text-xs text-gray-300 mt-1">Member since {memberSince}</p>
        </div>

        {/* Best score highlight */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <p className="text-xs text-gray-400">Best CV match score</p>
          <ScoreBadge score={profile.best_score} />
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        <StatCard
          label="CVs Analyzed"
          value={String(profile.total_sessions)}
          sub={profile.total_sessions === 1 ? 'session' : 'sessions'}
        />
        <StatCard
          label="Avg Score"
          value={profile.avg_match_score != null ? `${profile.avg_match_score}%` : '—'}
          sub="match score"
        />
        <StatCard
          label="Interviews"
          value={String(profile.total_interviews)}
          sub={profile.total_interviews === 1 ? 'answer' : 'answers'}
        />
      </motion.div>

      {/* Account info */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
      >
        <div className="px-5 py-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Account</p>
        </div>
        {[
          { label: 'Username', value: `@${profile.username}` },
          { label: 'Email',    value: profile.email },
          { label: 'Member since', value: memberSince },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-800">{value}</span>
          </div>
        ))}
      </motion.div>

      {/* Achievements */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Achievements</h3>
          <span className="text-xs text-gray-400">
            {earnedCount} / {achievements.length} unlocked
          </span>
        </div>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        >
          {achievements.map((a) => (
            <motion.div
              key={a.id}
              variants={fadeUp}
              whileHover={reduced || !a.earned ? {} : { y: -3, boxShadow: '0 8px 24px rgba(124,58,237,0.12)' }}
              transition={{ duration: 0.18 }}
              className={`rounded-2xl p-4 border text-center transition-all ${
                a.earned
                  ? 'bg-gradient-to-br from-purple-50 to-white border-purple-200'
                  : 'bg-gray-50 border-gray-100 opacity-60'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${
                a.earned ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {a.icon}
              </div>
              <p className={`text-xs font-semibold ${a.earned ? 'text-gray-800' : 'text-gray-400'}`}>{a.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{a.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Logout */}
      <motion.button
        onClick={onLogout}
        whileHover={reduced ? {} : { scale: 1.02 }}
        whileTap={reduced ? {} : { scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="w-full py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors cursor-pointer"
      >
        Log out
      </motion.button>
    </motion.div>
  )
}
