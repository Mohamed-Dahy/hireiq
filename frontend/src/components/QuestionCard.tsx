import { motion, useReducedMotion } from 'framer-motion'

interface Props {
  question: string
  index: number
}

export default function QuestionCard({ question, index }: Props) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      whileHover={reduced ? {} : { y: -2, boxShadow: '0 6px 20px rgba(124,58,237,0.1)' }}
      transition={{ duration: 0.18 }}
      className="border border-gray-200 rounded-xl p-4 text-left bg-white"
    >
      <span className="text-xs font-semibold text-purple-500 uppercase tracking-wide">
        Q{index + 1}
      </span>
      <p className="mt-1 text-gray-800 text-sm leading-relaxed">{question}</p>
    </motion.div>
  )
}
