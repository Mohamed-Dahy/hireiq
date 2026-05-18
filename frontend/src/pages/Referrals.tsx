import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Share2, Users, TrendingUp, Gift, Trophy, Copy, Check } from 'lucide-react'
import ReferralCard from '../components/ReferralCard'
import { getMyReferralCode, getReferralStats, getLeaderboard } from '../api'
import type { ReferralCodeResponse, ReferralStats, LeaderboardEntry } from '../api'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.2, 1] as const } },
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-950/50 flex items-center justify-center text-primary-600 dark:text-primary-400">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">{value}</p>
        <p className="text-xs text-zinc-400">{label}</p>
      </div>
    </motion.div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />)}
      </div>
      <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
    </div>
  )
}

function QRCodeDisplay({ url }: { url: string }) {
  const [QRCode, setQRCode] = useState<React.ReactNode | null>(null)

  useEffect(() => {
    import('qrcode.react').then(mod => {
      setQRCode(<mod.QRCodeSVG value={url} size={120} level="M" />)
    }).catch(() => {})
  }, [url])

  if (!QRCode) return null

  return (
    <div className="flex justify-center">
      <div className="bg-white p-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
        {QRCode}
      </div>
    </div>
  )
}

export default function Referrals() {
  const reduced = useReducedMotion()
  const [loading, setLoading] = useState(true)
  const [codeData, setCodeData] = useState<ReferralCodeResponse | null>(null)
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [copied, setCopied] = useState(false)

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    Promise.all([
      getMyReferralCode(),
      getReferralStats(),
      getLeaderboard(),
    ])
      .then(([codeRes, statsRes, lbRes]) => {
        setCodeData(codeRes.data)
        setStats(statsRes.data)
        setLeaderboard(lbRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
        <LoadingSkeleton />
      </div>
    )
  }

  const shareLinks = codeData
    ? {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`Join me on HireIQ! ${codeData.referral_url}`)}`,
        linkedin: `https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(codeData.referral_url)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join me on HireIQ! ${codeData.referral_url}`)}`,
      }
    : null

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-6"
    >
      <div className="flex items-center gap-2 mb-2">
        <Gift size={20} strokeWidth={1.5} className="text-primary-500" />
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Referral Hub</h1>
      </div>

      {codeData && stats && (
        <ReferralCard referralUrl={codeData.referral_url} stats={stats} />
      )}

      <QRCodeDisplay url={codeData?.referral_url ?? ''} />

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        <StatCard label="Total Referred" value={String(stats?.total_referred ?? 0)} icon={<Users size={18} strokeWidth={1.5} />} />
        <StatCard label="Converted" value={String(stats?.total_converted ?? 0)} icon={<TrendingUp size={18} strokeWidth={1.5} />} />
        <StatCard label="Days Earned" value={String(stats?.days_earned ?? 0)} icon={<Gift size={18} strokeWidth={1.5} />} />
      </motion.div>

      {shareLinks && codeData && (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="flex items-center gap-2 mb-3">
            <Share2 size={14} strokeWidth={1.5} className="text-zinc-400" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Share</span>
          </div>
          <div className="flex items-center gap-2 mb-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2">
            <span className="flex-1 text-xs text-zinc-500 dark:text-zinc-400 truncate">{codeData.referral_url}</span>
            <button
              onClick={() => copyLink(codeData.referral_url)}
              className="shrink-0 flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500 cursor-pointer transition-colors font-medium"
            >
              {copied ? <><Check size={12} strokeWidth={2} /> Copied!</> : <><Copy size={12} strokeWidth={1.75} /> Copy</>}
            </button>
          </div>
          <div className="flex gap-2">
            <a
              href={shareLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
            >
              WhatsApp
            </a>
            <a
              href={shareLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              LinkedIn
            </a>
            <a
              href={shareLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-900 text-white text-sm font-medium transition-colors"
            >
              Twitter/X
            </a>
          </div>
        </motion.div>
      )}

      {leaderboard.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} strokeWidth={1.5} className="text-amber-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Leaderboard</span>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium uppercase tracking-widest">Rank</th>
                  <th className="text-left px-4 py-3 text-xs text-zinc-400 font-medium uppercase tracking-widest">User</th>
                  <th className="text-right px-4 py-3 text-xs text-zinc-400 font-medium uppercase tracking-widest">Referrals</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr key={entry.username} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3 text-zinc-500">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{entry.username}</td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">{entry.referral_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {(!leaderboard.length && stats && stats.total_referred === 0) && (
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="text-center py-12 text-zinc-400 text-sm"
        >
          <Users size={32} strokeWidth={1.5} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
          <p>No referrals yet. Share your link to get started!</p>
        </motion.div>
      )}
    </motion.div>
  )
}
