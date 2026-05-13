import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2, Map, MapPin, Layers, Clock, BookOpen, Upload, AlertCircle } from 'lucide-react'
import RoadmapPhaseCard from '../components/RoadmapPhaseCard'
import CareerInsightCard from '../components/CareerInsightCard'
import QuickWinsCard from '../components/QuickWinsCard'
import { getMySessions, generateRoadmap, listRoadmaps, getRoadmap } from '../api'
import type { RoadmapResponse, RoadmapListItem } from '../api'

interface Props {
  initialSessionId?: number | null
}

export default function CareerRoadmap({ initialSessionId }: Props) {
  const reduced = useReducedMotion()
  const [sessions, setSessions] = useState<Array<{ id: number; cv_filename: string; created_at: string; match_score: number | null }>>([])
  const [roadmaps, setRoadmaps] = useState<RoadmapListItem[]>([])
  const [selectedRoadmap, setSelectedRoadmap] = useState<RoadmapResponse | null>(null)
  const [targetRole, setTargetRole] = useState('')
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

  const handleGenerate = async () => {
    if (!targetRole.trim()) return
    setGenerating(true)
    setError('')
    try {
      const res = await generateRoadmap(selectedSessionId, targetRole.trim())
      setSelectedRoadmap(res.data)
      setTargetRole('')
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
          <div className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded" />
          <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded" />
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
      <div className="flex items-center gap-2">
        <Map size={20} strokeWidth={1.5} className="text-violet-500" />
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Career Roadmap</h1>
      </div>
      <p className="text-sm text-zinc-500 -mt-4">Get a personalised learning path to your dream role</p>

      {sessions.length === 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-sm text-amber-800 dark:text-amber-200">
          <Upload size={16} strokeWidth={1.5} className="shrink-0" />
          Upload a CV first to get a personalised roadmap based on your skills
        </div>
      )}

      {roadmaps.length > 0 && (
        <div>
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="text-xs text-violet-600 dark:text-violet-400 font-medium hover:underline cursor-pointer"
          >
            {showSaved ? 'Hide saved roadmaps' : `View saved roadmaps (${roadmaps.length})`}
          </button>
          {showSaved && (
            <div className="mt-2 space-y-1">
              {roadmaps.map((rm) => (
                <button
                  key={rm.id}
                  onClick={() => loadRoadmap(rm.id)}
                  className="w-full text-left px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-700 transition-colors cursor-pointer"
                >
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{rm.target_role}</p>
                  <p className="text-xs text-zinc-400">~{rm.total_estimated_weeks} weeks · {new Date(rm.created_at).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs text-zinc-400 font-medium mb-1.5">CV Session (optional)</label>
          <select
            value={selectedSessionId ?? ''}
            onChange={(e) => setSelectedSessionId(e.target.value ? Number(e.target.value) : null)}
            className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">(no CV session)</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.cv_filename} — {new Date(s.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-zinc-400 font-medium mb-1.5">Target Role</label>
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Senior Data Engineer, Full-Stack Developer, ML Engineer..."
            className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-zinc-400"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating || !targetRole.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
        >
          {generating ? (
            <><Loader2 size={16} strokeWidth={2} className="animate-spin" /> Generating…</>
          ) : (
            <><Map size={16} strokeWidth={1.5} /> Generate Roadmap</>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} strokeWidth={1.5} className="shrink-0" />
          {error}
        </div>
      )}

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
            <MapPin size={16} strokeWidth={1.5} className="text-violet-500" />
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

      {!selectedRoadmap && !loading && (
        <div className="text-center py-16 text-zinc-400 text-sm">
          <Map size={32} strokeWidth={1.5} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
          <p>Enter a target role and generate your personalised career roadmap</p>
        </div>
      )}
    </motion.div>
  )
}
