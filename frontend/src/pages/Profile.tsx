import { useEffect, useState } from 'react'
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
        className="grid grid-cols-3 gap-3"
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
