import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import type {
  JobApplication, ActivityResponse, ContactResponse,
} from '../api'
import {
  getActivities, getContacts, logActivity, addContact,
  deleteContact, transitionStatus, analyzeJob,
} from '../api'
import ApplicationTimeline from './ApplicationTimeline'

const VALID_TRANSITIONS: Record<string, string[]> = {
  saved:        ['applied', 'withdrawn'],
  applied:      ['phone_screen', 'technical', 'final_round', 'offer', 'rejected', 'withdrawn'],
  phone_screen: ['technical', 'final_round', 'offer', 'rejected', 'withdrawn'],
  technical:    ['final_round', 'offer', 'rejected', 'withdrawn'],
  final_round:  ['offer', 'rejected', 'withdrawn'],
  offer:        ['accepted', 'rejected', 'withdrawn'],
}

interface Props {
  job: JobApplication
  onClose: () => void
  onUpdated: (job: JobApplication) => void
}

type Tab = 'overview' | 'activity' | 'contacts' | 'prep'

const inputCls = 'border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors'

export default function JobDetailDrawer({ job, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [activities, setActivities] = useState<ActivityResponse[]>([])
  const [contacts, setContacts] = useState<ContactResponse[]>([])
  const [prepQuestions, setPrepQuestions] = useState<{ question: string; model_answer: string }[]>([])
  const [analyzing, setAnalyzing] = useState(false)

  const [actType, setActType] = useState('email_sent')
  const [actNotes, setActNotes] = useState('')
  const [actSaving, setActSaving] = useState(false)

  const [ctName, setCtName] = useState('')
  const [ctRole, setCtRole] = useState('')
  const [ctEmail, setCtEmail] = useState('')
  const [ctSaving, setCtSaving] = useState(false)

  useEffect(() => {
    getActivities(job.id).then(r => setActivities(r.data)).catch(() => {})
    getContacts(job.id).then(r => setContacts(r.data)).catch(() => {})
    if (job.ai_prep_questions) {
      try { setPrepQuestions(JSON.parse(job.ai_prep_questions as unknown as string)) } catch { /* ignore */ }
    }
  }, [job.id])

  const logAct = async () => {
    if (!actType) return
    setActSaving(true)
    try {
      const res = await logActivity(job.id, { event_type: actType, notes: actNotes })
      setActivities(prev => [res.data, ...prev])
      setActNotes('')
    } finally {
      setActSaving(false)
    }
  }

  const addCt = async () => {
    if (!ctName.trim()) return
    setCtSaving(true)
    try {
      const res = await addContact(job.id, { name: ctName, role: ctRole, email: ctEmail })
      setContacts(prev => [...prev, res.data])
      setCtName(''); setCtRole(''); setCtEmail('')
    } finally {
      setCtSaving(false)
    }
  }

  const removeCt = async (contactId: number) => {
    await deleteContact(job.id, contactId)
    setContacts(prev => prev.filter(c => c.id !== contactId))
  }

  const advance = async (newStatus: string) => {
    try {
      const res = await transitionStatus(job.id, newStatus)
      onUpdated(res.data)
    } catch { /* ignore */ }
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await analyzeJob(job.id)
      onUpdated({ ...job, match_score: res.data.match_score, ai_gap_summary: res.data.ai_gap_summary })
    } finally {
      setAnalyzing(false)
    }
  }

  const transitions = VALID_TRANSITIONS[job.status] ?? []
  const scorePct = job.match_score !== null ? Math.round((job.match_score ?? 0) * 100) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-full flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-50 text-sm">{job.company}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{job.title}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer transition-colors mt-0.5">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          {(['overview', 'activity', 'contacts', 'prep'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors cursor-pointer ${
                tab === t
                  ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-500'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {tab === 'overview' && (
            <>
              {scorePct !== null && (
                <div className={`rounded-xl p-3 text-center border ${
                  scorePct >= 75
                    ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
                    : scorePct >= 60
                    ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                    : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                }`}>
                  <p className={`text-2xl font-semibold tabular-nums ${
                    scorePct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : scorePct >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
                  }`}>{scorePct}%</p>
                  <p className="text-xs text-zinc-500 mt-0.5">AI match score</p>
                </div>
              )}
              {job.ai_gap_summary && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Skill Gaps</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{job.ai_gap_summary}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                {job.location && <div><span className="font-medium text-zinc-700 dark:text-zinc-300">Location:</span> {job.location}</div>}
                {job.remote_type && <div><span className="font-medium text-zinc-700 dark:text-zinc-300">Type:</span> {job.remote_type}</div>}
                {job.source && <div><span className="font-medium text-zinc-700 dark:text-zinc-300">Source:</span> {job.source}</div>}
                {job.priority && <div><span className="font-medium text-zinc-700 dark:text-zinc-300">Priority:</span> {job.priority}</div>}
                {job.salary_min && <div><span className="font-medium text-zinc-700 dark:text-zinc-300">Salary:</span> {job.salary_min}–{job.salary_max}</div>}
                {job.deadline_date && <div><span className="font-medium text-zinc-700 dark:text-zinc-300">Deadline:</span> {job.deadline_date}</div>}
              </div>
              {job.notes && <p className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">{job.notes}</p>}
              {transitions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Advance to</p>
                  <div className="flex flex-wrap gap-2">
                    {transitions.map(s => (
                      <button
                        key={s}
                        onClick={() => advance(s)}
                        className="px-3 py-1 rounded-lg text-xs bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 cursor-pointer transition-colors"
                      >
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'activity' && (
            <>
              <div className="flex gap-2">
                <select
                  value={actType}
                  onChange={e => setActType(e.target.value)}
                  className={inputCls + ' flex-1'}
                >
                  {['email_sent','call_made','interview_scheduled','note_added','follow_up_sent'].map(t => (
                    <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                  ))}
                </select>
                <input
                  value={actNotes}
                  onChange={e => setActNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className={inputCls + ' flex-[2]'}
                />
                <button
                  onClick={logAct}
                  disabled={actSaving}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg disabled:opacity-50 cursor-pointer transition-colors flex items-center gap-1"
                >
                  {actSaving ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : 'Log'}
                </button>
              </div>
              <ApplicationTimeline activities={activities} />
            </>
          )}

          {tab === 'contacts' && (
            <>
              <div className="flex gap-2">
                <input value={ctName} onChange={e => setCtName(e.target.value)} placeholder="Name *" className={inputCls + ' flex-1'} />
                <input value={ctRole} onChange={e => setCtRole(e.target.value)} placeholder="Role" className={inputCls + ' flex-1'} />
                <input value={ctEmail} onChange={e => setCtEmail(e.target.value)} placeholder="Email" className={inputCls + ' flex-1'} />
                <button
                  onClick={addCt}
                  disabled={ctSaving}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg disabled:opacity-50 cursor-pointer transition-colors"
                >
                  Add
                </button>
              </div>
              {contacts.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-4">No contacts yet</p>
              ) : (
                <div className="space-y-2">
                  {contacts.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3">
                      <div>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                        <p className="text-xs text-zinc-400">{c.role} {c.email && `· ${c.email}`}</p>
                      </div>
                      <button
                        onClick={() => removeCt(c.id)}
                        className="text-xs text-zinc-300 dark:text-zinc-600 hover:text-red-400 cursor-pointer transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'prep' && (
            <>
              {job.ai_gap_summary && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Focus areas</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{job.ai_gap_summary}</p>
                </div>
              )}
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="w-full py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-medium hover:border-violet-400 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-400 disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                {analyzing
                  ? <><Loader2 size={12} strokeWidth={2} className="animate-spin" /> Analyzing…</>
                  : prepQuestions.length > 0 ? 'Regenerate Prep' : 'Generate Prep Questions'}
              </button>
              {prepQuestions.length > 0 ? (
                <div className="space-y-3">
                  {prepQuestions.map((q, i) => (
                    <details key={i} className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3">
                      <summary className="text-xs font-medium text-zinc-900 dark:text-zinc-100 cursor-pointer">{q.question}</summary>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">{q.model_answer}</p>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 text-center py-4">
                  {job.jd_text
                    ? 'Click "Generate Prep Questions" to get AI interview prep'
                    : 'Add a job description first to generate prep questions'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
