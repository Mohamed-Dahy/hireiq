interface Props {
  question: string
  index: number
}

export default function QuestionCard({ question, index }: Props) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 text-left bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors">
      <span className="text-xs font-medium text-primary-500 uppercase tracking-widest">
        Q{index + 1}
      </span>
      <p className="mt-1 text-zinc-900 dark:text-zinc-100 text-sm leading-relaxed">{question}</p>
    </div>
  )
}
