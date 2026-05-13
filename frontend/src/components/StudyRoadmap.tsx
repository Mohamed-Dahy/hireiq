import { Clock } from 'lucide-react'

interface RoadmapItem {
  topic: string
  priority: 'high' | 'medium' | 'low' | string
  estimated_hours: number
  resources: string[]
}

interface Props {
  roadmap: RoadmapItem[]
}

const PRIORITY_COLOR: Record<string, string> = {
  high:   'border-violet-400 bg-violet-50 dark:bg-violet-950',
  medium: 'border-amber-300 bg-amber-50 dark:bg-amber-950',
  low:    'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800',
}

const NODE_COLOR: Record<string, string> = {
  high:   'bg-violet-500',
  medium: 'bg-amber-400',
  low:    'bg-zinc-400 dark:bg-zinc-600',
}

export default function StudyRoadmap({ roadmap }: Props) {
  if (!roadmap.length) return null

  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-zinc-200 dark:bg-zinc-700" />

      <div className="space-y-4">
        {roadmap.map((item, i) => {
          const dotClass = NODE_COLOR[item.priority] ?? 'bg-zinc-400 dark:bg-zinc-600'
          const cardClass = PRIORITY_COLOR[item.priority] ?? 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800'

          return (
            <div key={i} className="relative">
              <span className={`absolute -left-[18px] top-4 w-3 h-3 rounded-full ${dotClass} ring-2 ring-white dark:ring-zinc-950`} />

              <div className={`border rounded-xl p-4 space-y-2 ${cardClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.topic}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap flex items-center gap-1">
                    <Clock size={11} strokeWidth={1.5} />
                    ~{item.estimated_hours}h
                  </span>
                </div>

                {item.resources.length > 0 && (
                  <ul className="space-y-0.5">
                    {item.resources.map((r, j) => (
                      <li key={j} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-1.5">
                        <span className="mt-0.5 text-violet-400">›</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
