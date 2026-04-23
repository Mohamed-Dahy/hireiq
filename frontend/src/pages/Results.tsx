import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import confetti from 'canvas-confetti'
import ScoreGauge from '../components/ScoreGauge'
import SkillGapList from '../components/SkillGapList'
import QuestionCard from '../components/QuestionCard'
import { useToast } from '../components/Toast'
import type { CVUploadResponse } from '../api'
import { parseQuestions } from '../utils/parseQuestions'

interface Props {
  result: CVUploadResponse
  onBack: () => void
  onPractice: (questions: string[]) => void  // navigate to interview with questions
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] } },
}

export default function Results({ result, onBack, onPractice }: Props) {
  const reduced = useReducedMotion()
  const toast = useToast()
  const [analysis, setAnalysis] = useState('')
  const [streaming, setStreaming] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const questions = parseQuestions(analysis)

  // Celebrate high scores
  useEffect(() => {
    if (reduced || result.match_score < 70) return
    const t = setTimeout(() => {
      const colors = ['#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe']
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.35 },
        colors,
        scalar: 0.9,
        ticks: 220,
      })
    }, 600)
    return () => clearTimeout(t)
  }, [result.match_score, reduced])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const es = new EventSource(`/analyze?session_id=${result.session_id}&token=${token}`)
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
      className="max-w-2xl mx-auto py-12 px-4 space-y-8"
    >
      {/* Top actions */}
      <div className="flex items-center justify-between">
        <motion.button
          onClick={onBack}
          whileHover={reduced ? {} : { x: -3 }}
          transition={{ duration: 0.15 }}
          className="text-sm text-purple-600 hover:underline cursor-pointer"
        >
          ← Upload another CV
        </motion.button>

        <motion.button
          onClick={downloadReport}
          disabled={downloading}
          whileHover={reduced ? {} : { scale: 1.03 }}
          whileTap={reduced ? {} : { scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-purple-300 hover:text-purple-600 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {downloading ? 'Generating…' : 'Download PDF'}
        </motion.button>
      </div>

      {/* Score card */}
      <motion.div
        initial={reduced ? {} : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
        className="bg-white rounded-2xl shadow-sm border border-purple-100 p-8 flex flex-col items-center gap-4"
      >
        <ScoreGauge score={result.match_score} />

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
              className="bg-purple-50 text-purple-700 text-xs px-3 py-1 rounded-full font-medium"
            >
              {s}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>

      {/* Skill gap analysis */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Skill Gap Analysis</h3>
        <SkillGapList text={analysis} loading={streaming} />
      </motion.div>

      {/* Interview questions */}
      {questions.length > 0 && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-800">Interview Questions</h3>
            <motion.button
              onClick={() => onPractice(questions)}
              whileHover={reduced ? {} : { scale: 1.03 }}
              whileTap={reduced ? {} : { scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-purple-700 transition-colors cursor-pointer"
            >
              Practice these →
            </motion.button>
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
