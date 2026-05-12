import type { JobApplication, JobStatus } from '../api'

const STATUS_COLORS: Record<JobStatus, string> = {
  saved:        'bg-gray-100 text-gray-600',
  applied:      'bg-blue-100 text-blue-700',
  phone_screen: 'bg-yellow-100 text-yellow-700',
  technical:    'bg-orange-100 text-orange-700',
  final_round:  'bg-purple-100 text-purple-700',
  offer:        'bg-green-100 text-green-700',
  accepted:     'bg-emerald-100 text-emerald-700',
  rejected:     'bg-red-100 text-red-600',
  withdrawn:    'bg-gray-100 text-gray-500',
}

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-gray-300',
}

function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return <div className="w-10 h-10 rounded-full border-2 border-gray-100 flex items-center justify-center text-xs text-gray-300">—</div>
  const pct = Math.round(score * 100)
  const color = pct >= 75 ? 'text-green-600 border-green-400' : pct >= 60 ? 'text-amber-600 border-amber-400' : 'text-red-500 border-red-400'
  return (
    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold ${color}`}>
      {pct}
    </div>
  )
}

interface Props {
  job: JobApplication
  onClick: () => void
  onArchive?: () => void
}

export default function JobCard({ job, onClick, onArchive }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const followupOverdue = job.followup_date && job.followup_date < today

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{job.company}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{job.title}</p>
        </div>
        <ScoreRing score={job.match_score} />
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status as JobStatus] ?? 'bg-gray-100 text-gray-500'}`}>
          {job.status.replace('_', ' ')}
        </span>
        {job.priority && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[job.priority] ?? 'bg-gray-300'}`} />
            {job.priority}
          </span>
        )}
        {job.source && (
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{job.source}</span>
        )}
      </div>

      {(followupOverdue || job.ai_gap_summary) && (
        <div className="mt-2 flex flex-col gap-1">
          {followupOverdue && (
            <p className="text-xs text-red-500 font-medium">Follow-up overdue: {job.followup_date}</p>
          )}
          {job.ai_gap_summary && (
            <p className="text-xs text-amber-600 truncate">⚠ Gaps: {job.ai_gap_summary}</p>
          )}
        </div>
      )}

      {onArchive && (
        <button
          onClick={e => { e.stopPropagation(); onArchive() }}
          className="mt-3 text-xs text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          Archive
        </button>
      )}
    </div>
  )
}
