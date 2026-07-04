import { useEffect, useState } from 'react'
import { Plus, Loader2, Search } from 'lucide-react'
import { getJobs, deleteJob, getJobStats } from '../api'
import type { JobApplication, JobStatsResponse } from '../api'
import JobCard from '../components/JobCard'
import JobDetailDrawer from '../components/JobDetailDrawer'
import AddEditJobModal from '../components/AddEditJobModal'
import JobStatsPanel from '../components/JobStatsPanel'

type ViewMode = 'kanban' | 'list' | 'stats'

const KANBAN_COLS = [
  { key: 'saved',        label: 'Saved' },
  { key: 'applied',      label: 'Applied' },
  { key: 'phone_screen', label: 'Phone Screen' },
  { key: 'technical',    label: 'Technical' },
  { key: 'final_round',  label: 'Final Round' },
  { key: 'offer',        label: 'Offer' },
]

interface Props {
  onNavigateToRoadmap?: (sessionId: number) => void
}

export default function Jobs({ onNavigateToRoadmap }: Props) {
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [stats, setStats] = useState<JobStatsResponse | null>(null)
  const [view, setView] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [selectedJob, setSelectedJob] = useState<JobApplication | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [jobsRes, statsRes] = await Promise.all([
        getJobs({ is_archived: false }),
        getJobStats(),
      ])
      // Never trust the shape blindly — a non-array here must not white-screen the app.
      setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : [])
      setStats(statsRes.data ?? null)
    } catch {
      setJobs([])
      setStats(null)
      setError('Could not load your job pipeline. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleArchive = async (id: number) => {
    await deleteJob(id)
    setJobs(prev => prev.filter(j => j.id !== id))
    if (selectedJob?.id === id) setSelectedJob(null)
  }

  const handleSaved = (job: JobApplication) => {
    setJobs(prev => {
      const idx = prev.findIndex(j => j.id === job.id)
      return idx >= 0 ? prev.map(j => j.id === job.id ? job : j) : [job, ...prev]
    })
    setShowAdd(false)
    getJobStats().then(r => setStats(r.data)).catch(() => {})
  }

  const handleUpdated = (job: JobApplication) => {
    setJobs(prev => prev.map(j => j.id === job.id ? job : j))
    setSelectedJob(job)
    getJobStats().then(r => setStats(r.data)).catch(() => {})
  }

  const filtered = (Array.isArray(jobs) ? jobs : []).filter(j => {
    const q = search.toLowerCase()
    const matchSearch = !q || j.company.toLowerCase().includes(q) || j.title.toLowerCase().includes(q)
    const matchStatus = !filterStatus || j.status === filterStatus
    const matchPriority = !filterPriority || j.priority === filterPriority
    return matchSearch && matchStatus && matchPriority
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Job Tracker</h1>
          {stats && (
            <p className="text-sm text-zinc-400 mt-0.5">
              {stats.total_active} active
              {stats.stale_count > 0 && <> · <span className="text-amber-500">{stats.stale_count} stale</span></>}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus size={15} strokeWidth={2} />
          Add Job
        </button>
      </div>

      {stats && stats.stale_count > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
          <span>⚠</span>
          <span>{stats.stale_count} application{stats.stale_count !== 1 ? 's have' : ' has'} had no activity in 14+ days</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search company or title…"
            className="w-full border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
        >
          <option value="">All stages</option>
          {KANBAN_COLS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          {(['kanban', 'list', 'stats'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors cursor-pointer ${
                view === v
                  ? 'bg-primary-600 text-white'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          <button onClick={load} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer shrink-0">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-primary-500" />
        </div>
      ) : (
        <>
          {/* Kanban view */}
          {view === 'kanban' && (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {KANBAN_COLS.map(col => {
                const colJobs = filtered.filter(j => j.status === col.key)
                return (
                  <div key={col.key} className="flex-shrink-0 w-64">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{col.label}</span>
                      <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full tabular-nums">{colJobs.length}</span>
                    </div>
                    <div className="space-y-2 min-h-16">
                      {colJobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onClick={() => setSelectedJob(job)}
                          onArchive={() => handleArchive(job.id)}
                        />
                      ))}
                      {colJobs.length === 0 && (
                        <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl h-20 flex items-center justify-center text-xs text-zinc-300 dark:text-zinc-700">
                          empty
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* List view */}
          {view === 'list' && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-sm text-zinc-400">
                  No applications found.{' '}
                  <button onClick={() => setShowAdd(true)} className="text-primary-500 hover:text-primary-400 cursor-pointer transition-colors">Add one</button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 font-medium uppercase tracking-widest">
                      <th className="text-left px-4 py-3">Company</th>
                      <th className="text-left px-4 py-3">Title</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Score</th>
                      <th className="text-left px-4 py-3">Priority</th>
                      <th className="text-left px-4 py-3">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(job => (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className="border-b border-zinc-50 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{job.company}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{job.title}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {job.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {job.match_score !== null ? `${Math.round((job.match_score ?? 0) * 100)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{job.priority ?? '—'}</td>
                        <td className="px-4 py-3 text-zinc-400">{job.deadline_date ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Stats view */}
          {view === 'stats' && stats && <JobStatsPanel stats={stats} />}

          {view !== 'stats' && filtered.length === 0 && !loading && jobs.length === 0 && (
            <div className="text-center py-20">
              <p className="text-zinc-400 text-sm mb-4">Your job pipeline is empty.</p>
              <button
                onClick={() => setShowAdd(true)}
                className="px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium cursor-pointer transition-colors"
              >
                Add Your First Application
              </button>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <AddEditJobModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />
      )}
      {selectedJob && (
        <JobDetailDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdated={handleUpdated}
          onNavigateToRoadmap={onNavigateToRoadmap}
        />
      )}
    </div>
  )
}
