import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Check, Users } from 'lucide-react'
import type { ReferralStats } from '../api'

interface Props {
  referralUrl: string
  stats: ReferralStats
}

export default function ReferralCard({ referralUrl, stats }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = referralUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const progressPercent = stats.total_referred > 0
    ? Math.round((stats.total_converted / stats.total_referred) * 100)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Your Referral Link</h3>
        <div className="flex items-center gap-1.5 text-sm text-zinc-500">
          <Users size={14} strokeWidth={1.5} />
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{stats.total_converted}</span>
          <span className="text-zinc-400">{stats.total_converted === 1 ? 'friend joined' : 'friends joined'}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 font-mono truncate">
          {referralUrl}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
        >
          {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.5} />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        {stats.days_earned} days free earned
      </div>

      <div>
        <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
          <span>Progress toward next reward</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
            className="h-full bg-primary-500 rounded-full"
          />
        </div>
      </div>
    </motion.div>
  )
}
