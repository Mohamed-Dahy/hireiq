import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Download, Loader2, Map as MapIcon } from 'lucide-react'
import confetti from 'canvas-confetti'
import ScoreGauge from '../components/ScoreGauge'
import SkillGapList from '../components/SkillGapList'
import QuestionCard from '../components/QuestionCard'
import SkillsInventory from '../components/SkillsInventory'
import SkillGapChart from '../components/SkillGapChart'
import { useToast } from '../components/Toast'
import type { CVUploadResponse, StructuredAnalysis } from '../api'
import { parseQuestions } from '../utils/parseQuestions'

interface Props {
  result: CVUploadResponse
  onBack: () => void
  onPractice: (questions: string[]) => void
  onRoadmap: (sessionId: number) => void
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] } },
}

export default function Results({ result, onBack, onPractice, onRoadmap }: Props) {
  const reduced = useReducedMotion()
  const toast = useToast()
  const [analysis, setAnalysis] = useState('')
  const [streaming, setStreaming] = useState(true)
  const [structured, setStructured] = useState<StructuredAnalysis | null>(null)
  const [downloading, setDownloading] = useState(false)

  const questions = parseQuestions(analysis)

  useEffect(() => {
    if (reduced || result.match_score < 70) return
    const t = setTimeout(() => {
      const colors = ['#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe']
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.35 }, colors, scalar: 0.9, ticks: 220 })
    }, 600)
    return () => clearTimeout(t)
  }, [result.match_score, reduced])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const es = new EventSource(`/analyze?session_id=${result.session_id}&token=${token}`)

    es.addEventListener('structured', (e: MessageEvent) => {
      try {
        setStructured(JSON.parse(e.data) as StructuredAnalysis)
      } catch {
        // Ignore malformed JSON from LLM
      }
    })

    es.onmessage = (e) => {
      if (e.data === '[DONE]') { setStreaming(false); es.close(); return }
      setAnalysis((prev) => prev + e.data.replace(/\\n/g, '\n'))
    }
    es.onerror = () => { setStreaming(false); es.close() }
    return () => es.close()
  }, [result.session_id])

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
      className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-8"
    >
      {/* Top actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors cursor-pointer"
        >
          ← Upload another CV
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

      {/* Score card */}
      <motion.div
        initial={reduced ? {} : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col items-center gap-4"
      >
        <ScoreGauge score={result.match_score} />

        {result.is_linkedin && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
            </svg>
            LinkedIn Profile
          </span>
        )}

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.5 } } }}
          className="flex flex-wrap gap-2 justify-center"
        >
          {result.skills_found.map((s) => (
            <motion.span
              key={s}
              variants={{
                hidden: { opacity: 0, scale: 0.7 },
                show:   { opacity: 1, scale: 1, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } },
              }}
              className="bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 text-xs px-3 py-1 rounded-full font-medium border border-violet-200 dark:border-violet-800"
            >
              {s}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>

      {/* Narrative skill gap analysis */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Skill Gap Analysis</h3>
        <SkillGapList text={analysis} loading={streaming} />
      </motion.div>

      {/* Structured analysis */}
      {structured && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          className="space-y-8"
        >
          {structured.candidate_level && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Assessed level:</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
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

          <button
            onClick={() => onRoadmap(result.session_id)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
          >
            <MapIcon size={16} strokeWidth={1.5} />
            Build My Career Roadmap →
          </button>
        </motion.div>
      )}

      {/* Interview questions */}
      {questions.length > 0 && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Interview Questions</h3>
            <button
              onClick={() => onPractice(questions)}
              className="text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
            >
              Practice these →
            </button>
          </div>

          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          >
            {questions.map((q, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, x: -12 },
                  show:   { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0, 0, 0.2, 1] } },
                }}
              >
                <QuestionCard question={q} index={i} />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}
