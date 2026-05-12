import { useEffect, useState } from 'react'
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

export default function JobDetailDrawer({ job, onClose, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [activities, setActivities] = useState<ActivityResponse[]>([])
  const [contacts, setContacts] = useState<ContactResponse[]>([])
  const [prepQuestions, setPrepQuestions] = useState<{ question: string; model_answer: string }[]>([])
  const [analyzing, setAnalyzing] = useState(false)

  // Activity form
  const [actType, setActType] = useState('email_sent')
  const [actNotes, setActNotes] = useState('')
  const [actSaving, setActSaving] = useState(false)

  // Contact form
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
        className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <p className="font-bold text-gray-900">{job.company}</p>
            <p className="text-sm text-gray-500">{job.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0">
          {(['overview', 'activity', 'contacts', 'prep'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors cursor-pointer ${
                tab === t ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-600'
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
                <div className={`rounded-xl p-3 text-center ${scorePct >= 75 ? 'bg-green-50 border border-green-200' : scorePct >= 60 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`text-2xl font-black ${scorePct >= 75 ? 'text-green-600' : scorePct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>{scorePct}%</p>
                  <p className="text-xs text-gray-500">AI match score</p>
                </div>
              )}
              {job.ai_gap_summary && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-amber-700 mb-1">Skill Gaps</p>
                  <p className="text-xs text-amber-600">{job.ai_gap_summary}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                {job.location && <div><span className="font-medium">Location:</span> {job.location}</div>}
                {job.remote_type && <div><span className="font-medium">Type:</span> {job.remote_type}</div>}
                {job.source && <div><span className="font-medium">Source:</span> {job.source}</div>}
                {job.priority && <div><span className="font-medium">Priority:</span> {job.priority}</div>}
                {job.salary_min && <div><span className="font-medium">Salary:</span> {job.salary_min}–{job.salary_max}</div>}
                {job.deadline_date && <div><span className="font-medium">Deadline:</span> {job.deadline_date}</div>}
              </div>
              {job.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{job.notes}</p>}
              {transitions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Advance to</p>
                  <div className="flex flex-wrap gap-2">
                    {transitions.map(s => (
                      <button
                        key={s}
                        onClick={() => advance(s)}
                        className="px-3 py-1 rounded-lg text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer transition-colors"
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
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1"
                >
                  {['email_sent','call_made','interview_scheduled','note_added','follow_up_sent'].map(t => (
                    <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                  ))}
                </select>
                <input
                  value={actNotes}
                  onChange={e => setActNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-[2]"
                />
                <button
                  onClick={logAct}
                  disabled={actSaving}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Log
                </button>
              </div>
              <ApplicationTimeline activities={activities} />
            </>
          )}

          {tab === 'contacts' && (
            <>
              <div className="flex gap-2">
                <input
                  value={ctName}
                  onChange={e => setCtName(e.target.value)}
                  placeholder="Name *"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1"
                />
                <input
                  value={ctRole}
                  onChange={e => setCtRole(e.target.value)}
                  placeholder="Role"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1"
                />
                <input
                  value={ctEmail}
                  onChange={e => setCtEmail(e.target.value)}
                  placeholder="Email"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1"
                />
                <button
                  onClick={addCt}
                  disabled={ctSaving}
                  className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg disabled:opacity-50 cursor-pointer"
                >
                  Add
                </button>
              </div>
              {contacts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No contacts yet</p>
              ) : (
                <div className="space-y-2">
                  {contacts.map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div>
                        <p className="text-xs font-medium text-gray-800">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.role} {c.email && `· ${c.email}`}</p>
                      </div>
                      <button
                        onClick={() => removeCt(c.id)}
                        className="text-xs text-gray-300 hover:text-red-400 cursor-pointer"
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
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-amber-700 mb-1">Focus areas</p>
                  <p className="text-xs text-amber-600">{job.ai_gap_summary}</p>
                </div>
              )}
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="w-full py-2 rounded-xl border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-50 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {analyzing ? 'Analyzing…' : prepQuestions.length > 0 ? 'Regenerate Prep' : 'Generate Prep Questions'}
              </button>
              {prepQuestions.length > 0 ? (
                <div className="space-y-3">
                  {prepQuestions.map((q, i) => (
                    <details key={i} className="bg-gray-50 rounded-xl p-3">
                      <summary className="text-xs font-medium text-gray-800 cursor-pointer">{q.question}</summary>
                      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{q.model_answer}</p>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">
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
