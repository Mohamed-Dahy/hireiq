import { useState } from 'react'
import type { JobApplication, CreateJobPayload } from '../api'
import { createJob, updateJob } from '../api'

interface Props {
  job?: JobApplication
  onClose: () => void
  onSaved: (job: JobApplication) => void
}

const SOURCE_OPTIONS = ['linkedin', 'indeed', 'glassdoor', 'company', 'referral', 'cold_email', 'other']
const PRIORITY_OPTIONS = ['high', 'medium', 'low']
const REMOTE_OPTIONS = ['onsite', 'hybrid', 'remote']

export default function AddEditJobModal({ job, onClose, onSaved }: Props) {
  const [form, setForm] = useState<CreateJobPayload>({
    company:     job?.company ?? '',
    title:       job?.title ?? '',
    location:    job?.location ?? '',
    remote_type: job?.remote_type ?? '',
    job_url:     job?.job_url ?? '',
    jd_text:     '',
    source:      job?.source ?? '',
    priority:    job?.priority ?? 'medium',
    deadline_date: job?.deadline_date ?? '',
    followup_date: job?.followup_date ?? '',
    salary_min:  job?.salary_min ?? undefined,
    salary_max:  job?.salary_max ?? undefined,
    notes:       job?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof CreateJobPayload, v: string | number | undefined) =>
    setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company.trim() || !form.title.trim()) {
      setError('Company and title are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const clean: CreateJobPayload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== '' && v !== undefined && v !== null)
      ) as CreateJobPayload
      const res = job
        ? await updateJob(job.id, clean)
        : await createJob(clean)
      onSaved(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {job ? 'Edit Application' : 'Add Job Application'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Company *</label>
              <input
                value={form.company}
                onChange={e => set('company', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job Title *</label>
              <input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="Backend Engineer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <input
                value={form.location ?? ''}
                onChange={e => set('location', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="Cairo, Egypt"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Work Type</label>
              <select
                value={form.remote_type ?? ''}
                onChange={e => set('remote_type', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="">— select —</option>
                {REMOTE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
              <select
                value={form.source ?? ''}
                onChange={e => set('source', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                <option value="">— select —</option>
                {SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select
                value={form.priority ?? ''}
                onChange={e => set('priority', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                {PRIORITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Salary Min</label>
              <input
                type="number"
                value={form.salary_min ?? ''}
                onChange={e => set('salary_min', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="50000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Salary Max</label>
              <input
                type="number"
                value={form.salary_max ?? ''}
                onChange={e => set('salary_max', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                placeholder="80000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Deadline Date</label>
              <input
                type="date"
                value={form.deadline_date ?? ''}
                onChange={e => set('deadline_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up Date</label>
              <input
                type="date"
                value={form.followup_date ?? ''}
                onChange={e => set('followup_date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Job URL</label>
            <input
              value={form.job_url ?? ''}
              onChange={e => set('job_url', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              placeholder="https://..."
            />
          </div>

          {!job && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job Description</label>
              <textarea
                value={form.jd_text ?? ''}
                onChange={e => set('jd_text', e.target.value)}
                rows={4}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                placeholder="Paste the job description to get AI match score and prep questions…"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
              placeholder="Applied via referral…"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {saving ? 'Saving…' : job ? 'Update' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
