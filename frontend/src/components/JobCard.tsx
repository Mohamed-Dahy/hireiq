import type { JobApplication, JobStatus } from '../api'

const STATUS_COLORS: Record<JobStatus, string> = {
  saved:        'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
  applied:      'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
  phone_screen: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  technical:    'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300',
  final_round:  'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300',
  offer:        'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  accepted:     'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200',
  rejected:     'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400',
  withdrawn:    'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500',
}

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-zinc-300 dark:bg-zinc-600',
}

function ScoreRing({ score }: { score: number | null }) {
  if (score === null) return (
    <div className="w-10 h-10 rounded-full border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs text-zinc-300 dark:text-zinc-600">—</div>
  )
  const pct = Math.round(score * 100)
  const color = pct >= 75
    ? 'text-emerald-600 dark:text-emerald-400 border-emerald-400'
    : pct >= 60
    ? 'text-amber-600 dark:text-amber-400 border-amber-400'
    : 'text-red-500 dark:text-red-400 border-red-400'
  return (
    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${color}`}>
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
      className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate">{job.company}</p>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{job.title}</p>
        </div>
        <ScoreRing score={job.match_score} />
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[job.status as JobStatus] ?? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
          {job.status.replace('_', ' ')}
        </span>
        {job.priority && (
          <span className="flex items-center gap-1 text-xs text-zinc-400">
            <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[job.priority] ?? 'bg-zinc-300 dark:bg-zinc-600'}`} />
            {job.priority}
          </span>
        )}
        {job.source && (
          <span className="text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{job.source}</span>
        )}
      </div>

      {(followupOverdue || job.ai_gap_summary) && (
        <div className="mt-2 flex flex-col gap-1">
          {followupOverdue && (
            <p className="text-xs text-red-500 dark:text-red-400 font-medium">Follow-up overdue: {job.followup_date}</p>
          )}
          {job.ai_gap_summary && (
            <p className="text-xs text-amber-600 dark:text-amber-400 truncate">⚠ Gaps: {job.ai_gap_summary}</p>
          )}
        </div>
      )}

      {onArchive && (
        <button
          onClick={e => { e.stopPropagation(); onArchive() }}
          className="mt-3 text-xs text-zinc-300 dark:text-zinc-600 hover:text-red-400 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          Archive
        </button>
      )}
    </div>
  )
}
