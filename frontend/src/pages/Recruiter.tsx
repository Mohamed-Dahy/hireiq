import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Star, Pencil, Trash2, Copy, Check,
  ChevronRight, ChevronDown, Loader2, Download,
  UserPlus, Users, ArrowUpDown, ArrowUp, ArrowDown,
  UploadCloud, X, CheckSquare, Square,
} from 'lucide-react'
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
import { useToast } from '../components/Toast'

// ── Types & constants ─────────────────────────────────────────────────────────

type Status = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
type SortKey = 'name' | 'position' | 'status' | 'date'
type SortDir = 'asc' | 'desc'

interface StageConfig {
  label: string
  textLight: string
  textDark: string
  bgLight: string
  bgDark: string
  borderLight: string
  borderDark: string
  dot: string
}

const STAGES: Record<Status, StageConfig> = {
  new:       { label: 'New',       textLight: 'text-zinc-600',    textDark: 'dark:text-zinc-400',    bgLight: 'bg-zinc-50',      bgDark: 'dark:bg-zinc-800/60',     borderLight: 'border-zinc-200',    borderDark: 'dark:border-zinc-700',    dot: 'bg-zinc-400'    },
  screening: { label: 'Screening', textLight: 'text-primary-600', textDark: 'dark:text-primary-400', bgLight: 'bg-primary-50',   bgDark: 'dark:bg-primary-950/50',  borderLight: 'border-primary-200', borderDark: 'dark:border-primary-800', dot: 'bg-primary-500' },
  interview: { label: 'Interview', textLight: 'text-accent-700',  textDark: 'dark:text-accent-400',  bgLight: 'bg-accent-50',    bgDark: 'dark:bg-accent-950/50',   borderLight: 'border-accent-200',  borderDark: 'dark:border-accent-800',  dot: 'bg-accent-500'  },
  offer:     { label: 'Offer',     textLight: 'text-amber-700',   textDark: 'dark:text-amber-400',   bgLight: 'bg-amber-50',     bgDark: 'dark:bg-amber-950/50',    borderLight: 'border-amber-200',   borderDark: 'dark:border-amber-800',   dot: 'bg-amber-500'   },
  hired:     { label: 'Hired',     textLight: 'text-emerald-700', textDark: 'dark:text-emerald-400', bgLight: 'bg-emerald-50',   bgDark: 'dark:bg-emerald-950/50',  borderLight: 'border-emerald-200', borderDark: 'dark:border-emerald-800', dot: 'bg-emerald-500' },
  rejected:  { label: 'Rejected',  textLight: 'text-red-600',     textDark: 'dark:text-red-400',     bgLight: 'bg-red-50',       bgDark: 'dark:bg-red-950/50',      borderLight: 'border-red-200',     borderDark: 'dark:border-red-800',     dot: 'bg-red-400'     },
}
const STATUS_ORDER: Status[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+\d][\d\s\-().]{5,19}$/

function validateCandidateForm(f: {
  name: string; email: string; phone: string; position: string; cvFile: File | null
}) {
  const errs: Record<string, string> = {}
  if (!f.name.trim()) { errs.name = 'Full name is required' }
  else if (f.name.trim().length < 2) { errs.name = 'Name must be at least 2 characters' }
  else if (f.name.trim().length > 200) { errs.name = 'Name must be under 200 characters' }
  else if (!/[a-zA-Z]/.test(f.name)) { errs.name = 'Name must contain letters' }

  if (f.email && !EMAIL_RE.test(f.email.trim())) { errs.email = 'Enter a valid email address' }
  if (f.phone && !PHONE_RE.test(f.phone.trim())) { errs.phone = 'Enter a valid phone number (e.g. +1 555 0100)' }
  if (f.position.trim().length > 200) { errs.position = 'Position must be under 200 characters' }
  if (f.cvFile && f.cvFile.size > 10 * 1024 * 1024) { errs.cvFile = 'File must be under 10 MB' }
  return errs
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function stageBadgeClass(s: string) {
  const c = STAGES[s as Status] ?? STAGES.new
  return `${c.textLight} ${c.textDark} ${c.bgLight} ${c.bgDark} ${c.borderLight} ${c.borderDark}`
}

function StatusDropdown({ current, onChange }: { current: string; onChange: (s: Status) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const c = STAGES[current as Status] ?? STAGES.new
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border cursor-pointer ${stageBadgeClass(current)}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {c.label}
        <ChevronDown size={10} className="ml-0.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 left-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg min-w-32 py-1"
          >
            {STATUS_ORDER.map(s => {
              const sc = STAGES[s]
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 ${s === current ? 'font-semibold' : ''}`}
                >
                  <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                  <span className={`${sc.textLight} ${sc.textDark}`}>{sc.label}</span>
                  {s === current && <Check size={10} className="ml-auto text-zinc-400" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NotesCell({ notes, onSave }: { notes: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes ?? '')
  if (editing) {
    return (
      <textarea
        autoFocus
        className="w-full text-xs border border-primary-400 rounded px-1.5 py-1 resize-none focus:outline-none bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
        rows={2}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(draft); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
      />
    )
  }
  return (
    <button
      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 max-w-40 truncate"
      onClick={() => { setDraft(notes ?? ''); setEditing(true) }}
      title={notes ?? 'Add note…'}
    >
      <Pencil size={11} className="shrink-0" />
      <span className="truncate">{notes || <span className="italic text-zinc-400">Add note…</span>}</span>
    </button>
  )
}

function FieldInput({
  label, value, onChange, type = 'text', placeholder, error, required, maxLen, hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; error?: string
  required?: boolean; maxLen?: number; hint?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {maxLen && value.length > maxLen * 0.8 && (
          <span className={`text-xs ${value.length >= maxLen ? 'text-red-500' : 'text-zinc-400'}`}>
            {value.length}/{maxLen}
          </span>
        )}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLen}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 ${
          error ? 'border-red-400 dark:border-red-600' : 'border-zinc-300 dark:border-zinc-700'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
    </div>
  )
}

// ── Add / Edit Candidate Modal ─────────────────────────────────────────────────

interface CandidateFormState {
  name: string; email: string; phone: string; position: string; cvFile: File | null
}

function CandidateModal({
  title,
  initial,
  submitLabel,
  onClose,
  onSubmit,
  showCvUpload,
}: {
  title: string
  initial: CandidateFormState
  submitLabel: string
  onClose: () => void
  onSubmit: (data: CandidateFormState) => Promise<void>
  showCvUpload: boolean
}) {
  const [form, setForm] = useState<CandidateFormState>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [apiError, setApiError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (field: keyof CandidateFormState) => (v: string) => {
    setForm(p => ({ ...p, [field]: v }))
    if (errors[field]) setErrors(p => { const n = { ...p }; delete n[field]; return n })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateCandidateForm(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    setApiError('')
    try {
      await onSubmit(form)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setApiError(msg || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <FieldInput
            label="Full Name" value={form.name} onChange={set('name')}
            placeholder="e.g. Sarah Johnson" required maxLen={200}
            error={errors.name}
          />
          <div className="grid grid-cols-2 gap-3">
            <FieldInput
              label="Email" value={form.email} onChange={set('email')}
              type="email" placeholder="sarah@example.com"
              error={errors.email}
              hint="Optional — used for contact"
            />
            <FieldInput
              label="Phone" value={form.phone} onChange={set('phone')}
              type="tel" placeholder="+1 555 0100"
              error={errors.phone}
            />
          </div>
          <FieldInput
            label="Applied Position" value={form.position} onChange={set('position')}
            placeholder="e.g. Senior Frontend Engineer" maxLen={200}
            error={errors.position}
          />

          {showCvUpload && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                CV / Resume <span className="text-zinc-400 text-xs font-normal">(PDF, DOC, DOCX — max 10 MB)</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  errors.cvFile
                    ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-primary-400 dark:hover:border-primary-600'
                }`}
              >
                {form.cvFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-primary-600 dark:text-primary-400">
                    <UploadCloud size={16} />
                    <span className="truncate max-w-52">{form.cvFile.name}</span>
                    <span className="text-zinc-400 text-xs">({(form.cvFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setForm(p => ({ ...p, cvFile: null })) }}
                      className="text-zinc-400 hover:text-red-500 ml-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400">
                    <UploadCloud size={22} className="mx-auto mb-1 text-zinc-300" />
                    Click to upload or drag &amp; drop
                  </div>
                )}
              </div>
              <input
                ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  setForm(p => ({ ...p, cvFile: f }))
                  if (f && errors.cvFile) setErrors(p => { const n = { ...p }; delete n.cvFile; return n })
                }}
              />
              {errors.cvFile && <p className="mt-1 text-xs text-red-500">{errors.cvFile}</p>}
            </div>
          )}

          {apiError && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <X size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{apiError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── New Pipeline Modal ────────────────────────────────────────────────────────

function NewPipelineModal({ onClose, onCreate }: {
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
    if (name.trim().length > 100) { setError('Name must be under 100 characters'); return }
    setSaving(true)
    setError('')
    try { await onCreate(name.trim(), jobTitle.trim()); onClose() }
    catch { setError('Failed to create pipeline — please try again') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">New Pipeline</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <FieldInput label="Pipeline Name" value={name} onChange={setName} placeholder="e.g. Q3 Engineering Hires" required maxLen={100} error={error} />
          <FieldInput label="Job Title" value={jobTitle} onChange={setJobTitle} placeholder="e.g. Senior Backend Engineer" hint="Optional — shown under pipeline name" />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Bulk stage picker ─────────────────────────────────────────────────────────

function BulkStagePicker({ onSelect }: { onSelect: (s: Status) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
      >
        Move to stage <ChevronDown size={12} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 left-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-36"
          >
            {STATUS_ORDER.map(s => {
              const sc = STAGES[s]
              return (
                <button key={s} onClick={() => { onSelect(s); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 ${sc.textLight} ${sc.textDark}`}
                >
                  <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                  {sc.label}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const NEXT_STAGE: Record<Status, Status | null> = {
  new: 'screening', screening: 'interview', interview: 'offer', offer: 'hired', hired: null, rejected: null,
}

export default function RecruiterPage() {
  const toast = useToast()

  const [lists, setLists] = useState<RecruiterList[]>([])
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [candidates, setCandidates] = useState<RecruiterCandidate[]>([])
  const [loadingLists, setLoadingLists] = useState(true)
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<RecruiterCandidate | null>(null)
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all')
  const [search, setSearch] = useState('')
  const [starredOnly, setStarredOnly] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const selectedList = lists.find(l => l.id === selectedListId) ?? null

  useEffect(() => {
    getRecruiterLists()
      .then(r => { setLists(r.data); if (r.data.length > 0) setSelectedListId(r.data[0].id) })
      .finally(() => setLoadingLists(false))
  }, [])

  useEffect(() => {
    if (selectedListId === null) { setCandidates([]); return }
    setLoadingCandidates(true)
    setSelected(new Set())
    getRecruiterCandidates(selectedListId)
      .then(r => setCandidates(r.data.candidates))
      .finally(() => setLoadingCandidates(false))
  }, [selectedListId])

  const refreshCandidates = () => {
    if (selectedListId === null) return
    getRecruiterCandidates(selectedListId).then(r => setCandidates(r.data.candidates))
  }

  // Stage counts for the overview cards
  const stageCounts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = candidates.filter(c => c.status === s).length
    return acc
  }, {})

  // Filter + sort
  const filtered = candidates
    .filter(c => {
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
    .sort((a, b) => {
      let v = 0
      if (sortKey === 'name')     v = a.display_name.localeCompare(b.display_name)
      if (sortKey === 'position') v = (a.applied_position ?? '').localeCompare(b.applied_position ?? '')
      if (sortKey === 'status')   v = STATUS_ORDER.indexOf(a.status as Status) - STATUS_ORDER.indexOf(b.status as Status)
      if (sortKey === 'date')     v = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      return sortDir === 'asc' ? v : -v
    })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="text-zinc-400" />
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-primary-500" /> : <ArrowDown size={12} className="text-primary-500" />
  }

  // Candidate actions
  const handleAddCandidate = async (data: CandidateFormState) => {
    if (selectedListId === null) return
    await addRecruiterCandidate(selectedListId, {
      candidate_name: data.name,
      candidate_email: data.email || undefined,
      candidate_phone: data.phone || undefined,
      applied_position: data.position || undefined,
      cv_file: data.cvFile,
    })
    refreshCandidates()
    setLists(prev => prev.map(l => l.id === selectedListId ? { ...l, candidate_count: l.candidate_count + 1 } : l))
    toast.success('Candidate added successfully')
  }

  const handleEditCandidate = async (data: CandidateFormState) => {
    if (!editingCandidate || !selectedListId) return
    const r = await updateCandidate(selectedListId, editingCandidate.id, {
      candidate_name: data.name,
      candidate_email: data.email || null,
      candidate_phone: data.phone || null,
      applied_position: data.position || null,
    })
    setCandidates(prev => prev.map(c => c.id === editingCandidate.id ? r.data : c))
    toast.success('Candidate updated')
  }

  const handleRemoveCandidate = async (cid: number) => {
    if (selectedListId === null) return
    await removeRecruiterCandidate(selectedListId, cid)
    setCandidates(prev => prev.filter(c => c.id !== cid))
    setSelected(prev => { const n = new Set(prev); n.delete(cid); return n })
    setLists(prev => prev.map(l => l.id === selectedListId ? { ...l, candidate_count: Math.max(0, l.candidate_count - 1) } : l))
    toast.success('Candidate removed')
  }

  const handleUpdateCandidate = async (cid: number, patch: Parameters<typeof updateCandidate>[2]) => {
    if (selectedListId === null) return
    const r = await updateCandidate(selectedListId, cid, patch)
    setCandidates(prev => prev.map(c => c.id === cid ? r.data : c))
  }

  const handleAdvanceStage = async (c: RecruiterCandidate) => {
    const next = NEXT_STAGE[c.status as Status]
    if (!next) return
    await handleUpdateCandidate(c.id, { status: next })
    toast.info(`Moved to ${STAGES[next].label}`)
  }

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).then(() => toast.success('Email copied'))
  }

  // Bulk actions
  const allVisibleIds = filtered.map(c => c.id)
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(allVisibleIds))
  }
  const toggleSelect = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleBulkDelete = async () => {
    if (!selectedListId) return
    const ids = [...selected]
    if (!confirm(`Delete ${ids.length} candidate${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return
    await Promise.all(ids.map(id => removeRecruiterCandidate(selectedListId, id)))
    setCandidates(prev => prev.filter(c => !selected.has(c.id)))
    setLists(prev => prev.map(l => l.id === selectedListId ? { ...l, candidate_count: Math.max(0, l.candidate_count - ids.length) } : l))
    setSelected(new Set())
    toast.success(`Deleted ${ids.length} candidate${ids.length > 1 ? 's' : ''}`)
  }

  const handleBulkStage = async (s: Status) => {
    if (!selectedListId) return
    const ids = [...selected]
    await Promise.all(ids.map(id => updateCandidate(selectedListId, id, { status: s })))
    refreshCandidates()
    setSelected(new Set())
    toast.success(`Moved ${ids.length} candidate${ids.length > 1 ? 's' : ''} to ${STAGES[s].label}`)
  }

  // Pipeline management
  const handleCreatePipeline = async (name: string, jobTitle: string) => {
    const r = await createRecruiterList(name, jobTitle || undefined)
    setLists(prev => [r.data, ...prev])
    setSelectedListId(r.data.id)
    setCandidates([])
  }

  const handleDeletePipeline = async () => {
    if (!selectedListId || !selectedList) return
    if (!confirm(`Delete pipeline "${selectedList.name}" and all its candidates? This cannot be undone.`)) return
    await deleteRecruiterList(selectedListId)
    const remaining = lists.filter(l => l.id !== selectedListId)
    setLists(remaining)
    setSelectedListId(remaining[0]?.id ?? null)
    setCandidates([])
    toast.success('Pipeline deleted')
  }

  const handleExport = async () => {
    if (!selectedListId) return
    setExporting(true)
    try {
      const r = await exportRecruiterList(selectedListId)
      const blob = new Blob([r.data as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `pipeline_${selectedListId}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Report exported')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingLists) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400">
        <Loader2 size={24} className="animate-spin mr-2 text-primary-500" />
        Loading…
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-7xl mx-auto px-4 py-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Recruiter Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage hiring pipelines and candidates</p>
        </div>
        <button
          onClick={() => setShowNewPipelineModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 shadow-sm transition-colors"
        >
          <Plus size={15} />
          New Pipeline
        </button>
      </div>

      {lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-primary-50 dark:bg-primary-950/30 rounded-full flex items-center justify-center mb-4">
            <Users size={28} className="text-primary-500" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">No pipelines yet</h2>
          <p className="text-sm text-zinc-400 mb-5">Create your first hiring pipeline to start managing candidates.</p>
          <button
            onClick={() => setShowNewPipelineModal(true)}
            className="px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Pipeline
          </button>
        </div>
      ) : (
        <>
          {/* Pipeline selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-500 shrink-0">Pipeline:</span>
            <div className="flex gap-2 flex-wrap flex-1">
              {lists.map(l => (
                <button
                  key={l.id}
                  onClick={() => { setSelectedListId(l.id); setSelected(new Set()) }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    l.id === selectedListId
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
                >
                  {l.name}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${l.id === selectedListId ? 'bg-primary-500 text-primary-100' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}>
                    {l.candidate_count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedList && (
            <>
              {/* Pipeline header */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">{selectedList.name}</h2>
                  {selectedList.job_title && (
                    <p className="text-sm text-zinc-500">{selectedList.job_title}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    disabled={exporting || candidates.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                  >
                    <Download size={14} />
                    {exporting ? 'Exporting…' : 'Export PDF'}
                  </button>
                  <button
                    onClick={handleDeletePipeline}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-500 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>

              {/* Stage overview cards */}
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {STATUS_ORDER.map(s => {
                  const cfg = STAGES[s]
                  const count = stageCounts[s] ?? 0
                  const active = filterStatus === s
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(active ? 'all' : s)}
                      className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        active
                          ? `${cfg.bgLight} ${cfg.bgDark} ${cfg.borderLight} ${cfg.borderDark} shadow-sm`
                          : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className={`text-2xl font-bold ${active ? `${cfg.textLight} ${cfg.textDark}` : 'text-zinc-800 dark:text-zinc-200'}`}>{count}</span>
                      <span className={`text-xs font-medium mt-0.5 ${active ? `${cfg.textLight} ${cfg.textDark}` : 'text-zinc-500'}`}>{cfg.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search name, email, position…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                  />
                </div>
                <button
                  onClick={() => setStarredOnly(v => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    starredOnly
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Star size={13} className={starredOnly ? 'fill-amber-500 text-amber-500' : ''} />
                  Starred
                </button>
                {(filterStatus !== 'all' || starredOnly || search) && (
                  <button
                    onClick={() => { setFilterStatus('all'); setStarredOnly(false); setSearch('') }}
                    className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline"
                  >
                    Clear
                  </button>
                )}
                <div className="ml-auto">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 shadow-sm transition-colors"
                  >
                    <UserPlus size={14} />
                    Add Candidate
                  </button>
                </div>
              </div>

              {/* Bulk action bar */}
              <AnimatePresence>
                {someSelected && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center gap-3 px-4 py-2.5 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 rounded-xl"
                  >
                    <span className="text-sm font-medium text-primary-700 dark:text-primary-400">
                      {selected.size} selected
                    </span>
                    <div className="h-4 w-px bg-primary-200 dark:bg-primary-800" />
                    <BulkStagePicker onSelect={handleBulkStage} />
                    <button
                      onClick={handleBulkDelete}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 size={12} />
                      Delete selected
                    </button>
                    <button
                      onClick={() => setSelected(new Set())}
                      className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline"
                    >
                      Clear selection
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Candidates table */}
              {loadingCandidates ? (
                <div className="flex items-center justify-center py-16 text-zinc-400">
                  <Loader2 size={20} className="animate-spin mr-2 text-primary-500" />
                  Loading candidates…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <Users size={32} className="text-zinc-300 dark:text-zinc-600 mb-3" strokeWidth={1.5} />
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                    {candidates.length === 0 ? 'No candidates yet' : 'No candidates match your filters'}
                  </p>
                  {candidates.length === 0 && (
                    <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline">
                      Add your first candidate →
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-xs text-zinc-500 uppercase tracking-wide">
                        {/* Checkbox */}
                        <th className="w-10 px-4 py-3">
                          <button onClick={toggleSelectAll} className="text-zinc-400 hover:text-primary-500 transition-colors">
                            {allSelected ? <CheckSquare size={15} className="text-primary-500" /> : <Square size={15} />}
                          </button>
                        </th>
                        {/* Star */}
                        <th className="w-8 px-2 py-3" />
                        {/* Sortable columns */}
                        <th className="px-4 py-3 text-left">
                          <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                            Candidate <SortIcon col="name" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <button onClick={() => handleSort('position')} className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                            Position <SortIcon col="position" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">Contact</th>
                        <th className="px-4 py-3 text-left">
                          <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                            Status <SortIcon col="status" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-left">Notes</th>
                        <th className="px-4 py-3 text-left">
                          <button onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                            Added <SortIcon col="date" />
                          </button>
                        </th>
                        <th className="px-4 py-3 text-center">CV</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                      {filtered.map(c => {
                        const isSelected = selected.has(c.id)
                        const next = NEXT_STAGE[c.status as Status]
                        return (
                          <tr
                            key={c.id}
                            className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${isSelected ? 'bg-primary-50/50 dark:bg-primary-950/20' : ''}`}
                          >
                            {/* Checkbox */}
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => toggleSelect(c.id)} className="text-zinc-400 hover:text-primary-500 transition-colors">
                                {isSelected ? <CheckSquare size={14} className="text-primary-500" /> : <Square size={14} />}
                              </button>
                            </td>
                            {/* Star */}
                            <td className="px-2 py-3 text-center">
                              <button
                                onClick={() => handleUpdateCandidate(c.id, { starred: !c.starred })}
                                title={c.starred ? 'Unstar' : 'Star'}
                              >
                                <Star
                                  size={15}
                                  className={c.starred ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 hover:text-amber-300 dark:text-zinc-600 dark:hover:text-amber-400 transition-colors'}
                                />
                              </button>
                            </td>
                            {/* Candidate name */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-bold shrink-0">
                                  {c.display_name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-32">{c.display_name}</span>
                              </div>
                            </td>
                            {/* Position */}
                            <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 truncate max-w-36 text-xs">
                              {c.applied_position ?? <span className="text-zinc-300 dark:text-zinc-600 italic">—</span>}
                            </td>
                            {/* Contact */}
                            <td className="px-4 py-3">
                              {c.candidate_email ? (
                                <button
                                  className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline text-xs truncate max-w-36"
                                  onClick={() => handleCopyEmail(c.candidate_email!)}
                                  title="Click to copy email"
                                >
                                  <Copy size={10} className="shrink-0" />
                                  {c.candidate_email}
                                </button>
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-600 italic text-xs">—</span>
                              )}
                              {c.candidate_phone && (
                                <span className="text-zinc-400 dark:text-zinc-500 text-xs block mt-0.5">{c.candidate_phone}</span>
                              )}
                            </td>
                            {/* Status */}
                            <td className="px-4 py-3">
                              <StatusDropdown
                                current={c.status}
                                onChange={s => handleUpdateCandidate(c.id, { status: s })}
                              />
                            </td>
                            {/* Notes */}
                            <td className="px-4 py-3 max-w-40">
                              <NotesCell
                                notes={c.notes}
                                onSave={v => handleUpdateCandidate(c.id, { notes: v || null })}
                              />
                            </td>
                            {/* Date */}
                            <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                              {new Date(c.created_at).toLocaleDateString()}
                            </td>
                            {/* CV */}
                            <td className="px-4 py-3 text-center">
                              {(c.cv_file_path || c.cv_filename) ? (
                                <span title={c.cv_filename ?? c.cv_file_path ?? ''} className="text-emerald-500">
                                  <Check size={14} className="mx-auto" />
                                </span>
                              ) : (
                                <span className="text-zinc-200 dark:text-zinc-700 text-xs">—</span>
                              )}
                            </td>
                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {/* Advance stage */}
                                {next && (
                                  <button
                                    onClick={() => handleAdvanceStage(c)}
                                    title={`Move to ${STAGES[next].label}`}
                                    className="p-1.5 rounded-md text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors"
                                  >
                                    <ChevronRight size={14} />
                                  </button>
                                )}
                                {/* Edit */}
                                <button
                                  onClick={() => setEditingCandidate(c)}
                                  title="Edit candidate"
                                  className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                  <Pencil size={13} />
                                </button>
                                {/* Remove */}
                                <button
                                  onClick={() => handleRemoveCandidate(c.id)}
                                  title="Remove candidate"
                                  className="p-1.5 rounded-md text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
                    <span>{filtered.length} candidate{filtered.length !== 1 ? 's' : ''}{filterStatus !== 'all' || starredOnly || search ? ' (filtered)' : ''}</span>
                    {someSelected && <span className="text-primary-500">{selected.size} selected</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Add Candidate Modal */}
      <AnimatePresence>
        {showAddModal && selectedListId && (
          <CandidateModal
            title="Add Candidate"
            initial={{ name: '', email: '', phone: '', position: '', cvFile: null }}
            submitLabel="Add Candidate"
            showCvUpload
            onClose={() => setShowAddModal(false)}
            onSubmit={handleAddCandidate}
          />
        )}
      </AnimatePresence>

      {/* Edit Candidate Modal */}
      <AnimatePresence>
        {editingCandidate && (
          <CandidateModal
            title="Edit Candidate"
            initial={{
              name: editingCandidate.candidate_name ?? editingCandidate.display_name,
              email: editingCandidate.candidate_email ?? '',
              phone: editingCandidate.candidate_phone ?? '',
              position: editingCandidate.applied_position ?? '',
              cvFile: null,
            }}
            submitLabel="Save Changes"
            showCvUpload={false}
            onClose={() => setEditingCandidate(null)}
            onSubmit={handleEditCandidate}
          />
        )}
      </AnimatePresence>

      {/* New Pipeline Modal */}
      <AnimatePresence>
        {showNewPipelineModal && (
          <NewPipelineModal
            onClose={() => setShowNewPipelineModal(false)}
            onCreate={handleCreatePipeline}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
