import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { getSessions, deleteSession } from '../api'
import type { CVSession } from '../api'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'

interface Props {
  onSelect: (sessionId: number) => void
}

type ScoreFilter = 'all' | 'high' | 'mid' | 'low'

export default function History({ onSelect }: Props) {
  const reduced = useReducedMotion()
  const toast = useToast()
  const [sessions, setSessions] = useState<CVSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ScoreFilter>('all')
  const [pendingDelete, setPendingDelete] = useState<CVSession | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getSessions()
      .then((res) => setSessions(res.data))
      .catch(() => setError('Could not load history'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (search && !s.cv_filename.toLowerCase().includes(search.toLowerCase())) return false
      if (filter === 'all') return true
      if (s.match_score == null) return false
      if (filter === 'high') return s.match_score >= 70
      if (filter === 'mid')  return s.match_score >= 40 && s.match_score < 70
      if (filter === 'low')  return s.match_score < 40
      return true
    })
  }, [sessions, search, filter])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await deleteSession(pendingDelete.id)
      setSessions((list) => list.filter((s) => s.id !== pendingDelete.id))
      toast.success(`Deleted "${pendingDelete.cv_filename}"`)
      setPendingDelete(null)
    } catch {
      toast.error('Failed to delete session')
    } finally {
      setDeleting(false)
    }
  }

  const scoreColor = (s: number | null) => {
    if (s == null) return 'text-gray-400'
    return s >= 70 ? 'text-green-600' : s >= 40 ? 'text-yellow-500' : 'text-red-500'
  }

  const scoreBg = (s: number | null) => {
    if (s == null) return 'bg-gray-100'
    return s >= 70 ? 'bg-green-50' : s >= 40 ? 'bg-yellow-50' : 'bg-red-50'
  }

  const filterChips: { id: ScoreFilter; label: string; activeColor: string }[] = [
    { id: 'all',  label: 'All',     activeColor: 'bg-purple-600 text-white border-purple-600' },
    { id: 'high', label: '70%+',    activeColor: 'bg-green-500 text-white border-green-500' },
    { id: 'mid',  label: '40–69%',  activeColor: 'bg-yellow-500 text-white border-yellow-500' },
    { id: 'low',  label: '<40%',    activeColor: 'bg-red-500 text-white border-red-500' },
  ]

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-2xl mx-auto py-12 px-4"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Session History</h2>
      <p className="text-sm text-gray-500 mb-6">Click any session to view scores, analysis, and interview feedback.</p>

      {/* Search + filters */}
      {!loading && sessions.length > 0 && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-3 mb-5"
        >
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by CV filename…"
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {filterChips.map((c) => (
              <motion.button
                key={c.id}
                onClick={() => setFilter(c.id)}
                whileTap={reduced ? {} : { scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                  filter === c.id
                    ? c.activeColor
                    : 'bg-white border-gray-200 text-gray-500 hover:border-purple-300'
                }`}
              >
                {c.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

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

      {!loading && sessions.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No sessions match your search or filter.
        </div>
      )}

      <motion.div
        className="space-y-3"
        layout
      >
        <AnimatePresence initial={false}>
          {filtered.map((s) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
              transition={{ duration: 0.28, ease: [0, 0, 0.2, 1] }}
              whileHover={reduced ? {} : { y: -2, boxShadow: '0 8px 24px rgba(124,58,237,0.1)' }}
              className="group w-full bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center justify-between shadow-sm hover:border-purple-200 transition-colors"
            >
              <button
                onClick={() => onSelect(s.id)}
                className="flex items-center gap-4 flex-1 text-left cursor-pointer min-w-0"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" className="w-4 h-4">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.cv_filename}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(s.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0 pl-2">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${scoreColor(s.match_score)} ${scoreBg(s.match_score)}`}>
                  {s.match_score != null ? `${s.match_score}%` : '—'}
                </span>

                {/* Delete button — visible on hover */}
                <motion.button
                  onClick={(e) => { e.stopPropagation(); setPendingDelete(s) }}
                  whileHover={reduced ? {} : { scale: 1.08 }}
                  whileTap={reduced ? {} : { scale: 0.92 }}
                  transition={{ duration: 0.12 }}
                  aria-label="Delete session"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.button>

                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-300">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <Modal
        open={pendingDelete !== null}
        onClose={() => !deleting && setPendingDelete(null)}
        title="Delete this session?"
        description={`This will permanently delete "${pendingDelete?.cv_filename}" and all its interview answers. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </motion.div>
  )
}
