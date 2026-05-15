import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Check, Zap, LayoutGrid, Star, Sparkles, Mic,
  Gift, ArrowRight, Users, Upload, Link,
  Globe, KeyRound, Loader2,
  FileText, X,
} from 'lucide-react'
import {
  getMe, updateProfile, uploadStoredCv, deleteStoredCv,
  sendChangeOtp, getReferralStats,
} from '../api'
import type { UserProfile, ReferralStats } from '../api'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0, 0, 0.2, 1] as const } },
}

interface Achievement {
  id: string
  label: string
  desc: string
  icon: React.ReactNode
  earned: boolean
}

function buildAchievements(p: UserProfile): Achievement[] {
  return [
    { id: 'first',    label: 'First Step',     desc: 'Uploaded your first CV',         earned: p.total_sessions >= 1,    icon: <Check size={16} strokeWidth={2} /> },
    { id: 'five',     label: 'On a Roll',      desc: 'Analyzed 5 CVs',                earned: p.total_sessions >= 5,    icon: <Zap size={16} strokeWidth={1.5} /> },
    { id: 'ten',      label: 'Power User',     desc: 'Analyzed 10 CVs',               earned: p.total_sessions >= 10,   icon: <LayoutGrid size={16} strokeWidth={1.5} /> },
    { id: 'good',     label: 'Solid Match',    desc: 'Hit 70%+ on a CV',              earned: (p.best_score ?? 0) >= 70, icon: <Star size={16} strokeWidth={1.5} /> },
    { id: 'great',    label: 'Top Tier',       desc: 'Hit 90%+ on a CV',              earned: (p.best_score ?? 0) >= 90, icon: <Sparkles size={16} strokeWidth={1.5} /> },
    { id: 'practice', label: 'Public Speaker', desc: 'Recorded 5 interview answers',  earned: p.total_interviews >= 5,  icon: <Mic size={16} strokeWidth={1.5} /> },
  ]
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-zinc-400 text-2xl font-semibold">—</span>
  const cls = score >= 70
    ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800'
    : score >= 40
    ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800'
    : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800'
  return <span className={`text-2xl font-semibold px-4 py-1 rounded-lg ${cls}`}>{score}%</span>
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <motion.div variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col gap-1">
      <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </motion.div>
  )
}

interface Props {
  onBack: () => void
  onLogout: () => void
}

export default function Profile({ onBack, onLogout }: Props) {
  const reduced = useReducedMotion()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Social links editing
  const [editLinks, setEditLinks] = useState(false)
  const [linkedinVal, setLinkedinVal] = useState('')
  const [githubVal, setGithubVal] = useState('')
  const [portfolioVal, setPortfolioVal] = useState('')
  const [linksSaving, setLinksSaving] = useState(false)
  const [linksMsg, setLinksMsg] = useState('')

  // Username editing
  const [editUsername, setEditUsername] = useState(false)
  const [usernameVal, setUsernameVal] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameMsg, setUsernameMsg] = useState('')

  // CV upload
  const cvInputRef = useRef<HTMLInputElement>(null)
  const [cvUploading, setCvUploading] = useState(false)
  const [cvMsg, setCvMsg] = useState('')

  useEffect(() => {
    Promise.all([
      getMe(),
      getReferralStats().catch(() => null),
    ])
      .then(([profileRes, statsRes]) => {
        const p = profileRes.data
        setProfile(p)
        setLinkedinVal(p.linkedin_url ?? '')
        setGithubVal(p.github_url ?? '')
        setPortfolioVal(p.portfolio_url ?? '')
        setUsernameVal(p.username)
        if (statsRes) setReferralStats(statsRes.data)
      })
      .catch(() => setError('Could not load profile'))
      .finally(() => setLoading(false))
  }, [])

  const initials = profile?.username ? profile.username.slice(0, 2).toUpperCase() : '??'
  const achievements = useMemo(() => (profile ? buildAchievements(profile) : []), [profile])
  const earnedCount = achievements.filter((a) => a.earned).length

  const saveLinks = async () => {
    setLinksSaving(true)
    setLinksMsg('')
    try {
      await updateProfile({
        linkedin_url: linkedinVal || undefined,
        github_url: githubVal || undefined,
        portfolio_url: portfolioVal || undefined,
      })
      setProfile((p) => p ? { ...p, linkedin_url: linkedinVal || null, github_url: githubVal || null, portfolio_url: portfolioVal || null } : p)
      setLinksMsg('Saved!')
      setEditLinks(false)
    } catch (e: any) {
      setLinksMsg(e.response?.data?.detail || 'Failed to save links')
    } finally {
      setLinksSaving(false)
    }
  }

  const saveUsername = async () => {
    if (!usernameVal.trim()) return
    setUsernameSaving(true)
    setUsernameMsg('')
    try {
      await updateProfile({ username: usernameVal.trim() })
      setProfile((p) => p ? { ...p, username: usernameVal.trim() } : p)
      setUsernameMsg('Username updated!')
      setEditUsername(false)
    } catch (e: any) {
      setUsernameMsg(e.response?.data?.detail || 'Failed to update username')
    } finally {
      setUsernameSaving(false)
    }
  }

  const handleCvUpload = async (file: File) => {
    setCvUploading(true)
    setCvMsg('')
    try {
      const res = await uploadStoredCv(file)
      setProfile((p) => p ? { ...p, has_stored_cv: true, stored_cv_filename: res.data.filename } : p)
      setCvMsg('CV stored successfully.')
    } catch (e: any) {
      setCvMsg(e.response?.data?.detail || 'Upload failed')
    } finally {
      setCvUploading(false)
    }
  }

  const handleCvDelete = async () => {
    setCvUploading(true)
    setCvMsg('')
    try {
      await deleteStoredCv()
      setProfile((p) => p ? { ...p, has_stored_cv: false, stored_cv_filename: null } : p)
      setCvMsg('CV removed.')
    } catch (e: any) {
      setCvMsg(e.response?.data?.detail || 'Failed to remove CV')
    } finally {
      setCvUploading(false)
    }
  }

  const handleChangePassword = async () => {
    try {
      await sendChangeOtp()
      navigate(`/verify-otp?purpose=password_change&email=${encodeURIComponent(profile?.email ?? '')}`)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to send code')
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center text-zinc-400 text-sm animate-pulse">
        Loading profile…
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center text-red-400 text-sm">
        {error || 'Profile not found.'}
      </div>
    )
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const quotaPercent = Math.min(100, Math.round((profile.analyses_in_window / 2) * 100))
  const windowResetsFormatted = profile.window_resets_at
    ? new Date(profile.window_resets_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-6"
    >
      {/* Back */}
      <button
        onClick={onBack}
        className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors cursor-pointer"
      >
        ← Back
      </button>

      {/* Hero card */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="show"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 flex flex-col items-center gap-4"
      >
        <motion.div
          initial={reduced ? {} : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          className="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center"
        >
          <span className="text-2xl font-semibold text-white">{initials}</span>
        </motion.div>

        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">@{profile.username}</h2>
          <p className="text-sm text-zinc-500 mt-0.5">{profile.email}</p>
          <p className="text-xs text-zinc-400 mt-1">Member since {memberSince}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
            profile.tier === 'paid'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-800'
          }`}>
            {profile.tier === 'paid' ? 'Paid' : 'Free'}
          </span>
          {profile.is_admin && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
              Admin
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 pt-1">
          <p className="text-xs text-zinc-400">Best CV match score</p>
          <ScoreBadge score={profile.best_score} />
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        initial="hidden" animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        <StatCard label="CVs Analyzed"  value={String(profile.total_sessions)} sub={profile.total_sessions === 1 ? 'session' : 'sessions'} />
        <StatCard label="Avg Score"      value={profile.avg_match_score != null ? `${profile.avg_match_score}%` : '—'} sub="match score" />
        <StatCard label="Interviews"     value={String(profile.total_interviews)} sub={profile.total_interviews === 1 ? 'answer' : 'answers'} />
      </motion.div>

      {/* AI Quota card (free tier only) */}
      {profile.tier === 'free' && (
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">AI Analysis Quota</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              profile.analyses_in_window >= 2
                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
            }`}>
              {profile.analyses_in_window} / 2 used
            </span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${profile.analyses_in_window >= 2 ? 'bg-red-500' : 'bg-primary-500'}`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400">
            {windowResetsFormatted ? `Resets on ${windowResetsFormatted}` : 'No analyses used yet in this period'}
          </p>
        </motion.div>
      )}

      {/* Stored CV card */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Stored CV</p>
        </div>
        <div className="p-5">
          {profile.has_stored_cv && profile.stored_cv_filename ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} strokeWidth={1.5} className="text-primary-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{profile.stored_cv_filename}</p>
                  <p className="text-xs text-zinc-400">Ready to use for analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => cvInputRef.current?.click()}
                  className="text-xs text-primary-500 hover:text-primary-600 font-medium cursor-pointer"
                >
                  Replace
                </button>
                <button
                  onClick={handleCvDelete}
                  disabled={cvUploading}
                  className="text-xs text-red-500 hover:text-red-600 font-medium cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => cvInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 transition-colors"
            >
              <Upload size={20} strokeWidth={1.5} className="mx-auto mb-2 text-zinc-400" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">Upload your CV</p>
              <p className="text-xs text-zinc-400 mt-0.5">PDF only · max 5MB</p>
            </div>
          )}
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleCvUpload(f)
              e.target.value = ''
            }}
          />
          {cvMsg && (
            <p className={`text-xs mt-2 ${cvMsg.toLowerCase().includes('fail') || cvMsg.toLowerCase().includes('error') ? 'text-red-500' : 'text-emerald-500'}`}>
              {cvMsg}
            </p>
          )}
        </div>
      </motion.div>

      {/* Social Links */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Social Links</p>
          {!editLinks && (
            <button onClick={() => setEditLinks(true)} className="text-xs text-primary-500 hover:text-primary-600 font-medium cursor-pointer">
              Edit
            </button>
          )}
        </div>
        <div className="p-5 space-y-3">
          {editLinks ? (
            <>
              {[
                { icon: <Link size={14} />, label: 'LinkedIn', val: linkedinVal, set: setLinkedinVal, placeholder: 'https://linkedin.com/in/yourname' },
                { icon: <Link size={14} />, label: 'GitHub',   val: githubVal,   set: setGithubVal,   placeholder: 'https://github.com/yourname' },
                { icon: <Globe size={14} />,    label: 'Portfolio', val: portfolioVal, set: setPortfolioVal, placeholder: 'https://yoursite.dev' },
              ].map(({ icon, label, val, set, placeholder }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-zinc-400 w-4 shrink-0">{icon}</span>
                  <input
                    type="url"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
              {linksMsg && (
                <p className={`text-xs ${linksMsg === 'Saved!' ? 'text-emerald-500' : 'text-red-500'}`}>{linksMsg}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveLinks}
                  disabled={linksSaving}
                  className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {linksSaving && <Loader2 size={13} className="animate-spin" />}
                  Save
                </button>
                <button onClick={() => { setEditLinks(false); setLinksMsg('') }} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {[
                { icon: <Link size={14} />,  label: 'LinkedIn',  href: profile.linkedin_url },
                { icon: <Link size={14} />,  label: 'GitHub',    href: profile.github_url },
                { icon: <Globe size={14} />, label: 'Portfolio', href: profile.portfolio_url },
              ].map(({ icon, label, href }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-zinc-400 w-4 shrink-0">{icon}</span>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:underline truncate">{href}</a>
                  ) : (
                    <span className="text-sm text-zinc-400 italic">Not set</span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </motion.div>

      {/* Account Settings */}
      <motion.div variants={fadeUp} initial="hidden" animate="show"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Account Settings</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Username */}
          <div>
            <p className="text-xs text-zinc-400 mb-1.5">Username</p>
            {editUsername ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={usernameVal}
                  onChange={(e) => setUsernameVal(e.target.value)}
                  className="flex-1 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={saveUsername}
                  disabled={usernameSaving}
                  className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                >
                  {usernameSaving && <Loader2 size={13} className="animate-spin" />}
                  Save
                </button>
                <button onClick={() => { setEditUsername(false); setUsernameMsg('') }} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">@{profile.username}</span>
                <button onClick={() => setEditUsername(true)} className="text-xs text-primary-500 hover:text-primary-600 font-medium cursor-pointer">
                  Edit
                </button>
              </div>
            )}
            {usernameMsg && (
              <p className={`text-xs mt-1 ${usernameMsg.includes('updated') ? 'text-emerald-500' : 'text-red-500'}`}>{usernameMsg}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div>
            <p className="text-xs text-zinc-400 mb-1.5">Email</p>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{profile.email}</p>
          </div>

          {/* Change Password */}
          <div className="pt-1">
            <button
              onClick={handleChangePassword}
              className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors cursor-pointer"
            >
              <KeyRound size={15} strokeWidth={1.5} />
              Change Password
            </button>
            <p className="text-xs text-zinc-400 mt-1">A verification code will be sent to your email</p>
          </div>
        </div>
      </motion.div>

      {/* Referral mini-card */}
      {referralStats && (
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <a
            href="/referrals"
            onClick={(e) => { e.preventDefault(); window.location.pathname = '/referrals' }}
            className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-primary-200 dark:hover:border-primary-800 transition-colors group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gift size={16} strokeWidth={1.5} className="text-primary-500" />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Referrals</span>
              </div>
              <ArrowRight size={14} strokeWidth={1.5} className="text-zinc-400 group-hover:text-primary-500 transition-colors" />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Users size={14} strokeWidth={1.5} />
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{referralStats.total_converted}</span>
                <span>converted</span>
              </div>
              <div className="text-zinc-400">·</div>
              <div className="text-zinc-500">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{referralStats.days_earned}</span>
                <span> days free earned</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-primary-500 font-medium">View Full Referral Hub →</div>
          </a>
        </motion.div>
      )}

      {/* Achievements */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Achievements</h3>
          <span className="text-xs text-zinc-400">{earnedCount} / {achievements.length} unlocked</span>
        </div>
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        >
          {achievements.map((a) => (
            <motion.div
              key={a.id}
              variants={fadeUp}
              className={`rounded-xl p-4 border text-center transition-all ${
                a.earned
                  ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
                  : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 opacity-50'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2 ${
                a.earned ? 'bg-primary-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'
              }`}>
                {a.icon}
              </div>
              <p className={`text-xs font-medium ${a.earned ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>{a.label}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">{a.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="pt-2">
        <button
          onClick={onLogout}
          className="w-full py-3 rounded-xl border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
        >
          Log out
        </button>
      </motion.div>
    </motion.div>
  )
}
