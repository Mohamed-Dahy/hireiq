import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, Map, MapPin, Layers, Clock, BookOpen, Upload, AlertCircle, CheckCircle2, FileText, User } from 'lucide-react'
import RoadmapPhaseCard from '../components/RoadmapPhaseCard'
import CareerInsightCard from '../components/CareerInsightCard'
import QuickWinsCard from '../components/QuickWinsCard'
import { getMySessions, generateRoadmap, listRoadmaps, getRoadmap } from '../api'
import type { RoadmapResponse, RoadmapListItem, CVSession } from '../api'

interface Props {
  initialSessionId?: number | null
  onNavigateToUpload?: () => void
}

type Mode = 'cv' | 'role'

function formatFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ')
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

  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? null
  const sessionHasAnalysis = selectedSession?.has_gap_report === true

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

  const totalResources = selectedRoadmap?.phases.reduce(
    (sum, p) => sum + p.resources.length, 0
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
        <p className="text-sm text-zinc-500 mt-1">Generate a personalised learning path from your CV analysis or a target role</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-fit">
        <button
          onClick={() => setMode('cv')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
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
                <p className="text-xs text-zinc-500 mt-1">Analyse a CV against a job description first, then come back here.</p>
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
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Select a CV Session</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sessions.map((s) => {
                  const isSelected = selectedSessionId === s.id
                  const isReady = s.has_gap_report === true
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSessionId(s.id)}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 ring-1 ring-primary-500'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-primary-300 dark:hover:border-primary-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} strokeWidth={1.5} className={`shrink-0 ${isSelected ? 'text-primary-500' : 'text-zinc-400'}`} />
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {formatFilename(s.cv_filename)}
                          </span>
                        </div>
                        {isSelected && <CheckCircle2 size={14} strokeWidth={1.5} className="text-primary-500 shrink-0 mt-0.5" />}
                      </div>

                      {s.jd_snippet && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 line-clamp-2 pl-5">
                          {s.jd_snippet}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-2 pl-5">
                        <ScoreChip score={s.match_score} />
                        <span className="text-xs text-zinc-400">{new Date(s.created_at).toLocaleDateString()}</span>
                        {isReady ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Analysed</span>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Needs analysis</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Info when selected session has no analysis */}
              {selectedSession && !sessionHasAnalysis && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                  <AlertCircle size={15} strokeWidth={1.5} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      This session hasn't been fully analysed yet. The roadmap will be generated from the job description only.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Run a CV analysis first for a more personalised, gap-focused roadmap.
                    </p>
                  </div>
                  {onNavigateToUpload && (
                    <button
                      onClick={onNavigateToUpload}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      Run Analysis
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Target role input for CV mode */}
          {sessions.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1.5">Target Role</label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                  placeholder="e.g. Senior Data Engineer, Full-Stack Developer, ML Engineer…"
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-zinc-400"
                />
              </div>

              {!selectedSessionId && (
                <p className="text-xs text-zinc-400">Select a CV session above to continue</p>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || !canGenerate}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
              >
                {generating ? (
                  <><Loader2 size={16} strokeWidth={2} className="animate-spin" /> Generating…</>
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
            <label className="block text-xs text-zinc-400 font-medium mb-1.5">Target Role <span className="text-red-400">*</span></label>
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
            <label className="block text-xs text-zinc-400 font-medium mb-1.5">
              Role Description <span className="text-zinc-400">(optional)</span>
            </label>
            <textarea
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Describe the role, seniority level, tech stack, or anything specific you want the roadmap to address…"
              rows={4}
              className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-zinc-400 resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
          >
            {generating ? (
              <><Loader2 size={16} strokeWidth={2} className="animate-spin" /> Generating…</>
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
          {showSaved && (
            <div className="mt-2 space-y-1">
              {roadmaps.map((rm) => (
                <button
                  key={rm.id}
                  onClick={() => loadRoadmap(rm.id)}
                  className="w-full text-left px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{rm.target_role}</p>
                  <p className="text-xs text-zinc-400">~{rm.total_estimated_weeks} weeks · {new Date(rm.created_at).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} strokeWidth={1.5} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Generated roadmap */}
      {selectedRoadmap && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <Layers size={12} strokeWidth={1.5} />
              {selectedRoadmap.phases.length} Phases
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <Clock size={12} strokeWidth={1.5} />
              {selectedRoadmap.total_estimated_weeks} Total Weeks
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
              <BookOpen size={12} strokeWidth={1.5} />
              {totalResources} Resources
            </div>
          </div>

          <CareerInsightCard insight={selectedRoadmap.career_insight} />

          <QuickWinsCard
            quickWins={selectedRoadmap.quick_wins}
            sessionId={selectedRoadmap.id}
          />

          <div className="flex items-center gap-2 mb-2">
            <MapPin size={16} strokeWidth={1.5} className="text-primary-500" />
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Learning Path</h2>
          </div>

          <div className="space-y-3">
            {selectedRoadmap.phases.map((phase, i) => (
              <RoadmapPhaseCard
                key={i}
                phase={phase}
                index={i}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        </>
      )}

      {!selectedRoadmap && (
        <div className="text-center py-10 text-zinc-400 text-sm">
          <Map size={32} strokeWidth={1.5} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
          <p>
            {mode === 'cv'
              ? 'Select a CV session and enter a target role to generate your roadmap'
              : 'Enter a target role to generate your personalised roadmap'}
          </p>
        </div>
      )}
    </motion.div>
  )
}
