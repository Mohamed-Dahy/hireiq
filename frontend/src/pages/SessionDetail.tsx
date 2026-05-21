import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Download, ChevronDown } from 'lucide-react'
import { getSessionDetail } from '../api'
import { parseQuestions } from '../utils/parseQuestions'
import type { CVSessionDetail, InterviewResult, StructuredAnalysis } from '../api'
import ScoreGauge from '../components/ScoreGauge'
import SkillGapList from '../components/SkillGapList'
import SkillsInventory from '../components/SkillsInventory'
import SkillGapChart from '../components/SkillGapChart'
import QuestionCard from '../components/QuestionCard'
import { useToast } from '../components/Toast'
import { getSessionLabel } from '../utils/sessionLabel'

interface Props {
  sessionId: number
  onBack: () => void
  onPractice: (questions: string[]) => void
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.2, 1] } },
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
        <span>{label}</span><span className="font-medium">{value}/10</span>
      </div>
      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 10}%` }}
          transition={{ duration: 0.7, ease: [0, 0, 0.2, 1] }}
          className="bg-primary-500 h-1.5 rounded-full"
        />
      </div>
    </div>
  )
}

function InterviewCard({ result, index }: { result: InterviewResult; index: number }) {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()

  return (
    <motion.div
      variants={fadeUp}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex gap-3 items-start">
          <span className="mt-0.5 text-xs font-medium text-primary-500 bg-primary-50 dark:bg-primary-950/30 px-2 py-0.5 rounded-full shrink-0">
            Q{index + 1}
          </span>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{result.question}</p>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className="shrink-0 mt-0.5"
        >
          <ChevronDown size={16} strokeWidth={1.5} className="text-zinc-400" />
        </motion.div>
      </button>

      {open && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-4 space-y-4"
        >
          {result.transcript ? (
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">Your answer</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed italic">"{result.transcript}"</p>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">No transcript recorded.</p>
          )}

          {result.clarity_score != null && (
            <div className="space-y-2.5">
              <ScoreBar label="Clarity"   value={result.clarity_score} />
              <ScoreBar label="Relevance" value={result.relevance_score ?? 0} />
              <ScoreBar label="Depth"     value={result.depth_score ?? 0} />
            </div>
          )}

          {result.eye_contact_ratio != null && (
            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>Eye contact</span>
              <span className="font-medium text-primary-500">
                {Math.round(result.eye_contact_ratio * 100)}%
              </span>
            </div>
          )}

          <p className="text-xs text-zinc-400">
            Answered {new Date(result.created_at).toLocaleString()}
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}

export default function SessionDetail({ sessionId, onBack, onPractice }: Props) {
  const reduced = useReducedMotion()
  const toast = useToast()
  const [detail, setDetail] = useState<CVSessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [analysisStarted, setAnalysisStarted] = useState(false)
  const [structured, setStructured] = useState<StructuredAnalysis | null>(null)

  useEffect(() => {
    getSessionDetail(sessionId)
      .then((res) => setDetail(res.data))
      .catch(() => setError('Could not load session'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const startAnalysis = () => {
    setAnalysis('')
    setStructured(null)
    setStreaming(true)
    setAnalysisStarted(true)
    const token = localStorage.getItem('access_token')
    const es = new EventSource(`/analyze?session_id=${sessionId}&token=${token}`)
    es.addEventListener('structured', (e: MessageEvent) => {
      try { setStructured(JSON.parse(e.data) as StructuredAnalysis) } catch {}
    })
    es.onmessage = (e) => {
      if (e.data === '[DONE]') { setStreaming(false); es.close(); return }
      setAnalysis((prev) => prev + e.data.replace(/\\n/g, '\n'))
    }
    es.onerror = () => { setStreaming(false); es.close() }
  }

  const downloadReport = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`/cv/${sessionId}/report`, {
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
      a.download = `hireiq_report_session_${sessionId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch {
      toast.error('Could not download report — is the backend running?')
    }
  }

  const analysisQuestions = parseQuestions(analysis)
  const storedQuestions = detail?.ai_interview_questions ?? []
  const pastQuestions = detail?.interview_results.map((r) => r.question) ?? []
  const practiceQuestions = analysisQuestions.length > 0 ? analysisQuestions
    : storedQuestions.length > 0 ? storedQuestions
    : pastQuestions

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center text-zinc-400 text-sm animate-pulse">
        Loading session…
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center text-red-400 text-sm">
        {error || 'Session not found.'}
      </div>
    )
  }

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-6"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors cursor-pointer"
        >
          ← Back to history
        </button>

        <div className="flex gap-2">
          <button
            onClick={downloadReport}
            className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <Download size={14} strokeWidth={1.5} />
            PDF
          </button>

          {practiceQuestions.length > 0 && (
            <button
              onClick={() => onPractice(practiceQuestions)}
              className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-4 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Practice these →
            </button>
          )}
        </div>
      </div>

      {/* Session header */}
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 truncate">{getSessionLabel(detail)}</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Uploaded {new Date(detail.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      {/* Score */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show"
        className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col items-center gap-3"
      >
        {detail.match_score != null ? (
          <ScoreGauge score={detail.match_score} />
        ) : (
          <p className="text-4xl font-semibold text-zinc-400">—</p>
        )}
        <p className="text-xs text-zinc-400">Match Score</p>
      </motion.div>

      {/* Skill gap analysis */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Skill Gap Analysis</h3>
          <button
            onClick={startAnalysis}
            disabled={streaming}
            className="text-xs border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 px-3 py-1.5 rounded-lg hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {streaming ? 'Analyzing…' : analysisStarted ? 'Re-analyze' : 'Run Analysis'}
          </button>
        </div>

        {analysisStarted ? (
          <SkillGapList text={analysis} loading={streaming} />
        ) : (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5 text-sm text-zinc-400 text-center">
            Click "Run Analysis" to stream a fresh skill gap report.
          </div>
        )}
      </motion.div>

      {/* Structured analysis results */}
      {structured && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-6">
          {structured.candidate_level && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Assessed level:</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                {structured.candidate_level}
              </span>
            </div>
          )}

          {structured.skill_inventory?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Your Skills</h3>
              <SkillsInventory skills={structured.skill_inventory} />
            </div>
          )}

          {structured.gap_report?.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Priority Gaps</h3>
              <SkillGapChart gaps={structured.gap_report} />
            </div>
          )}

          {parseQuestions(analysis).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Interview Questions</h3>
                <button
                  onClick={() => onPractice(parseQuestions(analysis))}
                  className="text-xs bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Practice these →
                </button>
              </div>
              <div className="space-y-3">
                {parseQuestions(analysis).map((q, i) => (
                  <QuestionCard key={i} question={q} index={i} />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Stored interview questions (available without re-analyzing) */}
      {!analysisStarted && storedQuestions.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Interview Questions</h3>
            <button
              onClick={() => onPractice(storedQuestions)}
              className="text-xs bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Practice all →
            </button>
          </div>
          <div className="space-y-3">
            {storedQuestions.map((q, i) => (
              <QuestionCard key={i} question={q} index={i} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Interview results */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Interview Results</h3>
          <span className="text-xs text-zinc-400">{detail.interview_results.length} answered</span>
        </div>

        {detail.interview_results.length === 0 ? (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5 text-sm text-zinc-400 text-center">
            No interview answers recorded for this session yet.
            {practiceQuestions.length > 0 ? (
              <p className="mt-1">Use "Practice all" above to start a mock interview.</p>
            ) : (
              <p className="mt-1">Run an analysis first to generate questions.</p>
            )}
          </div>
        ) : (
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          >
            {detail.interview_results.map((r, i) => (
              <InterviewCard key={r.id} result={r} index={i} />
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
