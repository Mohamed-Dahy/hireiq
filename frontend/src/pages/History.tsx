import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { getSessions } from '../api'
import type { CVSession } from '../api'

interface Props {
  onSelect: (sessionId: number) => void
}

export default function History({ onSelect }: Props) {
  const reduced = useReducedMotion()
  const [sessions, setSessions] = useState<CVSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getSessions()
      .then((res) => setSessions(res.data))
      .catch(() => setError('Could not load history'))
      .finally(() => setLoading(false))
  }, [])

  const scoreColor = (s: number | null) => {
    if (s == null) return 'text-gray-400'
    return s >= 70 ? 'text-green-600' : s >= 40 ? 'text-yellow-500' : 'text-red-500'
  }

  const scoreBg = (s: number | null) => {
    if (s == null) return 'bg-gray-100'
    return s >= 70 ? 'bg-green-50' : s >= 40 ? 'bg-yellow-50' : 'bg-red-50'
  }

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-2xl mx-auto py-12 px-4"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Session History</h2>
      <p className="text-sm text-gray-500 mb-6">Click any session to view scores, analysis, and interview feedback.</p>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl px-5 py-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-2.5 bg-gray-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mx-auto mb-3 text-gray-300">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p className="text-sm">No sessions yet. Upload your first CV!</p>
        </div>
      )}

      <motion.div
        className="space-y-3"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
      >
        {sessions.map((s) => (
          <motion.button
            key={s.id}
            onClick={() => onSelect(s.id)}
            variants={{
              hidden: { opacity: 0, y: 12 },
              show:   { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0, 0, 0.2, 1] } },
            }}
            whileHover={reduced ? {} : { y: -2, boxShadow: '0 8px 24px rgba(124,58,237,0.1)' }}
            whileTap={reduced ? {} : { scale: 0.99 }}
            transition={{ duration: 0.18 }}
            className="w-full bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center justify-between shadow-sm hover:border-purple-200 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-4">
              {/* File icon */}
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" className="w-4 h-4">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 truncate max-w-xs">{s.cv_filename}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(s.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* Score badge */}
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${scoreColor(s.match_score)} ${scoreBg(s.match_score)}`}>
                {s.match_score != null ? `${s.match_score}%` : '—'}
              </span>
              {/* Chevron */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-300">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  )
}
