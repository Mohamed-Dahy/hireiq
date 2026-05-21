import { useEffect, useRef, useState } from 'react'
import type { RecruiterCandidate, RecruiterList } from '../api'
import {
  addRecruiterCandidate,
  createRecruiterList,
  deleteRecruiterList,
  exportRecruiterList,
  getRecruiterCandidates,
  getRecruiterLists,
  removeRecruiterCandidate,
  updateCandidate,
} from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'

interface StageConfig {
  label: string
  color: string
  bg: string
  border: string
  dot: string
}

const STAGES: Record<Status, StageConfig> = {
  new:        { label: 'New',        color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200', dot: 'bg-slate-400'  },
  screening:  { label: 'Screening',  color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200',  dot: 'bg-blue-500'   },
  interview:  { label: 'Interview',  color: 'text-violet-600', bg: 'bg-violet-50',  border: 'border-violet-200',dot: 'bg-violet-500' },
  offer:      { label: 'Offer',      color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200', dot: 'bg-amber-500'  },
  hired:      { label: 'Hired',      color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-200',dot:'bg-emerald-500' },
  rejected:   { label: 'Rejected',   color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-200',   dot: 'bg-red-400'    },
}

const STATUS_ORDER: Status[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected']

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusDropdown({
  current,
  onChange,
}: {
  current: string
  onChange: (s: Status) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const cfg = STAGES[current as Status] ?? STAGES.new
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer ${cfg.color} ${cfg.bg} ${cfg.border}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
        <svg className="w-3 h-3 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg min-w-32 py-1">
          {STATUS_ORDER.map((s) => {
            const c = STAGES[s]
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${s === current ? 'font-semibold' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className={c.color}>{c.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StarButton({ starred, onClick }: { starred: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={starred ? 'Unstar' : 'Star'} className="text-lg leading-none">
      {starred ? (
        <span className="text-amber-400">★</span>
      ) : (
        <span className="text-gray-300 hover:text-amber-300">★</span>
      )}
    </button>
  )
}

function NotesCell({ notes, onSave }: { notes: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes ?? '')
  if (editing) {
    return (
      <textarea
        autoFocus
        className="w-full text-xs border border-violet-400 rounded px-1.5 py-1 resize-none focus:outline-none"
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(draft); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }
  return (
    <button
      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 max-w-40 truncate"
      onClick={() => { setDraft(notes ?? ''); setEditing(true) }}
      title={notes ?? 'Add note…'}
    >
      <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
      </svg>
      <span className="truncate">{notes || <span className="italic text-gray-400">Add note…</span>}</span>
    </button>
  )
}

// ── Add Candidate Modal ───────────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void
  onAdd: (data: { candidate_name: string; candidate_email?: string; candidate_phone?: string; applied_position?: string; cv_file?: File | null }) => Promise<void>
}

function AddCandidateModal({ onClose, onAdd }: AddModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [position, setPosition] = useState('')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onAdd({
        candidate_name: name.trim(),
        candidate_email: email.trim() || undefined,
        candidate_phone: phone.trim() || undefined,
        applied_position: position.trim() || undefined,
        cv_file: cvFile,
      })
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Failed to add candidate')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Add Candidate</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Johnson"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 0100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Applied Position</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CV / Resume</label>
            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-violet-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {cvFile ? (
                <div className="flex items-center justify-center gap-2 text-sm text-violet-600">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate max-w-48">{cvFile.name}</span>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-red-500 ml-1"
                    onClick={(e) => { e.stopPropagation(); setCvFile(null) }}
                  >×</button>
                </div>
              ) : (
                <div className="text-sm text-gray-400">
                  <svg className="w-6 h-6 mx-auto mb-1 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  Click to upload PDF, DOC, or DOCX
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── New Pipeline Modal ────────────────────────────────────────────────────────

function NewPipelineModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string, jobTitle: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Pipeline name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onCreate(name.trim(), jobTitle.trim())
      onClose()
    } catch {
      setError('Failed to create pipeline')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Pipeline</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pipeline Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 Engineering Hires"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RecruiterPage() {
  const [lists, setLists] = useState<RecruiterList[]>([])
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<RecruiterCandidate[]>([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')
  const [search, setSearch] = useState('')
  const [starredOnly, setStarredOnly] = useState(false)
  const [exporting, setExporting] = useState(false)

  const selectedList = lists.find((l) => l.id === selectedListId) ?? null

  useEffect(() => {
    getRecruiterLists()
      .then((r) => {
        setLists(r.data)
        if (r.data.length > 0) setSelectedListId(r.data[0].id)
      })
      .finally(() => setLoadingLists(false))
  }, [])

  useEffect(() => {
    if (selectedListId === null) { setCandidates([]); return }
    setLoadingCandidates(true)
    getRecruiterCandidates(selectedListId)
      .then((r) => setCandidates(r.data.candidates))
      .finally(() => setLoadingCandidates(false))
  }, [selectedListId])

  const refreshCandidates = () => {
    if (selectedListId === null) return
    getRecruiterCandidates(selectedListId).then((r) => setCandidates(r.data.candidates))
  }

  const stageCounts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = candidates.filter((c) => c.status === s).length
    return acc
  }, {})

  const filtered = candidates.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (starredOnly && !c.starred) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        c.display_name.toLowerCase().includes(q) ||
        (c.candidate_email?.toLowerCase().includes(q) ?? false) ||
        (c.applied_position?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  const handleAddCandidate = async (data: Parameters<typeof addRecruiterCandidate>[1]) => {
    if (selectedListId === null) return
    await addRecruiterCandidate(selectedListId, data)
    refreshCandidates()
    setLists((prev) =>
      prev.map((l) => l.id === selectedListId ? { ...l, candidate_count: l.candidate_count + 1 } : l)
    )
  }

  const handleRemoveCandidate = async (cid: number) => {
    if (selectedListId === null) return
    await removeRecruiterCandidate(selectedListId, cid)
    setCandidates((prev) => prev.filter((c) => c.id !== cid))
    setLists((prev) =>
      prev.map((l) => l.id === selectedListId ? { ...l, candidate_count: Math.max(0, l.candidate_count - 1) } : l)
    )
  }

  const handleUpdateCandidate = async (cid: number, patch: Parameters<typeof updateCandidate>[2]) => {
    if (selectedListId === null) return
    const r = await updateCandidate(selectedListId, cid, patch)
    setCandidates((prev) => prev.map((c) => (c.id === cid ? r.data : c)))
  }

  const handleCreatePipeline = async (name: string, jobTitle: string) => {
    const r = await createRecruiterList(name, jobTitle || undefined)
    setLists((prev) => [r.data, ...prev])
    setSelectedListId(r.data.id)
    setCandidates([])
  }

  const handleDeletePipeline = async () => {
    if (!selectedListId || !selectedList) return
    if (!confirm(`Delete pipeline "${selectedList.name}"? This cannot be undone.`)) return
    await deleteRecruiterList(selectedListId)
    const remaining = lists.filter((l) => l.id !== selectedListId)
    setLists(remaining)
    setSelectedListId(remaining[0]?.id ?? null)
    setCandidates([])
  }

  const handleExport = async () => {
    if (!selectedListId) return
    setExporting(true)
    try {
      const r = await exportRecruiterList(selectedListId)
      const blob = new Blob([r.data as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pipeline_${selectedListId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingLists) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading…
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recruiter Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your hiring pipelines and candidates</p>
        </div>
        <button
          onClick={() => setShowNewPipelineModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Pipeline
        </button>
      </div>

      {lists.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No pipelines yet</h2>
          <p className="text-sm text-gray-400 mb-5">Create your first hiring pipeline to start managing candidates.</p>
          <button
            onClick={() => setShowNewPipelineModal(true)}
            className="px-5 py-2.5 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
          >
            Create Pipeline
          </button>
        </div>
      ) : (
        <>
          {/* Pipeline selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-500 shrink-0">Pipeline:</span>
            <div className="flex gap-2 flex-wrap flex-1">
              {lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelectedListId(l.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    l.id === selectedListId
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                  }`}
                >
                  {l.name}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${l.id === selectedListId ? 'bg-violet-500 text-violet-100' : 'bg-gray-100 text-gray-500'}`}>
                    {l.candidate_count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedList && (
            <>
              {/* Pipeline title + actions */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{selectedList.name}</h2>
                  {selectedList.job_title && (
                    <p className="text-sm text-gray-500">{selectedList.job_title}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    disabled={exporting || candidates.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    {exporting ? 'Exporting…' : 'Export PDF'}
                  </button>
                  <button
                    onClick={handleDeletePipeline}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Delete Pipeline
                  </button>
                </div>
              </div>

              {/* Stage overview cards */}
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {STATUS_ORDER.map((s) => {
                  const cfg = STAGES[s]
                  const count = stageCounts[s] ?? 0
                  const isActive = filterStatus === s
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(isActive ? 'all' : s)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isActive
                          ? `${cfg.bg} ${cfg.border} shadow-sm`
                          : 'bg-white border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <span className={`text-2xl font-bold ${isActive ? cfg.color : 'text-gray-800'}`}>{count}</span>
                      <span className={`text-xs font-medium mt-0.5 ${isActive ? cfg.color : 'text-gray-500'}`}>{cfg.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search name, email, position…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setStarredOnly((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    starredOnly ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  ★ Starred
                </button>
                {(filterStatus !== 'all' || starredOnly || search) && (
                  <button
                    onClick={() => { setFilterStatus('all'); setStarredOnly(false); setSearch('') }}
                    className="text-sm text-gray-400 hover:text-gray-600 underline"
                  >
                    Clear filters
                  </button>
                )}
                <div className="ml-auto">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 shadow-sm"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Candidate
                  </button>
                </div>
              </div>

              {/* Candidates table */}
              {loadingCandidates ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mr-2" />
                  Loading candidates…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">
                    {candidates.length === 0 ? 'No candidates yet' : 'No candidates match your filters'}
                  </p>
                  {candidates.length === 0 && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-3 text-sm text-violet-600 hover:underline"
                    >
                      Add your first candidate →
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="w-8 px-4 py-3" />
                        <th className="px-4 py-3 text-left">Candidate</th>
                        <th className="px-4 py-3 text-left">Position</th>
                        <th className="px-4 py-3 text-left">Contact</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Notes</th>
                        <th className="px-4 py-3 text-left">Added</th>
                        <th className="px-4 py-3 text-center">CV</th>
                        <th className="w-10 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          {/* Star */}
                          <td className="px-4 py-3 text-center">
                            <StarButton
                              starred={c.starred}
                              onClick={() => handleUpdateCandidate(c.id, { starred: !c.starred })}
                            />
                          </td>
                          {/* Name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold shrink-0">
                                {c.display_name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-800 truncate max-w-32">{c.display_name}</span>
                            </div>
                          </td>
                          {/* Position */}
                          <td className="px-4 py-3 text-gray-500 truncate max-w-36">
                            {c.applied_position ?? <span className="text-gray-300 italic">—</span>}
                          </td>
                          {/* Contact */}
                          <td className="px-4 py-3">
                            {c.candidate_email ? (
                              <a href={`mailto:${c.candidate_email}`} className="text-violet-600 hover:underline truncate block max-w-36 text-xs">
                                {c.candidate_email}
                              </a>
                            ) : (
                              <span className="text-gray-300 italic text-xs">—</span>
                            )}
                            {c.candidate_phone && (
                              <span className="text-gray-400 text-xs block">{c.candidate_phone}</span>
                            )}
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusDropdown
                              current={c.status}
                              onChange={(s) => handleUpdateCandidate(c.id, { status: s })}
                            />
                          </td>
                          {/* Notes */}
                          <td className="px-4 py-3 max-w-44">
                            <NotesCell
                              notes={c.notes}
                              onSave={(v) => handleUpdateCandidate(c.id, { notes: v || null })}
                            />
                          </td>
                          {/* Date */}
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          {/* CV indicator */}
                          <td className="px-4 py-3 text-center">
                            {(c.cv_file_path || c.cv_filename) ? (
                              <span title={c.cv_filename ?? c.cv_file_path ?? ''}>
                                <svg className="w-4 h-4 text-emerald-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                </svg>
                              </span>
                            ) : (
                              <svg className="w-4 h-4 text-gray-200 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </td>
                          {/* Remove */}
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleRemoveCandidate(c.id)}
                              className="text-gray-300 hover:text-red-400 transition-colors"
                              title="Remove candidate"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showAddModal && selectedListId && (
        <AddCandidateModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddCandidate}
        />
      )}

      {showNewPipelineModal && (
        <NewPipelineModal
          onClose={() => setShowNewPipelineModal(false)}
          onCreate={handleCreatePipeline}
        />
      )}
    </div>
  )
}
