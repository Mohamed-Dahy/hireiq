import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Loader2, Map, MapPin, Layers, Clock, Upload, AlertCircle, CheckCircle2,
  FileText, User, ArrowDown, Target, Zap, Building2, TrendingUp,
  DollarSign, Globe, Link2, Code2,
} from 'lucide-react'
import { getMySessions, generateRoadmap, listRoadmaps, getRoadmap } from '../api'
import type {
  RoadmapPhase, RoadmapResource, RoadmapResponse, RoadmapListItem, CVSession,
  CareerInsight, QuickWin,
} from '../api'
import { getSessionLabel } from '../utils/sessionLabel'

interface Props {
  initialSessionId?: number | null
  onNavigateToUpload?: () => void
}

type Mode = 'cv' | 'role'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractRoleFromJdSnippet(snippet: string | null): string {
  if (!snippet) return ''
  const first = snippet.trim().split('\n')[0].trim()
  return first.length > 60 ? first.slice(0, 60) : first
}

const PHASE_COLORS = [
  'bg-primary-500',
  'bg-accent-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
]

const RESOURCE_TYPE_STYLE: Record<string, { label: string; cls: string }> = {
  course:  { label: 'Course',  cls: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' },
  book:    { label: 'Book',    cls: 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' },
  video:   { label: 'Video',   cls: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300' },
  project: { label: 'Project', cls: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' },
  tool:    { label: 'Tool',    cls: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' },
}

const DEMAND_STYLE: Record<string, { label: string; cls: string }> = {
  high:   { label: 'High Demand',   cls: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' },
  medium: { label: 'Medium Demand', cls: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300' },
  low:    { label: 'Low Demand',    cls: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300' },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResourceRow({ resource }: { resource: RoadmapResource }) {
  const typeStyle = RESOURCE_TYPE_STYLE[resource.type] ?? RESOURCE_TYPE_STYLE.course
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group min-w-0"
      >
        <Link2 size={11} strokeWidth={1.5} className="text-zinc-400 group-hover:text-primary-400 shrink-0" />
        <span className="truncate">{resource.name}</span>
      </a>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeStyle.cls}`}>
          {typeStyle.label}
        </span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
          resource.is_free
            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
        }`}>
          {resource.is_free ? 'Free' : 'Paid'}
        </span>
        {resource.estimated_hours > 0 && (
          <span className="text-[10px] text-zinc-400">{resource.estimated_hours}h</span>
        )}
      </div>
    </div>
  )
}

function PhaseCard({ phase, index, reduced }: { phase: RoadmapPhase; index: number; reduced: boolean | null }) {
  const color = PHASE_COLORS[index % PHASE_COLORS.length]
  const totalHours = phase.resources?.reduce((s, r) => s + (r.estimated_hours ?? 0), 0) ?? 0

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0, 0, 0.2, 1] }}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
    >
      {/* Phase header */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 ${color}`}>
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mb-1.5">
              {phase.name}
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <Clock size={10} strokeWidth={1.5} />
                ~{phase.estimated_weeks} {phase.estimated_weeks === 1 ? 'week' : 'weeks'}
              </span>
              {totalHours > 0 && (
                <span className="flex items-center gap-1 text-xs text-zinc-400">
                  <Zap size={10} strokeWidth={1.5} />
                  ~{totalHours}h of content
                </span>
              )}
              {phase.resources?.length > 0 && (
                <span className="text-xs text-zinc-400">{phase.resources.length} resources</span>
              )}
            </div>
          </div>
        </div>

        {/* Skills */}
        {phase.skills_covered?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-12 mb-3">
            {phase.skills_covered.map((skill) => (
              <span
                key={skill}
                className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Project to build */}
        {phase.project_to_build && (
          <div className="pl-12 mb-3">
            <div className="bg-primary-50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/40 rounded-xl px-3.5 py-2.5">
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-1 flex items-center gap-1.5">
                <Code2 size={11} strokeWidth={2} /> Build project
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {phase.project_to_build}
              </p>
            </div>
          </div>
        )}

        {/* Milestone */}
        {phase.milestone && (
          <div className="pl-12 flex items-start gap-1.5">
            <Target size={11} strokeWidth={1.5} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Milestone: </span>
              {phase.milestone}
            </p>
          </div>
        )}
      </div>

      {/* Resources */}
      {phase.resources?.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
            Resources
          </p>
          <div>
            {phase.resources.map((r, ri) => (
              <ResourceRow key={ri} resource={r} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function VisualRoadmap({ phases, reduced }: { phases: RoadmapPhase[]; reduced: boolean | null }) {
  return (
    <div className="space-y-3">
      {phases.map((phase, i) => (
        <div key={i}>
          <PhaseCard phase={phase} index={i} reduced={reduced} />
          {i < phases.length - 1 && (
            <div className="flex justify-center py-2">
              <motion.div
                initial={reduced ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.06 + 0.25 }}
                className="flex flex-col items-center gap-0.5"
              >
                <div className="w-px h-4 bg-primary-300 dark:bg-primary-700" />
                <ArrowDown size={12} strokeWidth={2} className="text-primary-400 dark:text-primary-600" />
              </motion.div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function QuickWinsSection({ quickWins }: { quickWins: QuickWin[] }) {
  if (!quickWins?.length) return null
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
          <Zap size={14} strokeWidth={1.75} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Quick Wins</h3>
          <p className="text-xs text-zinc-400">High-impact actions to start this week</p>
        </div>
      </div>
      <div className="space-y-4">
        {quickWins.map((qw, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{i + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">
                {qw.action}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{qw.why}</p>
              <span className="inline-flex items-center gap-1 text-xs text-zinc-400 mt-1.5">
                <Clock size={10} strokeWidth={1.5} /> {qw.time_required}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CareerInsightsPanel({ insight, targetRole }: { insight: CareerInsight; targetRole: string }) {
  if (!insight) return null
  const hasData = insight.salary_range_local && insight.salary_range_local !== 'Data unavailable'
  const hasCompanies = (insight.top_companies?.length ?? 0) > 0
  const hasSkills = (insight.hot_skills?.length ?? 0) > 0
  if (!hasData && !hasCompanies && !hasSkills) return null

  const demandKey = (insight.market_demand ?? 'medium').toLowerCase()
  const demand = DEMAND_STYLE[demandKey] ?? DEMAND_STYLE.medium

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-950/40 flex items-center justify-center">
            <TrendingUp size={14} strokeWidth={1.75} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Career Insights</h3>
            <p className="text-xs text-zinc-400">{targetRole} · 2025–2026 market</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${demand.cls}`}>
          {demand.label}
        </span>
      </div>

      {/* Salary */}
      {hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3.5">
            <p className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
              <DollarSign size={10} strokeWidth={1.5} /> Local salary
            </p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {insight.salary_range_local}
            </p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3.5">
            <p className="text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
              <Globe size={10} strokeWidth={1.5} /> Remote salary
            </p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {insight.salary_range_remote}
            </p>
          </div>
        </div>
      )}

      {/* Top Companies */}
      {hasCompanies && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            <Building2 size={11} strokeWidth={1.5} /> Top companies hiring
          </p>
          <div className="flex flex-wrap gap-2">
            {insight.top_companies.map((c) => (
              <span
                key={c}
                className="text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hot Skills */}
      {hasSkills && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            <Zap size={11} strokeWidth={1.5} /> Hot skills to know
          </p>
          <div className="flex flex-wrap gap-2">
            {insight.hot_skills.map((s) => (
              <span
                key={s}
                className="text-xs px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 font-medium border border-primary-100 dark:border-primary-900/40"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-zinc-400">No score</span>
  const cls = score >= 70
    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
    : score >= 40
    ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
    : 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {Math.round(score)}% match
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CareerRoadmap({ initialSessionId, onNavigateToUpload }: Props) {
  const reduced = useReducedMotion()
  const [mode, setMode] = useState<Mode>('cv')
  const [sessions, setSessions] = useState<CVSession[]>([])
  const [roadmaps, setRoadmaps] = useState<RoadmapListItem[]>([])
  const [selectedRoadmap, setSelectedRoadmap] = useState<RoadmapResponse | null>(null)
  const [targetRole, setTargetRole] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(initialSessionId ?? null)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      getMySessions().then(r => setSessions(r.data)).catch(() => {}),
      listRoadmaps().then(r => setRoadmaps(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  // Auto-fill target role from session's JD once sessions are loaded
  useEffect(() => {
    if (sessions.length === 0 || targetRole) return
    const s = sessions.find(s => s.id === selectedSessionId)
    if (s?.jd_snippet) setTargetRole(extractRoleFromJdSnippet(s.jd_snippet))
  }, [sessions])

  const handleSessionSelect = (id: number) => {
    setSelectedSessionId(id)
    const s = sessions.find(s => s.id === id)
    if (s?.jd_snippet) setTargetRole(extractRoleFromJdSnippet(s.jd_snippet))
  }

  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? null

  const canGenerate = mode === 'cv'
    ? selectedSessionId !== null && targetRole.trim().length > 0
    : targetRole.trim().length > 0

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setError('')
    try {
      const sessionId = mode === 'cv' ? selectedSessionId : null
      const desc = mode === 'role' ? roleDescription.trim() : undefined
      const res = await generateRoadmap(sessionId, targetRole.trim(), desc)
      setSelectedRoadmap(res.data)
      setTargetRole('')
      setRoleDescription('')
      const rms = await listRoadmaps()
      setRoadmaps(rms.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to generate roadmap')
    } finally {
      setGenerating(false)
    }
  }

  const loadRoadmap = async (id: number) => {
    try {
      const res = await getRoadmap(id)
      setSelectedRoadmap(res.data)
      setShowSaved(false)
    } catch {
      setError('Could not load roadmap')
    }
  }

  const totalHours = selectedRoadmap?.phases.reduce(
    (sum, p) => sum + (p.resources?.reduce((s, r) => s + (r.estimated_hours ?? 0), 0) ?? 0), 0
  ) ?? 0

  const totalResources = selectedRoadmap?.phases.reduce(
    (sum, p) => sum + (p.resources?.length ?? 0), 0
  ) ?? 0

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded w-48" />
          <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded" />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-6"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Map size={20} strokeWidth={1.5} className="text-primary-500" />
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Career Roadmap</h1>
        </div>
        <p className="text-sm text-zinc-500 mt-1">
          Generate a personalised, week-by-week learning path based on your CV analysis or a target role.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-full sm:w-fit">
        <button
          onClick={() => setMode('cv')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            mode === 'cv'
              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          <FileText size={14} strokeWidth={1.5} />
          From CV Analysis
        </button>
        <button
          onClick={() => setMode('role')}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            mode === 'role'
              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
          }`}
        >
          <User size={14} strokeWidth={1.5} />
          Custom Role
        </button>
      </div>

      {/* ── CV Analysis mode ── */}
      {mode === 'cv' && (
        <>
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <Upload size={32} strokeWidth={1.5} className="text-zinc-300 dark:text-zinc-600" />
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No CV analyses yet</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Analyse a CV against a job description first, then come back here.
                </p>
              </div>
              {onNavigateToUpload && (
                <button
                  onClick={onNavigateToUpload}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Analyse a CV
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Select a session</h2>
              <p className="text-xs text-zinc-400">
                Sessions with gap analysis produce a more targeted, skill-specific roadmap. All sessions can generate a roadmap from the job description.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sessions.map((s) => {
                  const isSelected = selectedSessionId === s.id
                  const isReady = s.has_gap_report === true
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSessionSelect(s.id)}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 ring-1 ring-primary-500'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-primary-300 dark:hover:border-primary-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText
                            size={14} strokeWidth={1.5}
                            className={`shrink-0 ${isSelected ? 'text-primary-500' : 'text-zinc-400'}`}
                          />
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {getSessionLabel(s)}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle2 size={14} strokeWidth={1.5} className="text-primary-500 shrink-0 mt-0.5" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-2 pl-5 flex-wrap">
                        <ScoreChip score={s.match_score} />
                        <span className="text-xs text-zinc-400">
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                        {isReady ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 size={10} strokeWidth={2} /> Gap analysis available
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">JD only</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>


            </div>
          )}

          {/* Target role + generate */}
          {sessions.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Target Role
                  {selectedSession?.jd_snippet && (
                    <span className="ml-2 text-zinc-400 font-normal">(auto-filled from session)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  placeholder="e.g. Senior Data Engineer, Full-Stack Developer…"
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-zinc-400"
                />
              </div>

              {!selectedSessionId && (
                <p className="text-xs text-zinc-400">Select a session above to continue</p>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || !canGenerate}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                {generating ? (
                  <><Loader2 size={16} strokeWidth={2} className="animate-spin" /> Generating your roadmap…</>
                ) : (
                  <><Map size={16} strokeWidth={1.5} /> Generate Roadmap</>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Custom Role mode ── */}
      {mode === 'role' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <p className="text-xs text-zinc-500">
            Generate a roadmap for any role without uploading a CV. Great for exploring new career paths.
          </p>

          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Target Role <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="e.g. DevOps Engineer, Product Manager, Data Scientist…"
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-zinc-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Context <span className="text-zinc-400 font-normal">(optional — seniority, tech stack, focus areas)</span>
            </label>
            <textarea
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="e.g. Mid-level role at a fintech startup, strong Python focus, needs cloud experience…"
              rows={3}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-zinc-400 resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
          >
            {generating ? (
              <><Loader2 size={16} strokeWidth={2} className="animate-spin" /> Generating your roadmap…</>
            ) : (
              <><Map size={16} strokeWidth={1.5} /> Generate Roadmap</>
            )}
          </button>
        </div>
      )}

      {/* Saved roadmaps */}
      {roadmaps.length > 0 && (
        <div>
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline cursor-pointer"
          >
            {showSaved ? 'Hide saved roadmaps' : `View saved roadmaps (${roadmaps.length})`}
          </button>
          <AnimatePresence>
            {showSaved && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-2 space-y-1"
              >
                {roadmaps.map((rm) => (
                  <button
                    key={rm.id}
                    onClick={() => loadRoadmap(rm.id)}
                    className="w-full text-left px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{rm.target_role}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      ~{rm.total_estimated_weeks} weeks · {new Date(rm.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} strokeWidth={1.5} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Generated roadmap ── */}
      {selectedRoadmap && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Stats row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <Layers size={12} strokeWidth={1.5} />
              {selectedRoadmap.phases.length} phases
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <Clock size={12} strokeWidth={1.5} />
              ~{selectedRoadmap.total_estimated_weeks} weeks
            </div>
            {totalResources > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                <Link2 size={12} strokeWidth={1.5} />
                {totalResources} resources
              </div>
            )}
            {totalHours > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                <Zap size={12} strokeWidth={1.5} />
                ~{totalHours}h of content
              </div>
            )}
            {selectedRoadmap.career_insight?.market_demand && (() => {
              const key = selectedRoadmap.career_insight.market_demand.toLowerCase()
              const d = DEMAND_STYLE[key] ?? DEMAND_STYLE.medium
              return (
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${d.cls}`}>
                  {d.label}
                </span>
              )
            })()}
          </div>

          {/* Section header */}
          <div className="flex items-center gap-2 pb-1 border-b border-zinc-100 dark:border-zinc-800">
            <MapPin size={16} strokeWidth={1.5} className="text-primary-500" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {selectedRoadmap.target_role} — Learning Path
            </h2>
          </div>

          {/* Phases */}
          <VisualRoadmap phases={selectedRoadmap.phases} reduced={reduced} />

          {/* Quick wins */}
          <QuickWinsSection quickWins={selectedRoadmap.quick_wins ?? []} />

          {/* Career insights */}
          <CareerInsightsPanel
            insight={selectedRoadmap.career_insight}
            targetRole={selectedRoadmap.target_role}
          />
        </motion.div>
      )}

      {!selectedRoadmap && (
        <div className="text-center py-10 text-zinc-400 text-sm">
          <Map size={32} strokeWidth={1.5} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
          <p>
            {mode === 'cv'
              ? 'Select a CV session and confirm the target role to generate your roadmap'
              : 'Enter a target role to generate your personalised roadmap'}
          </p>
        </div>
      )}
    </motion.div>
  )
}
