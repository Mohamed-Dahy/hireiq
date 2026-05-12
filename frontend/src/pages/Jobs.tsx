import { useEffect, useState } from 'react'
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

export default function Jobs() {
  const [jobs, setJobs] = useState<JobApplication[]>([])
  const [stats, setStats] = useState<JobStatsResponse | null>(null)
  const [view, setView] = useState<ViewMode>('kanban')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedJob, setSelectedJob] = useState<JobApplication | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [jobsRes, statsRes] = await Promise.all([
        getJobs({ is_archived: false }),
        getJobStats(),
      ])
      setJobs(jobsRes.data)
      setStats(statsRes.data)
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

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase()
    const matchSearch = !q || j.company.toLowerCase().includes(q) || j.title.toLowerCase().includes(q)
    const matchStatus = !filterStatus || j.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
          {stats && (
            <p className="text-sm text-gray-400 mt-0.5">
              {stats.total_active} active · {stats.stale_count > 0 && <span className="text-amber-500">{stats.stale_count} stale</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Job
        </button>
      </div>

      {/* Stale / upcoming banners */}
      {stats && stats.stale_count > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 text-xs text-amber-700">
          <span>⚠</span>
          <span>{stats.stale_count} application{stats.stale_count !== 1 ? 's have' : ' has'} had no activity in 14+ days</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search company or title…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-purple-200"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
        >
          <option value="">All statuses</option>
          {KANBAN_COLS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>

        {/* View toggle */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          {(['kanban', 'list', 'stats'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors cursor-pointer ${
                view === v ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
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
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{col.label}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{colJobs.length}</span>
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
                        <div className="border-2 border-dashed border-gray-100 rounded-xl h-20 flex items-center justify-center text-xs text-gray-300">
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
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-sm text-gray-400">
                  No applications found.{' '}
                  <button onClick={() => setShowAdd(true)} className="text-purple-600 hover:underline cursor-pointer">Add one</button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium">
                      <th className="text-left px-4 py-3">Company</th>
                      <th className="text-left px-4 py-3">Title</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Score</th>
                      <th className="text-left px-4 py-3">Source</th>
                      <th className="text-left px-4 py-3">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(job => (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className="border-b border-gray-50 hover:bg-purple-50/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{job.company}</td>
                        <td className="px-4 py-3 text-gray-600">{job.title}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                            {job.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {job.match_score !== null ? `${Math.round((job.match_score ?? 0) * 100)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{job.source ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{job.deadline_date ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Stats view */}
          {view === 'stats' && stats && <JobStatsPanel stats={stats} />}

          {/* Empty state for kanban/list */}
          {view !== 'stats' && filtered.length === 0 && !loading && jobs.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-400 text-sm mb-4">Your job pipeline is empty.</p>
              <button
                onClick={() => setShowAdd(true)}
                className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 cursor-pointer transition-colors"
              >
                Add Your First Application
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals / drawers */}
      {showAdd && (
        <AddEditJobModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />
      )}
      {selectedJob && (
        <JobDetailDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
