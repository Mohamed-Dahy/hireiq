import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Search, FileText, Trash2, ChevronRight, Mic } from 'lucide-react'
import { getSessions, deleteSession } from '../api'
import type { CVSession } from '../api'
import { getSessionLabel } from '../utils/sessionLabel'
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
      if (search && !getSessionLabel(s).toLowerCase().includes(search.toLowerCase())) return false
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
      toast.success(`Deleted "${getSessionLabel(pendingDelete)}"`)
      setPendingDelete(null)
    } catch {
      toast.error('Failed to delete session')
    } finally {
      setDeleting(false)
    }
  }

  const scoreClass = (s: number | null) => {
    if (s == null) return 'text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800'
    if (s >= 70) return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800'
    if (s >= 40) return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
  }

  const filterChips: { id: ScoreFilter; label: string; activeColor: string }[] = [
    { id: 'all',  label: 'All',     activeColor: 'bg-primary-600 text-white border-primary-600' },
    { id: 'high', label: '70%+',    activeColor: 'bg-emerald-600 text-white border-emerald-600' },
    { id: 'mid',  label: '40–69%',  activeColor: 'bg-amber-500 text-white border-amber-500' },
    { id: 'low',  label: '<40%',    activeColor: 'bg-red-500 text-white border-red-500' },
  ]

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-2xl mx-auto py-8 px-4 sm:px-6"
    >
      <div className="mb-7">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-1">Session History</h2>
        <p className="text-sm text-zinc-500">Click any session to view scores, analysis, and interview feedback.</p>
      </div>

      {/* Search + filters */}
      {!loading && sessions.length > 0 && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-3 mb-5"
        >
          <div className="relative">
            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions…"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {filterChips.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors cursor-pointer ${
                  filter === c.id
                    ? c.activeColor
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-100 dark:bg-zinc-800/60 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3">
            <FileText size={20} strokeWidth={1.5} className="text-zinc-400" />
          </div>
          <p className="text-sm text-zinc-400">No sessions yet. Upload your first CV!</p>
        </div>
      )}

      {!loading && sessions.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-zinc-400 text-sm">
          No sessions match your search or filter.
        </div>
      )}

      <motion.div className="space-y-2" layout>
        <AnimatePresence initial={false}>
          {filtered.map((s) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50, transition: { duration: 0.2 } }}
              transition={{ duration: 0.28, ease: [0, 0, 0.2, 1] }}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center justify-between hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <button
                onClick={() => onSelect(s.id)}
                className="flex items-center gap-3 flex-1 text-left cursor-pointer min-w-0 px-4 py-3.5"
              >
                <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <FileText size={13} strokeWidth={1.5} className="text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{getSessionLabel(s)}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {new Date(s.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-2 shrink-0 pr-4">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${scoreClass(s.match_score)}`}>
                  {s.match_score != null ? `${s.match_score}%` : '—'}
                </span>

                {s.has_interview_questions && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(s.id) }}
                    aria-label="Practice interview"
                    title="Practice interview questions"
                    className="w-7 h-7 rounded-md flex items-center justify-center text-accent-500 hover:bg-accent-50 dark:hover:bg-accent-950/50 transition-all cursor-pointer"
                  >
                    <Mic size={13} strokeWidth={1.5} />
                  </button>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); setPendingDelete(s) }}
                  aria-label="Delete session"
                  className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>

                <ChevronRight size={14} strokeWidth={1.5} className="text-zinc-300 dark:text-zinc-600" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <Modal
        open={pendingDelete !== null}
        onClose={() => !deleting && setPendingDelete(null)}
        title="Delete this session?"
        description={`This will permanently delete "${pendingDelete ? getSessionLabel(pendingDelete) : ''}" and all its interview answers. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </motion.div>
  )
}
