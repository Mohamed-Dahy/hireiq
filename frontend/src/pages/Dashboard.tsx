import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, TrendingUp, Calendar, Upload, ChevronRight, Sparkles, Mic, Map } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { getMe, getSessions } from '../api'
import type { UserProfile, CVSession } from '../api'

interface Props {
  onAnalyze:   () => void
  onHistory:   () => void
  onInterview: () => void
  onRoadmap:   () => void
  onSession:   (id: number) => void
}

const fade = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-zinc-400 font-medium">—</span>
  const cls = score >= 70
    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
    : score >= 40
    ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
    : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${cls}`}>
      {score}%
    </span>
  )
}

function getGreeting(username: string) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${username}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

interface ChartPayload {
  score: number
  filename: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartPayload }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const { score, filename } = payload[0].payload
  const name = filename.length > 34 ? filename.slice(0, 34) + '…' : filename
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-lg min-w-40">
      <p className="text-zinc-400 font-medium mb-1">{label}</p>
      <p className="text-zinc-300 mb-1 truncate">{name}</p>
      <p className="text-primary-400 font-semibold">{Math.round(score)}% match</p>
    </div>
  )
}

export default function Dashboard({ onAnalyze, onHistory, onInterview, onRoadmap, onSession }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<CVSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMe(), getSessions()])
      .then(([meRes, sessRes]) => { setProfile(meRes.data); setSessions(sessRes.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Use sessions from getSessions() — always reliable, same data shape as RecentSession
  const recent = [...sessions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const chartData = [...sessions]
    .filter((s) => s.match_score != null)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-10)
    .map((s, i) => ({
      idx: i + 1,
      score: s.match_score,
      date: new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      filename: s.cv_filename,
    }))

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-zinc-100 dark:bg-zinc-800/60 rounded-xl h-16 animate-pulse" />
        ))}
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const avgScore = profile?.avg_match_score ?? null
  const stats = [
    {
      icon: FileText,
      label: 'CVs Analyzed',
      value: String(profile?.total_sessions ?? 0),
      sub: (profile?.total_sessions ?? 0) > 0 ? 'all time' : 'none yet',
      subColor: 'text-primary-500',
    },
    {
      icon: TrendingUp,
      label: 'Avg Match Score',
      value: avgScore != null ? `${avgScore}%` : '—',
      sub: avgScore != null ? (avgScore >= 70 ? 'Strong' : avgScore >= 40 ? 'Improving' : 'Needs work') : 'no data',
      subColor: avgScore != null
        ? avgScore >= 70 ? 'text-emerald-500' : avgScore >= 40 ? 'text-amber-500' : 'text-red-500'
        : 'text-zinc-400',
    },
    {
      icon: Calendar,
      label: 'This Month',
      value: String(profile?.sessions_this_month ?? 0),
      sub: (profile?.sessions_this_month ?? 0) > 0 ? 'sessions' : 'none yet',
      subColor: 'text-primary-500',
    },
    {
      icon: Map,
      label: 'Roadmaps',
      value: String(profile?.roadmaps_generated ?? 0),
      sub: (profile?.roadmaps_generated ?? 0) > 0 ? 'generated' : 'none yet',
      subColor: 'text-primary-500',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-zinc-400 mb-1">{today}</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {profile ? getGreeting(profile.username) : 'Welcome back'}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Here's your career intelligence overview.</p>
        </div>
        {profile?.best_score != null && (
          <div className="hidden sm:flex items-center gap-3 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 bg-white dark:bg-zinc-900">
            <div>
              <p className="text-xs text-zinc-400 font-medium">Best score</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 leading-none tabular-nums">{profile.best_score}%</p>
            </div>
            <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Sparkles size={14} strokeWidth={1.5} className="text-primary-500" />
            </div>
          </div>
        )}
      </div>

      {/* Stats — 4 cards */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      >
        {stats.map((s) => (
          <motion.div
            key={s.label}
            variants={fade}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <s.icon size={15} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 leading-none tabular-nums">{s.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{s.label}</p>
              <p className={`text-xs mt-0.5 ${s.subColor}`}>{s.sub}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick actions */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Quick Actions</h2>
          <button
            onClick={onAnalyze}
            className="w-full text-left bg-primary-600 hover:bg-primary-500 transition-colors rounded-xl p-4 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-md bg-primary-500 flex items-center justify-center mb-3">
              <Upload size={13} strokeWidth={2} className="text-white" />
            </div>
            <p className="text-sm font-medium text-white">Analyze New CV</p>
            <p className="text-xs text-primary-200 mt-0.5">Upload a PDF and get instant feedback</p>
          </button>
          <button
            onClick={onInterview}
            className="w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors rounded-xl p-4 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
              <Mic size={13} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Practice Interview</p>
            <p className="text-xs text-zinc-500 mt-0.5">Voice-based mock interview</p>
          </button>
          <button
            onClick={onRoadmap}
            className="w-full text-left bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors rounded-xl p-4 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
              <Map size={13} strokeWidth={1.5} className="text-zinc-500 dark:text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Career Roadmap</p>
            <p className="text-xs text-zinc-500 mt-0.5">Personalized learning path</p>
          </button>
        </div>

        {/* Recent sessions — driven by getSessions(), not profile.recent_sessions */}
        <div className="lg:col-span-2 space-y-3">
          {sessions.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Recent Sessions</h2>
                <button onClick={onHistory} className="text-xs text-primary-500 hover:text-primary-400 cursor-pointer transition-colors">
                  View all →
                </button>
              </div>
              <motion.div
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
                initial="hidden" animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              >
                {recent.map((s, i) => (
                  <motion.button
                    key={s.id}
                    variants={fade}
                    onClick={() => onSession(s.id)}
                    className={`w-full flex items-center justify-between px-5 py-3.5 cursor-pointer text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                      i < recent.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <FileText size={13} strokeWidth={1.5} className="text-zinc-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{s.cv_filename}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-zinc-400">{timeAgo(s.created_at)}</p>
                          {s.has_gap_report && (
                            <span className="text-[10px] font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 px-1.5 py-px rounded leading-none">
                              Gap analysis
                            </span>
                          )}
                        </div>
                        {s.jd_snippet && (
                          <p className="text-xs text-zinc-400 truncate mt-0.5 max-w-xs">{s.jd_snippet}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <ScoreBadge score={s.match_score} />
                      <ChevronRight size={14} strokeWidth={1.5} className="text-zinc-300 dark:text-zinc-600" />
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </>
          ) : (
            <motion.div
              variants={fade} initial="hidden" animate="show"
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-10 text-center flex flex-col items-center justify-center h-full"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Upload size={20} strokeWidth={1.5} className="text-zinc-400" />
              </div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">No sessions yet</h3>
              <p className="text-xs text-zinc-500 mb-5 max-w-xs">Upload your first CV to get a match score and personalized interview questions.</p>
              <button
                onClick={onAnalyze}
                className="bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium px-5 py-2 rounded-md transition-colors cursor-pointer"
              >
                Get Started →
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Score trend chart */}
      {chartData.length >= 2 && (
        <motion.div
          variants={fade} initial="hidden" animate="show"
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Score Trend</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Last {chartData.length} scored sessions</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-md">
              <span className="w-2 h-2 rounded-full bg-primary-500" />
              Match score
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2}
                  fill="url(#scoreFill)"
                  dot={{ r: 3, fill: '#3b82f6', stroke: '#18181b', strokeWidth: 2 }}
                  activeDot={{ r: 4.5, fill: '#3b82f6', stroke: '#18181b', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
