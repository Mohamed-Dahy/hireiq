import { motion } from 'framer-motion'
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2, Loader2, ShieldCheck,
  ListChecks, ThumbsUp,
} from 'lucide-react'
import type { AtsResult, AtsIssue, AtsCategory } from '../api'

interface Props {
  result: AtsResult | null
  loading: boolean
}

function scoreColor(score: number) {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function scoreTier(score: number) {
  if (score >= 80) return 'ATS-Ready'
  if (score >= 60) return 'Good — minor fixes'
  if (score >= 40) return 'Needs Work'
  return 'Likely to be rejected'
}

const SEVERITY_META: Record<AtsIssue['severity'], { icon: typeof AlertTriangle; cls: string; label: string }> = {
  high:   { icon: AlertTriangle, cls: 'text-red-500',   label: 'High' },
  medium: { icon: AlertCircle,   cls: 'text-amber-500', label: 'Medium' },
  low:    { icon: Info,          cls: 'text-zinc-400',  label: 'Low' },
}

function Gauge({ score }: { score: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const color = scoreColor(score)
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`ATS score ${Math.round(score)} out of 100`}>
      <circle cx="70" cy="70" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-zinc-100 dark:text-zinc-800" />
      <circle
        cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
      />
      <text x="70" y="70" textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="700" fill={color}>
        {Math.round(score)}
      </text>
    </svg>
  )
}

function CategoryBar({ cat }: { cat: AtsCategory }) {
  const pct = Math.round(cat.score * 100)
  const color = cat.score >= 0.8 ? 'bg-emerald-500' : cat.score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          {cat.label}
          {cat.confidence === 'best_effort' && (
            <span className="text-[9px] uppercase tracking-wide text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1 py-px" title="Heuristic check — may not be exact">
              best-effort
            </span>
          )}
        </span>
        <span className="text-xs text-zinc-400">{pct}%</span>
      </div>
      <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color} rounded-full origin-left`}
          initial={{ scaleX: 0 }} animate={{ scaleX: cat.score }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

export default function AtsResultView({ result, loading }: Props) {
  if (loading || !result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center" aria-busy="true">
        <Loader2 size={24} className="animate-spin text-primary-400" />
        <p className="text-sm text-zinc-400">Running ATS compatibility checks…</p>
      </div>
    )
  }

  const score = result.overall_score
  const color = scoreColor(score)

  return (
    <div className="space-y-6">
      {/* Score header */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="shrink-0">
          <Gauge score={score} />
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">ATS Score</p>
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border mb-2"
            style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
          >
            <ShieldCheck size={13} /> {scoreTier(score)}
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {result.score_explanation
              ? result.score_explanation
              : `How well an automated applicant tracking system can read and rank this CV.${
                  result.issues.length > 0
                    ? ` We found ${result.issues.length} issue${result.issues.length !== 1 ? 's' : ''} to address below.`
                    : ' No major issues found — nice work.'}`}
          </p>
          {!result.ai_sections_available && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              AI-assisted sections (keyword coverage) were unavailable — the structural score above is still complete.
            </p>
          )}
        </div>
      </div>

      {/* What to do next */}
      {result.next_steps && result.next_steps.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <ListChecks size={16} className="text-primary-500" /> What to do next
          </h3>
          <ol className="space-y-2">
            {result.next_steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Category breakdown */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Category breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {result.categories.map((c) => <CategoryBar key={c.key} cat={c} />)}
        </div>
      </div>

      {/* Strengths */}
      {result.strengths && result.strengths.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
            <ThumbsUp size={16} className="text-emerald-500" /> Strengths
          </h3>
          <ul className="space-y-2">
            {result.strengths.map((s) => (
              <li key={s.category} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>{s.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Keyword coverage (only when a job description was supplied) */}
      {result.keyword_coverage && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Keyword coverage vs. the job description</h3>
          {!result.keyword_coverage.available ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Keyword analysis is temporarily unavailable. Please try again shortly.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">Matched ({result.keyword_coverage.matched.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.keyword_coverage.matched.map((k) => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">{k}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">Missing ({result.keyword_coverage.missing.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.keyword_coverage.missing.map((k) => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">{k}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prioritized issues + recommendations */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Issues &amp; recommendations
        </h3>
        {result.issues.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={16} /> No issues detected — this CV is ATS-friendly.
          </div>
        ) : (
          <ul className="space-y-3">
            {result.issues.map((issue, i) => {
              const meta = SEVERITY_META[issue.severity]
              const Icon = meta.icon
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.18 }}
                  className="flex items-start gap-3 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800"
                >
                  <Icon size={16} className={`${meta.cls} shrink-0 mt-0.5`} />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-800 dark:text-zinc-200">{issue.message}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      <span className="font-medium text-zinc-600 dark:text-zinc-300">Fix:</span> {issue.recommendation}
                    </p>
                  </div>
                </motion.li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
