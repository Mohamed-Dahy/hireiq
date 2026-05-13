import { useState } from 'react'
import { Trash2 } from 'lucide-react'
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

  const scoreClass = (score: number | null) => {
    if (score === null) return 'text-zinc-400'
    if (score >= 75) return 'text-emerald-600 dark:text-emerald-400'
    if (score >= 50) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-500 dark:text-red-400'
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
      <div className="text-center py-16 text-zinc-500">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No candidates yet</p>
        <p className="text-sm mt-1 text-zinc-500">Add CV sessions to this list to compare candidates.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            <th
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest cursor-pointer select-none border-b border-zinc-200 dark:border-zinc-700 w-16"
              onClick={() => toggle('rank')}
            >
              Rank{arrow('rank')}
            </th>
            <th
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest cursor-pointer select-none border-b border-zinc-200 dark:border-zinc-700"
              onClick={() => toggle('cv_filename')}
            >
              CV File{arrow('cv_filename')}
            </th>
            <th
              className="px-4 py-3 text-center text-xs font-medium uppercase tracking-widest cursor-pointer select-none border-b border-zinc-200 dark:border-zinc-700 w-24"
              onClick={() => toggle('match_score')}
            >
              Score{arrow('match_score')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-700">
              Top Skills
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-700 w-20">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, idx) => {
            const skills = extractSkills(c.skill_inventory)
            return (
              <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
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
                        className="w-12 border border-violet-400 dark:border-violet-600 rounded px-1 py-0.5 text-center text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </form>
                  ) : (
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 text-xs font-medium cursor-pointer hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors"
                      title="Click to set manual rank"
                      onClick={() => { setEditingRank(c.id); setRankInput(String(c.rank ?? idx + 1)) }}
                    >
                      {c.rank ?? idx + 1}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate" title={c.cv_filename}>
                  {c.cv_filename}
                </td>

                <td className="px-4 py-3 text-center">
                  <span className={`font-semibold text-sm ${scoreClass(c.match_score)}`}>
                    {c.match_score !== null ? `${c.match_score.toFixed(1)}%` : '—'}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {skills.length > 0 ? (
                      skills.map((skill, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-xs bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-medium"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-zinc-400 text-xs italic">No analysis</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onRemove(c.id)}
                    className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                    title="Remove candidate"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
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
