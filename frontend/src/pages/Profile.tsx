import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, Zap, LayoutGrid, Star, Sparkles, Mic, Gift, ArrowRight, Users } from 'lucide-react'
import { getMe, getReferralStats } from '../api'
import type { UserProfile, ReferralStats } from '../api'

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
      icon: <Check size={16} strokeWidth={2} />,
    },
    {
      id: 'five',
      label: 'On a Roll',
      desc: 'Analyzed 5 CVs',
      earned: p.total_sessions >= 5,
      icon: <Zap size={16} strokeWidth={1.5} />,
    },
    {
      id: 'ten',
      label: 'Power User',
      desc: 'Analyzed 10 CVs',
      earned: p.total_sessions >= 10,
      icon: <LayoutGrid size={16} strokeWidth={1.5} />,
    },
    {
      id: 'good',
      label: 'Solid Match',
      desc: 'Hit 70%+ on a CV',
      earned: (p.best_score ?? 0) >= 70,
      icon: <Star size={16} strokeWidth={1.5} />,
    },
    {
      id: 'great',
      label: 'Top Tier',
      desc: 'Hit 90%+ on a CV',
      earned: (p.best_score ?? 0) >= 90,
      icon: <Sparkles size={16} strokeWidth={1.5} />,
    },
    {
      id: 'practice',
      label: 'Public Speaker',
      desc: 'Recorded 5 interview answers',
      earned: p.total_interviews >= 5,
      icon: <Mic size={16} strokeWidth={1.5} />,
    },
  ]
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col gap-1"
    >
      <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </motion.div>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-zinc-400 text-2xl font-semibold">—</span>
  const cls = score >= 70
    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800'
    : score >= 40
    ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800'
    : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800'
  return (
    <span className={`text-2xl font-semibold px-4 py-1 rounded-lg ${cls}`}>
      {score}%
    </span>
  )
}

export default function Profile({ onBack, onLogout }: Props) {
  const reduced = useReducedMotion()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      getMe(),
      getReferralStats().catch(() => null),
    ])
      .then(([profileRes, statsRes]) => {
        setProfile(profileRes.data)
        if (statsRes) setReferralStats(statsRes.data)
      })
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
      <div className="max-w-xl mx-auto py-20 px-4 text-center text-zinc-400 text-sm animate-pulse">
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
      className="max-w-xl mx-auto py-8 px-4 sm:px-6 space-y-6"
    >
      {/* Back */}
      <button
        onClick={onBack}
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors cursor-pointer"
      >
        ← Back
      </button>

      {/* Avatar card */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 flex flex-col items-center gap-4"
      >
        <motion.div
          initial={reduced ? {} : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          className="w-20 h-20 rounded-full bg-violet-600 flex items-center justify-center"
        >
          <span className="text-2xl font-semibold text-white">{initials}</span>
        </motion.div>

        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">@{profile.username}</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{profile.email}</p>
          <p className="text-xs text-zinc-400 mt-1">Member since {memberSince}</p>
        </div>

        <div className="flex flex-col items-center gap-1 pt-1">
          <p className="text-xs text-zinc-400">Best CV match score</p>
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

      {/* Referral mini-card */}
      {referralStats && (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <a
            href="/referrals"
            onClick={(e) => { e.preventDefault(); window.location.pathname = '/referrals' }}
            className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-violet-200 dark:hover:border-violet-800 transition-colors group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gift size={16} strokeWidth={1.5} className="text-violet-500" />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Referrals</span>
              </div>
              <ArrowRight size={14} strokeWidth={1.5} className="text-zinc-400 group-hover:text-violet-500 transition-colors" />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Users size={14} strokeWidth={1.5} />
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{referralStats.total_converted}</span>
                <span>converted</span>
              </div>
              <div className="text-zinc-400">·</div>
              <div className="text-zinc-500">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{referralStats.days_earned}</span>
                <span> days free earned</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-violet-500 font-medium">View Full Referral Hub →</div>
          </a>
        </motion.div>
      )}

      {/* Account info */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Account</p>
        </div>
        {[
          { label: 'Username', value: `@${profile.username}` },
          { label: 'Email',    value: profile.email },
          { label: 'Member since', value: memberSince },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
            <span className="text-sm text-zinc-500">{label}</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
          </div>
        ))}
      </motion.div>

      {/* Achievements */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Achievements</h3>
          <span className="text-xs text-zinc-400">
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
              className={`rounded-xl p-4 border text-center transition-all ${
                a.earned
                  ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
                  : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 opacity-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 ${
                a.earned ? 'bg-violet-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'
              }`}>
                {a.icon}
              </div>
              <p className={`text-xs font-medium ${a.earned ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>{a.label}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">{a.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full py-3 rounded-xl border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
      >
        Log out
      </button>
    </motion.div>
  )
}
