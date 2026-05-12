import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { JobStatsResponse } from '../api'

interface Props {
  stats: JobStatsResponse
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center">
      <p className="text-2xl font-extrabold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

const FUNNEL_STAGES = ['saved', 'applied', 'phone_screen', 'technical', 'final_round', 'offer', 'accepted']

export default function JobStatsPanel({ stats }: Props) {
  const pct = (v: number) => `${Math.round(v * 100)}%`

  const funnelData = FUNNEL_STAGES.map(s => ({
    stage: s.replace('_', ' '),
    count: stats.by_status[s] ?? 0,
  }))

  const sourceData = Object.entries(stats.by_source).map(([source, count]) => ({ source, count }))

  return (
    <div className="space-y-6">
      {/* Alert badges */}
      <div className="flex gap-3 flex-wrap">
        {stats.stale_count > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-medium">
            ⚠ {stats.stale_count} stale application{stats.stale_count !== 1 ? 's' : ''} — no activity in 14+ days
          </div>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Active Applications" value={String(stats.total_active)} />
        <MetricCard label="Response Rate" value={pct(stats.response_rate)} sub="applied → screened" />
        <MetricCard label="Interview Rate" value={pct(stats.interview_rate)} sub="applied → technical" />
        <MetricCard label="Offer Rate" value={pct(stats.offer_rate)} sub="applied → offer" />
      </div>

      {/* Funnel */}
      {funnelData.some(d => d.count > 0) && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-3">Application Funnel</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={funnelData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#9333ea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By source */}
      {sourceData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-3">Applications by Source</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={sourceData} layout="vertical" margin={{ top: 0, right: 8, left: 20, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis dataKey="source" type="category" tick={{ fontSize: 10 }} width={70} />
              <Tooltip />
              <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
