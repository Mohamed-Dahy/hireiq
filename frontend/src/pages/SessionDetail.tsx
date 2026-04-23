import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { getSessionDetail } from '../api'
import { parseQuestions } from '../utils/parseQuestions'
import type { CVSessionDetail, InterviewResult } from '../api'
import ScoreGauge from '../components/ScoreGauge'
import SkillGapList from '../components/SkillGapList'
import { useToast } from '../components/Toast'

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
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span><span className="font-medium">{value}/10</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 10}%` }}
          transition={{ duration: 0.7, ease: [0, 0, 0.2, 1] }}
          className="bg-purple-500 h-2 rounded-full"
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
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
    >
      {/* Question header — always visible, click to expand */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex gap-3 items-start">
          <span className="mt-0.5 text-xs font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full shrink-0">
            Q{index + 1}
          </span>
          <p className="text-sm font-medium text-gray-800">{result.question}</p>
        </div>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className="w-4 h-4 text-gray-400 shrink-0 mt-0.5"
        >
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round"/>
        </motion.svg>
      </button>

      {/* Expanded content */}
      {open && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="border-t border-gray-100 px-5 py-4 space-y-4"
        >
          {result.transcript ? (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Your answer</p>
              <p className="text-sm text-gray-700 leading-relaxed italic">"{result.transcript}"</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No transcript recorded.</p>
          )}

          {result.clarity_score != null && (
            <div className="space-y-2.5">
              <ScoreBar label="Clarity"   value={result.clarity_score} />
              <ScoreBar label="Relevance" value={result.relevance_score ?? 0} />
              <ScoreBar label="Depth"     value={result.depth_score ?? 0} />
            </div>
          )}

          {result.eye_contact_ratio != null && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Eye contact</span>
              <span className="font-semibold text-purple-600">
                {Math.round(result.eye_contact_ratio * 100)}%
              </span>
            </div>
          )}

          <p className="text-xs text-gray-400">
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

  useEffect(() => {
    getSessionDetail(sessionId)
      .then((res) => setDetail(res.data))
      .catch(() => setError('Could not load session'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const startAnalysis = () => {
    setAnalysis('')
    setStreaming(true)
    setAnalysisStarted(true)
    const token = localStorage.getItem('access_token')
    const es = new EventSource(`/analyze?session_id=${sessionId}&token=${token}`)
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

  // Fallback: use questions from past interview results
  const pastQuestions = detail?.interview_results.map((r) => r.question) ?? []
  const practiceQuestions = analysisQuestions.length > 0 ? analysisQuestions : pastQuestions

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center text-gray-400 text-sm animate-pulse">
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

  const scoreColor = detail.match_score == null ? 'text-gray-400'
    : detail.match_score >= 70 ? 'text-green-600'
    : detail.match_score >= 40 ? 'text-yellow-500'
    : 'text-red-500'

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-2xl mx-auto py-12 px-4 space-y-8"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <motion.button
          onClick={onBack}
          whileHover={reduced ? {} : { x: -3 }}
          transition={{ duration: 0.15 }}
          className="text-sm text-purple-600 hover:underline cursor-pointer"
        >
          ← Back to history
        </motion.button>

        <div className="flex gap-2">
          <motion.button
            onClick={downloadReport}
            whileHover={reduced ? {} : { scale: 1.03 }}
            whileTap={reduced ? {} : { scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-purple-300 hover:text-purple-600 transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            PDF
          </motion.button>

          {practiceQuestions.length > 0 && (
            <motion.button
              onClick={() => onPractice(practiceQuestions)}
              whileHover={reduced ? {} : { scale: 1.03 }}
              whileTap={reduced ? {} : { scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="text-sm bg-purple-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-purple-700 transition-colors cursor-pointer"
            >
              Practice these →
            </motion.button>
          )}
        </div>
      </div>

      {/* Session header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 truncate">{detail.cv_filename}</h2>
        <p className="text-xs text-gray-400 mt-1">
          Uploaded {new Date(detail.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      {/* Score */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show"
        className="bg-white rounded-2xl border border-purple-100 p-8 flex flex-col items-center gap-3 shadow-sm"
      >
        {detail.match_score != null ? (
          <ScoreGauge score={detail.match_score} />
        ) : (
          <p className={`text-4xl font-extrabold ${scoreColor}`}>—</p>
        )}
        <p className="text-xs text-gray-400">Match Score</p>
      </motion.div>

      {/* Skill gap analysis */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800">Skill Gap Analysis</h3>
          <motion.button
            onClick={startAnalysis}
            disabled={streaming}
            whileHover={reduced ? {} : { scale: 1.03 }}
            whileTap={reduced ? {} : { scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="text-xs border border-purple-200 text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {streaming ? 'Analyzing…' : analysisStarted ? 'Re-analyze' : 'Run Analysis'}
          </motion.button>
        </div>

        {analysisStarted ? (
          <SkillGapList text={analysis} loading={streaming} />
        ) : (
          <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-400 text-center">
            Click "Run Analysis" to stream a fresh skill gap report.
          </div>
        )}
      </motion.div>

      {/* Interview results */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800">Interview Results</h3>
          <span className="text-xs text-gray-400">{detail.interview_results.length} answered</span>
        </div>

        {detail.interview_results.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-5 text-sm text-gray-400 text-center">
            No interview answers recorded for this session yet.
            {practiceQuestions.length === 0 && (
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
