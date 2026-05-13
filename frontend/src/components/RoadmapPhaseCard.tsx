import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Clock, Wrench, CheckCircle, ExternalLink } from 'lucide-react'
import type { RoadmapPhase } from '../api'

interface Props {
  phase: RoadmapPhase
  index: number
  defaultOpen?: boolean
}

const TYPE_COLORS: Record<string, string> = {
  course: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  book: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  video: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  project: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  tool: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
}

export default function RoadmapPhaseCard({ phase, index, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? index === 0)

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <span className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{phase.name}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400 shrink-0">
          <Clock size={12} strokeWidth={1.5} />
          ~{phase.estimated_weeks}w
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={16} strokeWidth={1.5} className="text-zinc-400" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              {phase.skills_covered.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {phase.skills_covered.map((s) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {phase.resources.length > 0 && (
                <div className="space-y-2">
                  {phase.resources.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-600 dark:text-violet-400 hover:underline truncate flex items-center gap-1"
                      >
                        {r.name}
                        <ExternalLink size={10} strokeWidth={2} />
                      </a>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_COLORS[r.type] ?? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        {r.type}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${r.is_free ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                        {r.is_free ? 'Free' : 'Paid'}
                      </span>
                      <span className="text-xs text-zinc-400 flex items-center gap-0.5 shrink-0">
                        <Clock size={10} strokeWidth={1.5} />
                        {r.estimated_hours}h
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                <Wrench size={14} strokeWidth={1.5} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <span className="font-medium">Build:</span> {phase.project_to_build}
                </p>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50">
                <CheckCircle size={14} strokeWidth={1.5} className="text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                <p className="text-xs text-violet-800 dark:text-violet-200">
                  <span className="font-medium">Milestone:</span> {phase.milestone}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
