import { BookOpen } from 'lucide-react'

interface GapItem {
  skill: string
  importance: 'high' | 'medium' | 'low' | string
  reason: string
  resource: string
}

interface Props {
  gaps: GapItem[]
}

const IMPORTANCE_CONFIG: Record<string, { bar: string; badge: string; label: string }> = {
  high:   { bar: 'bg-red-400',     badge: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',         label: 'High' },
  medium: { bar: 'bg-amber-400',   badge: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800', label: 'Medium' },
  low:    { bar: 'bg-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', label: 'Low' },
}

const BAR_WIDTH: Record<string, string> = {
  high:   'w-full',
  medium: 'w-2/3',
  low:    'w-1/3',
}

export default function SkillGapChart({ gaps }: Props) {
  if (!gaps.length) return null

  return (
    <div className="space-y-3">
      {gaps.map((gap, i) => {
        const cfg = IMPORTANCE_CONFIG[gap.importance] ?? IMPORTANCE_CONFIG.low
        const barW = BAR_WIDTH[gap.importance] ?? 'w-1/3'
        return (
          <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{gap.skill}</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                {cfg.label} priority
              </span>
            </div>

            <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${cfg.bar} ${barW}`} />
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">{gap.reason}</p>

            {gap.resource && (
              <p className="text-xs text-violet-500 font-medium flex items-center gap-1">
                <BookOpen size={11} strokeWidth={1.5} className="shrink-0" />
                {gap.resource}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
