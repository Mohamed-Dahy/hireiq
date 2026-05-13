import { useEffect, useState } from 'react'
import {
  getRecruiterLists,
  createRecruiterList,
  deleteRecruiterList,
  getRecruiterCandidates,
  addRecruiterCandidate,
  removeRecruiterCandidate,
  updateCandidateRank,
  exportRecruiterList,
  getSessions,
  type RecruiterList,
  type RecruiterCandidateListResponse,
  type CVSession,
} from '../api'
import CandidateCompare from '../components/CandidateCompare'

export default function Recruiter() {
  const [lists, setLists] = useState<RecruiterList[]>([])
  const [selectedList, setSelectedList] = useState<RecruiterList | null>(null)
  const [candidateData, setCandidateData] = useState<RecruiterCandidateListResponse | null>(null)
  const [sessions, setSessions] = useState<CVSession[]>([])
  const [newListName, setNewListName] = useState('')
  const [newListTitle, setNewListTitle] = useState('')
  const [addSessionId, setAddSessionId] = useState('')
  const [creating, setCreating] = useState(false)
  const [addError, setAddError] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    Promise.all([getRecruiterLists(), getSessions()])
      .then(([listsRes, sessionsRes]) => {
        setLists(listsRes.data)
        setSessions(sessionsRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadCandidates = (list: RecruiterList) => {
    setSelectedList(list)
    setCandidateData(null)
    getRecruiterCandidates(list.id).then(r => setCandidateData(r.data))
  }

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim()) return
    setCreating(true)
    try {
      const res = await createRecruiterList(newListName.trim(), newListTitle.trim() || undefined)
      const newList = res.data
      setLists(prev => [newList, ...prev])
      setNewListName('')
      setNewListTitle('')
      loadCandidates(newList)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteList = async (listId: number) => {
    if (!window.confirm('Delete this list and all its candidates?')) return
    await deleteRecruiterList(listId)
    setLists(prev => prev.filter(l => l.id !== listId))
    if (selectedList?.id === listId) {
      setSelectedList(null)
      setCandidateData(null)
    }
  }

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedList || !addSessionId) return
    setAddError('')
    try {
      await addRecruiterCandidate(selectedList.id, parseInt(addSessionId))
      setAddSessionId('')
      loadCandidates(selectedList)
      setLists(prev =>
        prev.map(l => l.id === selectedList.id ? { ...l, candidate_count: l.candidate_count + 1 } : l)
      )
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string }; status?: number } }
      const msg = e?.response?.data?.detail || 'Failed to add candidate'
      const status = e?.response?.status
      if (status === 409) setAddError('This session is already in the list.')
      else if (status === 422) setAddError(msg)
      else setAddError(msg)
    }
  }

  const handleRemove = async (candidateId: number) => {
    if (!selectedList) return
    await removeRecruiterCandidate(selectedList.id, candidateId)
    setCandidateData(prev =>
      prev ? { ...prev, candidates: prev.candidates.filter(c => c.id !== candidateId) } : prev
    )
    setLists(prev =>
      prev.map(l => l.id === selectedList.id ? { ...l, candidate_count: Math.max(0, l.candidate_count - 1) } : l)
    )
  }

  const handleRankUpdate = async (candidateId: number, rank: number) => {
    if (!selectedList) return
    await updateCandidateRank(selectedList.id, candidateId, rank)
    setCandidateData(prev =>
      prev
        ? { ...prev, candidates: prev.candidates.map(c => c.id === candidateId ? { ...c, rank } : c) }
        : prev
    )
  }

  const handleExport = async () => {
    if (!selectedList) return
    setExporting(true)
    try {
      const res = await exportRecruiterList(selectedList.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `recruiter_list_${selectedList.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const availableSessions = sessions.filter(s =>
    !candidateData?.candidates.some(c => c.session_id === s.id) &&
    s.match_score !== null
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar — list manager */}
      <aside className="w-72 border-r border-gray-200 flex flex-col bg-gray-50 shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Candidate Lists</h2>
          <form onSubmit={handleCreateList} className="space-y-2">
            <input
              type="text"
              placeholder="List name *"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <input
              type="text"
              placeholder="Position / job title"
              value={newListTitle}
              onChange={e => setNewListTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              type="submit"
              disabled={creating || !newListName.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-md py-1.5 text-sm font-medium transition-colors"
            >
              {creating ? 'Creating…' : '+ New List'}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto">
          {lists.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 italic">No lists yet — create one above.</p>
          ) : (
            lists.map(list => (
              <div
                key={list.id}
                onClick={() => loadCandidates(list)}
                className={`flex items-center justify-between p-3 cursor-pointer border-b border-gray-100 hover:bg-white transition-colors ${
                  selectedList?.id === list.id ? 'bg-white border-l-4 border-l-violet-600' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{list.name}</p>
                  {list.job_title && (
                    <p className="text-xs text-gray-500 truncate">{list.job_title}</p>
                  )}
                  <p className="text-xs text-violet-600">{list.candidate_count} candidate{list.candidate_count !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDeleteList(list.id) }}
                  className="text-gray-400 hover:text-red-500 transition-colors ml-2 text-sm"
                  title="Delete list"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {!selectedList ? (
          <div className="flex items-center justify-center h-full text-center text-gray-400">
            <div>
              <p className="text-4xl mb-3">📋</p>
              <p className="text-lg font-medium">Select a list to view candidates</p>
              <p className="text-sm mt-1">or create a new list in the sidebar</p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedList.name}</h1>
                {selectedList.job_title && (
                  <p className="text-gray-500 mt-0.5">{selectedList.job_title}</p>
                )}
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-md px-4 py-2 text-sm font-medium transition-colors"
              >
                {exporting ? 'Generating…' : '⬇ Export PDF'}
              </button>
            </div>

            {/* Add candidate */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2 text-sm">Add Candidate</h3>
              <form onSubmit={handleAddCandidate} className="flex gap-2">
                <select
                  value={addSessionId}
                  onChange={e => { setAddSessionId(e.target.value); setAddError('') }}
                  className="flex-1 border border-blue-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Select a CV session…</option>
                  {availableSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.cv_filename} — {s.match_score !== null ? `${s.match_score.toFixed(1)}%` : 'No score'}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!addSessionId}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </form>
              {addError && <p className="text-red-600 text-xs mt-1">{addError}</p>}
              {availableSessions.length === 0 && sessions.some(s => s.match_score !== null) && (
                <p className="text-blue-600 text-xs mt-1">All scored sessions are already in this list.</p>
              )}
              {sessions.every(s => s.match_score === null) && sessions.length > 0 && (
                <p className="text-amber-600 text-xs mt-1">
                  No sessions have a match score yet. Upload a CV and run analysis first.
                </p>
              )}
            </div>

            {/* Candidate table */}
            {candidateData === null ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" />
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <CandidateCompare
                  candidates={candidateData.candidates}
                  onRemove={handleRemove}
                  onRankUpdate={handleRankUpdate}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
