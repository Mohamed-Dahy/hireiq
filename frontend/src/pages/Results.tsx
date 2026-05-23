import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Download, Loader2, Map as MapIcon, Trash2,
  CheckCircle2, Mic, TrendingUp, Brain, Target, Sparkles, AlertTriangle,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import ScoreGauge from '../components/ScoreGauge'
import SkillGapList from '../components/SkillGapList'
import QuestionCard from '../components/QuestionCard'
import SkillsInventory from '../components/SkillsInventory'
import SkillGapChart from '../components/SkillGapChart'
import { useToast } from '../components/Toast'
import type { CVUploadResponse, StructuredAnalysis } from '../api'
import { deleteSession, saveInterviewQuestions } from '../api'
import { parseQuestions } from '../utils/parseQuestions'

interface Props {
  result: CVUploadResponse
  onBack: () => void
  onDiscard: () => void
  onPractice: (questions: string[]) => void
  onRoadmap: (sessionId: number) => void
}

type Tab = 'overview' | 'skills' | 'gaps' | 'interview'

const TABS: { id: Tab; label: string; icon: typeof TrendingUp }[] = [
  { id: 'overview',  label: 'Overview',  icon: TrendingUp },
  { id: 'skills',    label: 'Skills',    icon: Brain },
  { id: 'gaps',      label: 'Gaps',      icon: Target },
  { id: 'interview', label: 'Interview', icon: Mic },
]

function getScoreTier(score: number) {
  if (score >= 85) return {
    label: 'Excellent Match',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    desc: 'Your profile is a strong fit for this role.',
  }
  if (score >= 70) return {
    label: 'Strong Match',
    color: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-800',
    desc: 'You meet most requirements — focus on the highlighted skill gaps.',
  }
  if (score >= 55) return {
    label: 'Good Match',
    color: 'text-primary-700 dark:text-primary-300',
    bg: 'bg-primary-50 dark:bg-primary-950/30',
    border: 'border-primary-200 dark:border-primary-800',
    desc: 'A solid foundation — targeted upskilling will close the gap.',
  }
  if (score >= 40) return {
    label: 'Needs Work',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    desc: 'Significant gaps exist — use your roadmap to prioritise what to learn.',
  }
  return {
    label: 'Major Gaps',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    desc: 'Substantial upskilling needed before applying for this role.',
  }
}

function EmptyState({ streaming, message, fallback }: { streaming: boolean; message: string; fallback: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      {streaming ? (
        <>
          <Loader2 size={22} className="animate-spin text-primary-400" />
          <p className="text-sm text-zinc-400">{message}</p>
        </>
      ) : (
        <p className="text-sm text-zinc-400">{fallback}</p>
      )}
    </div>
  )
}

function ActionCard({ icon, title, desc, onClick, loading }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void; loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-start gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left transition-all cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-sm disabled:opacity-50 w-full"
    >
      <div className="mt-0.5 shrink-0">
        {loading ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-zinc-400" /> : icon}
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="text-xs mt-0.5 text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
    </button>
  )
}

export default function Results({ result, onBack, onDiscard, onPractice, onRoadmap }: Props) {
  const reduced = useReducedMotion()
  const toast = useToast()
  const [analysis, setAnalysis] = useState('')
  const [streaming, setStreaming] = useState(true)
  const [structured, setStructured] = useState<StructuredAnalysis | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const analysisTextRef = useRef('')
  const questions = parseQuestions(analysis)
  const tier = getScoreTier(result.match_score)

  useEffect(() => {
    if (reduced || result.match_score < 70) return
    const t = setTimeout(() => {
      const colors = ['#2563eb', '#3b82f6', '#60a5fa', '#0d9488', '#14b8a6']
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.35 }, colors, scalar: 0.9, ticks: 220 })
    }, 600)
    return () => clearTimeout(t)
  }, [result.match_score, reduced])

  useEffect(() => {
    analysisTextRef.current = ''
    const token = localStorage.getItem('access_token')
    const es = new EventSource(`/analyze?session_id=${result.session_id}&token=${token}`)

    const timeout = setTimeout(() => {
      setStreaming(false)
      es.close()
    }, 60_000)

    es.addEventListener('structured', (e: MessageEvent) => {
      try { setStructured(JSON.parse(e.data) as StructuredAnalysis) } catch {}
    })
    es.onmessage = (e) => {
      if (e.data === '[DONE]') {
        clearTimeout(timeout)
        setStreaming(false)
        es.close()
        const qs = parseQuestions(analysisTextRef.current)
        if (qs.length > 0) {
          saveInterviewQuestions(result.session_id, qs).catch(() => {})
        }
        return
      }
      const chunk = e.data.replace(/\\n/g, '\n')
      analysisTextRef.current += chunk
      setAnalysis((prev) => prev + chunk)
    }
    es.onerror = () => { clearTimeout(timeout); setStreaming(false); es.close() }
    return () => { clearTimeout(timeout); es.close() }
  }, [result.session_id])

  const handleSave = () => {
    setSaved(true)
    toast.success('Session saved to your history')
  }

  const handleDiscard = async () => {
    setDiscarding(true)
    try {
      await deleteSession(result.session_id)
      toast.success('Session discarded')
      onDiscard()
    } catch {
      toast.error('Could not discard session')
      setDiscarding(false)
      setDiscardConfirm(false)
    }
  }

  const downloadReport = async () => {
    setDownloading(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`/cv/${result.session_id}/report`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
        toast.error(`Report failed: ${err.detail ?? res.statusText}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hireiq_report_session_${result.session_id}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch {
      toast.error('Could not download report — is the backend running?')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-6"
    >
      {/* Top nav */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors cursor-pointer"
        >
          ← Analyze another CV
        </button>
        <button
          onClick={downloadReport}
          disabled={downloading}
          className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {downloading
            ? <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> Generating…</>
            : <><Download size={14} strokeWidth={1.5} /> Download PDF</>
          }
        </button>
      </div>

      {/* Save / Discard banner */}
      <AnimatePresence>
        {!saved && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={`rounded-xl overflow-hidden border ${
              discardConfirm
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
                : 'border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/20'
            }`}
          >
            <AnimatePresence mode="wait">
              {!discardConfirm ? (
                /* Step 1 — prompt */
                <motion.div
                  key="prompt"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center justify-between px-4 py-3.5 gap-4 flex-wrap"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center shrink-0">
                      <Sparkles size={15} className="text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Analysis ready</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Save this session to your history, or discard it.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex items-center gap-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-500 text-white px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <CheckCircle2 size={13} strokeWidth={2.5} /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscardConfirm(true)}
                      className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400 px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} strokeWidth={1.5} /> Discard
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* Step 2 — confirm delete */
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center justify-between px-4 py-3.5 gap-4 flex-wrap"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                      <AlertTriangle size={15} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Delete this session?</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">All analysis data will be permanently deleted. This cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDiscardConfirm(false)}
                      disabled={discarding}
                      className="text-sm font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-500 px-4 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscard}
                      disabled={discarding}
                      className="flex items-center gap-1.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {discarding
                        ? <><Loader2 size={13} strokeWidth={2} className="animate-spin" /> Deleting…</>
                        : <><Trash2 size={13} strokeWidth={1.5} /> Yes, delete</>
                      }
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score card */}
      <motion.div
        initial={reduced ? {} : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
      >
        <div className="p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="shrink-0">
            <ScoreGauge score={result.match_score} />
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-2 ${tier.bg} ${tier.color} ${tier.border}`}>
              {tier.label}
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">{tier.desc}</p>

            {streaming ? (
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary-500 rounded-full origin-left"
                    animate={{ scaleX: [0.15, 0.55, 0.35, 0.75, 0.55, 0.88] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
                <span className="text-xs text-zinc-400 shrink-0 flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" /> Analyzing…
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mb-3 justify-center sm:justify-start">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Analysis complete</span>
              </div>
            )}

            {structured?.candidate_level && (
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Level:</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                  {structured.candidate_level}
                </span>
              </div>
            )}

            {result.is_linkedin && (
              <div className="mt-2 flex justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-0.5 rounded-full">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                    <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                  </svg>
                  LinkedIn Profile
                </span>
              </div>
            )}
          </div>
        </div>

        {result.skills_found.length > 0 && (
          <div className="px-6 pb-6 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mt-5 mb-3">Detected Skills</p>
            <motion.div
              initial="hidden" animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.3 } } }}
              className="flex flex-wrap gap-2"
            >
              {result.skills_found.map((s) => (
                <motion.span
                  key={s}
                  variants={{ hidden: { opacity: 0, scale: 0.75 }, show: { opacity: 1, scale: 1, transition: { duration: 0.2 } } }}
                  className="bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 text-xs px-3 py-1 rounded-full font-medium border border-primary-200 dark:border-primary-800"
                >
                  {s}
                </motion.span>
              ))}
            </motion.div>
          </div>
        )}
      </motion.div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              <Icon size={13} strokeWidth={isActive ? 2 : 1.5} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'overview' && (
            <SkillGapList text={analysis} loading={streaming} />
          )}

          {activeTab === 'skills' && (
            structured?.skill_inventory && structured.skill_inventory.length > 0
              ? <SkillsInventory skills={structured.skill_inventory} />
              : <EmptyState streaming={streaming} message="Analyzing your skills…" fallback="No skill inventory available" />
          )}

          {activeTab === 'gaps' && (
            structured?.gap_report && structured.gap_report.length > 0
              ? (
                <div className="space-y-5">
                  <SkillGapChart gaps={structured.gap_report} />
                  <button
                    onClick={() => onRoadmap(result.session_id)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
                  >
                    <MapIcon size={16} strokeWidth={1.5} />
                    Build My Career Roadmap →
                  </button>
                </div>
              )
              : <EmptyState streaming={streaming} message="Identifying skill gaps…" fallback="No gap data available" />
          )}

          {activeTab === 'interview' && (
            questions.length > 0
              ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500">{questions.length} question{questions.length !== 1 ? 's' : ''} generated</p>
                    <button
                      onClick={() => onPractice(questions)}
                      className="text-xs bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      Practice all →
                    </button>
                  </div>
                  <div className="space-y-3">
                    {questions.map((q, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
                      >
                        <QuestionCard question={q} index={i} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )
              : <EmptyState streaming={streaming} message="Generating interview questions…" fallback="No interview questions generated" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* What's next */}
      {!streaming && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="border-t border-zinc-100 dark:border-zinc-800 pt-6"
        >
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">What's next?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {structured && (
              <ActionCard
                icon={<MapIcon size={18} strokeWidth={1.5} className="text-primary-500" />}
                title="Build Roadmap"
                desc="Week-by-week learning plan"
                onClick={() => onRoadmap(result.session_id)}
              />
            )}
            {questions.length > 0 && (
              <ActionCard
                icon={<Mic size={18} strokeWidth={1.5} className="text-accent-500" />}
                title="Practice Interview"
                desc="AI-powered mock session"
                onClick={() => onPractice(questions)}
              />
            )}
            <ActionCard
              icon={<Download size={18} strokeWidth={1.5} className="text-zinc-500" />}
              title="Download Report"
              desc="Shareable PDF summary"
              onClick={downloadReport}
              loading={downloading}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
