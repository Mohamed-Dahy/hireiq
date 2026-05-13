import { useState } from 'react'
import type { RecruiterCandidate } from '../api'

interface Props {
  candidates: RecruiterCandidate[]
  onRemove: (candidateId: number) => void
  onRankUpdate: (candidateId: number, rank: number) => void
}

type SortKey = 'rank' | 'match_score' | 'cv_filename'

export default function CandidateCompare({ candidates, onRemove, onRankUpdate }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('match_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [editingRank, setEditingRank] = useState<number | null>(null)
  const [rankInput, setRankInput] = useState('')

  const sorted = [...candidates].sort((a, b) => {
    let av: number | string = 0
    let bv: number | string = 0
    if (sortKey === 'match_score') { av = a.match_score ?? -1; bv = b.match_score ?? -1 }
    else if (sortKey === 'rank')   { av = a.rank ?? 999;      bv = b.rank ?? 999 }
    else                            { av = a.cv_filename;      bv = b.cv_filename }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'match_score' ? 'desc' : 'asc') }
  }

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  const scoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    if (score >= 75) return 'text-green-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-red-500'
  }

  const scoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-100'
    if (score >= 75) return 'bg-green-50'
    if (score >= 50) return 'bg-amber-50'
    return 'bg-red-50'
  }

  const extractSkills = (inv: unknown): string[] => {
    if (!inv) return []
    if (Array.isArray(inv)) return (inv as string[]).slice(0, 4)
    if (typeof inv === 'object' && inv !== null) {
      const obj = inv as Record<string, unknown>
      const hard = obj['hard']
      if (Array.isArray(hard)) return (hard as string[]).slice(0, 4)
    }
    return []
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg font-medium">No candidates yet</p>
        <p className="text-sm mt-1">Add CV sessions to this list to compare candidates.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-violet-50 text-violet-800">
            <th
              className="px-4 py-3 text-left font-semibold cursor-pointer select-none border-b border-violet-200 w-16"
              onClick={() => toggle('rank')}
            >
              Rank{arrow('rank')}
            </th>
            <th
              className="px-4 py-3 text-left font-semibold cursor-pointer select-none border-b border-violet-200"
              onClick={() => toggle('cv_filename')}
            >
              CV File{arrow('cv_filename')}
            </th>
            <th
              className="px-4 py-3 text-center font-semibold cursor-pointer select-none border-b border-violet-200 w-24"
              onClick={() => toggle('match_score')}
            >
              Score{arrow('match_score')}
            </th>
            <th className="px-4 py-3 text-left font-semibold border-b border-violet-200">
              Top Skills
            </th>
            <th className="px-4 py-3 text-center font-semibold border-b border-violet-200 w-20">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, idx) => {
            const skills = extractSkills(c.skill_inventory)
            return (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                {/* Rank cell — click to edit */}
                <td className="px-4 py-3 text-center">
                  {editingRank === c.id ? (
                    <form
                      onSubmit={e => {
                        e.preventDefault()
                        const n = parseInt(rankInput)
                        if (!isNaN(n) && n > 0) onRankUpdate(c.id, n)
                        setEditingRank(null)
                      }}
                    >
                      <input
                        autoFocus
                        type="number"
                        min={1}
                        value={rankInput}
                        onChange={e => setRankInput(e.target.value)}
                        onBlur={() => setEditingRank(null)}
                        className="w-12 border border-violet-400 rounded px-1 py-0.5 text-center text-sm"
                      />
                    </form>
                  ) : (
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 text-violet-700 font-bold cursor-pointer hover:bg-violet-200"
                      title="Click to set manual rank"
                      onClick={() => { setEditingRank(c.id); setRankInput(String(c.rank ?? idx + 1)) }}
                    >
                      {c.rank ?? idx + 1}
                    </span>
                  )}
                </td>

                {/* CV filename */}
                <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate" title={c.cv_filename}>
                  {c.cv_filename}
                </td>

                {/* Match score */}
                <td className={`px-4 py-3 text-center ${scoreBg(c.match_score)}`}>
                  <span className={`font-bold text-base ${scoreColor(c.match_score)}`}>
                    {c.match_score !== null ? `${c.match_score.toFixed(1)}%` : '—'}
                  </span>
                </td>

                {/* Skills chips */}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {skills.length > 0 ? (
                      skills.map((skill, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700 font-medium"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-xs italic">No analysis</span>
                    )}
                  </div>
                </td>

                {/* Remove */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onRemove(c.id)}
                    className="text-red-400 hover:text-red-600 transition-colors text-lg font-bold"
                    title="Remove candidate"
                  >
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
