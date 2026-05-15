import { motion } from 'framer-motion'

interface ScoreBarProps {
  label: string
  value: number  // 0–10
}

function ScoreBar({ label, value }: ScoreBarProps) {
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
        <span>{label}</span>
        <span className="font-medium">{value}/10</span>
      </div>
      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 10}%` }}
          transition={{ duration: 0.7, ease: [0, 0, 0.2, 1] }}
          className="bg-primary-500 h-1.5 rounded-full"
        />
      </div>
    </div>
  )
}

interface Props {
  transcript: string
  clarity: number
  relevance: number
  depth: number
  eyeContact: number  // 0–100 %
}

export default function FeedbackPanel({ transcript, clarity, relevance, depth, eyeContact }: Props) {
  return (
    <div className="space-y-4 text-left">
      <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">Transcript</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{transcript || '—'}</p>
      </div>
      <ScoreBar label="Clarity" value={clarity} />
      <ScoreBar label="Relevance" value={relevance} />
      <ScoreBar label="Depth" value={depth} />
      {eyeContact >= 0 && (
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>Eye Contact</span>
          <span className="font-medium text-primary-500">{eyeContact}%</span>
        </div>
      )}
    </div>
  )
}
