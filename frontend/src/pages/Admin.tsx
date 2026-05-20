/**
 * Admin.tsx — standalone admin console.
 * Manages its own auth via sessionStorage (never localStorage).
 * Accessible only at /admin — rendered before any user-app logic in App.tsx.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import {
  LayoutDashboard, Users, BookOpen, Activity, LogOut, Loader2, AlertCircle,
  Trash2, Unlock, ShieldCheck, ChevronDown, ChevronUp, RefreshCw,
  DollarSign, Search, Filter, UserSearch,
} from 'lucide-react'
import {
  adminLogin, getAdminMetrics, getAdminUsers, setUserTier, unlockUser,
  verifyUserEmail, adminDeleteUser, getAdminQuestions, adminDeleteQuestion,
  getAdminHealth, getAdminUserUsage, getAdminTokenSummary, getAdminUserBreakdown,
} from '../api'
import type {
  AdminMetrics, AdminUserItem, AdminQuestion, AdminHealthResponse,
  AdminUserUsage, AdminUserFilters, AdminTokenSummary, AdminTokenUserRow,
} from '../api'

// ── helpers ───────────────────────────────────────────────────────────────────

const TIERS = ['free', 'pro', 'enterprise'] as const
const PIE_COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#8b5cf6']

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

function relativeDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

// ── shared ────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`border rounded-xl p-4 ${accent ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-200 dark:border-primary-800' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? 'text-primary-700 dark:text-primary-300' : 'text-zinc-900 dark:text-zinc-50'}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ServiceDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
  )
}

// ── Login ──────────────────────────────────────────────────────────────────────

function AdminLoginForm({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await adminLogin(email, password)
      onSuccess(data.access_token)
    } catch {
      setError('Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-50">Admin Console</h1>
          <p className="text-sm text-zinc-500 mt-1">HireIQ Platform Management</p>
        </div>
        <form onSubmit={submit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">Admin Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-primary-500 transition-colors"
              placeholder="admin@hireiq.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 block mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-primary-500 transition-colors"
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            {loading ? <Loader2 size={15} className="animate-spin" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Overview / Metrics ────────────────────────────────────────────────────────

type FullMetrics = AdminMetrics & {
  billing: { mrr_estimate_usd: number; pro_users: number; enterprise_users: number }
  dau: number
}

function MetricsSection() {
  const [metrics, setMetrics] = useState<FullMetrics | null>(null)
  const [tokenSummary, setTokenSummary] = useState<AdminTokenSummary | null>(null)
  const [tokenUsers, setTokenUsers] = useState<AdminTokenUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [metricsRes, tokenRes, tokenUsersRes] = await Promise.all([
        getAdminMetrics(),
        getAdminTokenSummary().catch(() => null),
        getAdminUserBreakdown(undefined, 10).catch(() => null),
      ])
      setMetrics(metricsRes.data as FullMetrics)
      if (tokenRes) setTokenSummary(tokenRes.data)
      if (tokenUsersRes) setTokenUsers(tokenUsersRes.data.users)
    }
    catch { setError('Failed to load metrics.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (error || !metrics) return <ErrorMsg msg={error} />

  const { users, cv_sessions, interviews, jobs, roadmaps, referrals, interview_bank, billing, dau } = metrics

  return (
    <div className="space-y-8">
      <SectionHeader title="Platform Metrics" onRefresh={load} />

      {/* Billing row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="MRR Estimate" value={`$${fmt(billing.mrr_estimate_usd)}`} accent />
        <StatCard label="DAU" value={fmt(dau)} sub="CV sessions today" />
        <StatCard label="Pro Users" value={fmt(billing.pro_users)} sub={`$${billing.pro_users * 29}/mo`} />
        <StatCard label="Enterprise Users" value={fmt(billing.enterprise_users)} sub={`$${billing.enterprise_users * 99}/mo`} />
      </div>

      {/* Token usage row */}
      {tokenSummary && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">AI Token Usage (Today)</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Tokens Today" value={fmt(tokenSummary.tokens_today)} sub={`via ${tokenSummary.provider}`} />
            <StatCard label="Analyses Today" value={fmt(tokenSummary.analyses_today)} />
            <StatCard label="Est. Monthly Cost" value={`$${tokenSummary.est_monthly_cost_usd.toFixed(2)}`} sub={`$${tokenSummary.price_per_1k_tokens}/1k tokens`} accent />
            <StatCard label="Model" value={tokenSummary.model.split('-').slice(0, 2).join('-')} sub={tokenSummary.model} />
          </div>
        </div>
      )}

      {/* Top token users table */}
      {tokenUsers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">Top Token Consumers (Today)</h3>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
                  <th className="text-left px-4 py-2.5 font-medium">User</th>
                  <th className="text-left px-4 py-2.5 font-medium">Tier</th>
                  <th className="text-right px-4 py-2.5 font-medium">Tokens</th>
                  <th className="text-right px-4 py-2.5 font-medium">Ops</th>
                </tr>
              </thead>
              <tbody>
                {tokenUsers.map((u) => (
                  <tr key={u.user_id} className="border-b border-zinc-50 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-2.5 text-zinc-800 dark:text-zinc-200">{u.username ?? u.email ?? `#${u.user_id}`}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.tier === 'free' ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300' : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'}`}>
                        {u.tier}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-600 dark:text-zinc-400 font-mono">{fmt(u.tokens_used)}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-500">{u.operations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Platform row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={fmt(users.total)} sub={`+${fmt(users.new_this_week)} this week`} />
        <StatCard label="CV Sessions" value={fmt(cv_sessions.total)} sub={`+${fmt(cv_sessions.this_week)} this week`} />
        <StatCard label="Interviews" value={fmt(interviews.total)} />
        <StatCard label="Job Applications" value={fmt(jobs.total)} sub={`${fmt(jobs.active)} active`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Roadmaps" value={fmt(roadmaps.total)} sub={`+${fmt(roadmaps.this_week)} this week`} />
        <StatCard label="Referrals" value={fmt(referrals.total)} sub={`${fmt(referrals.conversion_rate, 1)}% conversion`} />
        <StatCard label="Bank Questions" value={fmt(interview_bank.total_questions)} />
        <StatCard label="Avg CV Score" value={cv_sessions.avg_match_score != null ? `${fmt(cv_sessions.avg_match_score, 1)}%` : '—'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="New Users (30 days)">
          {users.signup_trend.length === 0
            ? <NoData />
            : <ResponsiveContainer width="100%" height={180}>
                <LineChart data={users.signup_trend}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
          }
        </ChartCard>

        <ChartCard title="User Tiers">
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={users.tier_distribution} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={60}>
                  {users.tier_distribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5">
              {users.tier_distribution.map((d, i) => (
                <div key={d.tier} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="capitalize text-zinc-700 dark:text-zinc-300">{d.tier}</span>
                  <span className="text-zinc-500 ml-auto pl-4">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {cv_sessions.trend && cv_sessions.trend.length > 0 && (
        <ChartCard title="CV Sessions (30 days)">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={cv_sessions.trend}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="#14b8a6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────

function UsersSection() {
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<AdminUserFilters>({ skip: 0, limit: 100 })
  const [actionLoading, setActionLoading] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await getAdminUsers(filters)
      setUsers(data.users); setTotal(data.total)
    } catch { setError('Failed to load users.') }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load() }, [load])

  const doAction = async (key: string, fn: () => Promise<unknown>) => {
    setActionLoading(key)
    try { await fn(); await load() }
    catch { /* silent */ }
    finally { setActionLoading('') }
  }

  const filtered = users.filter(u =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <SectionHeader title={`Users (${total})`} onRefresh={load} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-primary-500 w-48 transition-colors" />
        </div>
        <select value={filters.tier ?? ''} onChange={e => setFilters(f => ({ ...f, tier: e.target.value || undefined, skip: 0 }))}
          className="text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-primary-500 cursor-pointer">
          <option value="">All tiers</option>
          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.status ?? ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined, skip: 0 }))}
          className="text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-primary-500 cursor-pointer">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="unverified">Unverified</option>
          <option value="locked">Locked</option>
        </select>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Filter size={12} />
          <input type="date" value={filters.joined_from ?? ''} onChange={e => setFilters(f => ({ ...f, joined_from: e.target.value || undefined }))}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-primary-500 text-xs" />
          <span>–</span>
          <input type="date" value={filters.joined_to ?? ''} onChange={e => setFilters(f => ({ ...f, joined_to: e.target.value || undefined }))}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-primary-500 text-xs" />
        </div>
        {(filters.tier || filters.status || filters.joined_from || filters.joined_to) && (
          <button onClick={() => setFilters({ skip: 0, limit: 100 })}
            className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline cursor-pointer">Clear</button>
        )}
      </div>

      {loading ? <Spinner /> : error ? <ErrorMsg msg={error} /> : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden sm:table-cell">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Sessions</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden lg:table-cell">Joined</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <>
                  <tr key={u.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    onClick={() => setExpanded(expanded === u.id ? null : u.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-800 dark:text-zinc-200">{u.email}</div>
                      <div className="text-xs text-zinc-400">@{u.username}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <TierBadge tier={u.tier} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-zinc-600 dark:text-zinc-400">{u.session_count}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.locked_until
                        ? <span className="text-xs text-red-500">Locked</span>
                        : u.email_verified
                          ? <span className="text-xs text-emerald-600 dark:text-emerald-400">Active</span>
                          : <span className="text-xs text-amber-600 dark:text-amber-400">Unverified</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-zinc-400">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {expanded === u.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>
                  {expanded === u.id && (
                    <tr key={`${u.id}-exp`} className="bg-zinc-50 dark:bg-zinc-800/20">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={u.tier} onChange={e => doAction(`tier-${u.id}`, () => setUserTier(u.id, e.target.value))}
                            disabled={actionLoading === `tier-${u.id}`}
                            className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-700 dark:text-zinc-300 cursor-pointer focus:outline-none focus:border-primary-500">
                            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          {u.locked_until && (
                            <ActionBtn onClick={() => doAction(`unlock-${u.id}`, () => unlockUser(u.id))} disabled={!!actionLoading} color="amber" icon={<Unlock size={12} />}>Unlock</ActionBtn>
                          )}
                          {!u.email_verified && (
                            <ActionBtn onClick={() => doAction(`verify-${u.id}`, () => verifyUserEmail(u.id))} disabled={!!actionLoading} color="emerald" icon={<ShieldCheck size={12} />}>Verify Email</ActionBtn>
                          )}
                          <ActionBtn onClick={() => { if (window.confirm(`Delete ${u.email}?`)) doAction(`del-${u.id}`, () => adminDeleteUser(u.id)) }} disabled={!!actionLoading} color="red" icon={<Trash2 size={12} />} className="ml-auto">Delete</ActionBtn>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-sm text-zinc-400 text-center py-8">No users found.</p>}
        </div>
      )}
    </div>
  )
}

// ── Usage ─────────────────────────────────────────────────────────────────────

function UsageSection() {
  const [uid, setUid] = useState('')
  const [usage, setUsage] = useState<AdminUserUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const lookup = async () => {
    const id = parseInt(uid)
    if (!id) return
    setLoading(true); setError(''); setUsage(null)
    try { setUsage((await getAdminUserUsage(id)).data) }
    catch { setError('User not found.') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Per-User Usage" />

      <div className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <UserSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="number" value={uid} onChange={e => setUid(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="User ID…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-primary-500 transition-colors" />
        </div>
        <button onClick={lookup} disabled={loading}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 cursor-pointer">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Look up
        </button>
      </div>

      {error && <ErrorMsg msg={error} />}

      {usage && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-sm">
                {usage.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-zinc-800 dark:text-zinc-200">{usage.email}</div>
                <div className="text-xs text-zinc-400">@{usage.username} · <TierBadge tier={usage.tier} /></div>
              </div>
              <div className="ml-auto text-xs text-zinc-400">
                Joined {usage.joined ? new Date(usage.joined).toLocaleDateString() : '—'}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MiniStat label="CV Sessions" value={usage.cv_sessions} />
              <MiniStat label="Avg CV Score" value={usage.avg_cv_score != null ? `${fmt(usage.avg_cv_score, 1)}%` : '—'} />
              <MiniStat label="Interviews" value={usage.interviews} />
              <MiniStat label="Job Apps" value={usage.job_applications} />
              <MiniStat label="Roadmaps" value={usage.roadmaps} />
            </div>
            <p className="text-xs text-zinc-400 mt-3">Last active: {relativeDate(usage.last_active)}</p>
          </div>
        </div>
      )}

      {!usage && !loading && !error && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-400">
          Enter a user ID to view their usage stats.
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
      <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
      <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">{value}</p>
    </div>
  )
}

// ── Billing ───────────────────────────────────────────────────────────────────

function BillingSection() {
  const [metrics, setMetrics] = useState<FullMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminMetrics().then(r => setMetrics(r.data as FullMetrics)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const billing = metrics?.billing
  const mrr = billing?.mrr_estimate_usd ?? 0
  const arr = mrr * 12

  return (
    <div className="space-y-6">
      <SectionHeader title="Billing Overview" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="MRR (Estimate)" value={`$${fmt(mrr)}`} accent />
        <StatCard label="ARR (Estimate)" value={`$${fmt(arr)}`} sub="MRR × 12" />
        <StatCard label="Pro Subscribers" value={fmt(billing?.pro_users)} sub="$29/mo each" />
        <StatCard label="Enterprise" value={fmt(billing?.enterprise_users)} sub="$99/mo each" />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Revenue Breakdown</h3>
        <div className="space-y-3">
          {[
            { label: 'Free tier', count: (metrics?.users.total ?? 0) - (billing?.pro_users ?? 0) - (billing?.enterprise_users ?? 0), price: 0 },
            { label: 'Pro', count: billing?.pro_users ?? 0, price: 29 },
            { label: 'Enterprise', count: billing?.enterprise_users ?? 0, price: 99 },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between text-sm py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <span className="text-zinc-600 dark:text-zinc-400">{row.label}</span>
              <span className="text-zinc-500">{row.count} users</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">${fmt(row.count * row.price)}/mo</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400">* Pricing is configurable. These are estimates based on default tier prices.</p>
      </div>
    </div>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

function ContentSection() {
  const [data, setData] = useState<{ total: number; questions: AdminQuestion[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData((await getAdminQuestions(0, 200)).data) }
    catch { setError('Failed to load questions.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const deleteQ = async (id: number) => {
    if (!window.confirm('Delete this question?')) return
    setDeleting(id)
    try { await adminDeleteQuestion(id); await load() }
    catch { /* silent */ }
    finally { setDeleting(null) }
  }

  const filtered = (data?.questions ?? []).filter(q =>
    !search ||
    q.question_text.toLowerCase().includes(search.toLowerCase()) ||
    q.role.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader title={`Interview Bank (${data?.total ?? 0})`} onRefresh={load} />
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions…"
            className="pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-primary-500 w-56 transition-colors" />
        </div>
      </div>

      {loading ? <Spinner /> : error ? <ErrorMsg msg={error} /> : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Question</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden sm:table-cell">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide hidden md:table-cell">Level</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => (
                <tr key={q.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 max-w-sm">
                    <div className="truncate">{q.question_text}</div>
                    <div className="text-xs text-zinc-400">{q.category}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-zinc-500 dark:text-zinc-400">{q.role}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <LevelBadge level={q.level} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteQ(q.id)} disabled={deleting === q.id}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors cursor-pointer disabled:opacity-40">
                      {deleting === q.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-sm text-zinc-400 text-center py-8">No questions found.</p>}
        </div>
      )}
    </div>
  )
}

// ── Health ────────────────────────────────────────────────────────────────────

function HealthSection() {
  const [health, setHealth] = useState<AdminHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setHealth((await getAdminHealth()).data) }
    catch { setError('Failed to load system health.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (error || !health) return <ErrorMsg msg={error} />

  const uptimeFmt = () => {
    const s = health.uptime_seconds
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  }

  const allOk = Object.values(health.services).every(s => s.ok)

  return (
    <div className="space-y-6">
      <SectionHeader title="System Health" onRefresh={load} />

      {/* Services */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Services</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${allOk ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'}`}>
            {allOk ? 'All systems operational' : 'Degraded'}
          </span>
        </div>
        <div className="space-y-3">
          {Object.entries(health.services).map(([name, s]) => (
            <div key={name} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <div className="flex items-center gap-2">
                <ServiceDot ok={s.ok} />
                <span className="text-sm capitalize text-zinc-700 dark:text-zinc-300">{name}</span>
              </div>
              <span className={`text-xs font-medium ${s.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {s.ok ? 'Connected' : 'Error'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Resource stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Uptime" value={uptimeFmt()} />
        <StatCard label="CPU" value={`${health.cpu_percent.toFixed(1)}%`} />
        <StatCard label="Memory" value={`${health.memory.percent.toFixed(1)}%`} sub={`${health.memory.used_mb} / ${health.memory.total_mb} MB`} />
        <StatCard label="OS" value={health.os} />
      </div>

      {/* Memory bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <h3 className="font-medium text-zinc-700 dark:text-zinc-300">Memory Usage</h3>
          <span className="text-zinc-500">{health.memory.used_mb} MB / {health.memory.total_mb} MB</span>
        </div>
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5">
          <div className={`h-2.5 rounded-full transition-all ${health.memory.percent > 80 ? 'bg-red-500' : health.memory.percent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${health.memory.percent}%` }} />
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-2 text-sm">
        <h3 className="font-medium text-zinc-700 dark:text-zinc-300 mb-3">Runtime</h3>
        <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-zinc-500">Python</span>
          <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{health.python_version.split(' ')[0]}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-zinc-500">Platform</span>
          <span className="text-zinc-700 dark:text-zinc-300">{health.os}</span>
        </div>
      </div>
    </div>
  )
}

// ── Shared micro-components ────────────────────────────────────────────────────

function Spinner() {
  return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">
      <AlertCircle size={15} className="shrink-0" />{msg || 'Something went wrong.'}
    </div>
  )
}

function SectionHeader({ title, onRefresh }: { title: string; onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      {onRefresh && (
        <button onClick={onRefresh} className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors">
          <RefreshCw size={12} /> Refresh
        </button>
      )}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function NoData() {
  return <p className="text-xs text-zinc-400 text-center py-6">No data yet</p>
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
      tier === 'enterprise' ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' :
      tier === 'pro' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
      'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
    }`}>{tier}</span>
  )
}

function LevelBadge({ level }: { level: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      level === 'hard' || level === 'senior' ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400' :
      level === 'medium' || level === 'mid' ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400' :
      'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
    }`}>{level}</span>
  )
}

function ActionBtn({ onClick, disabled, color, icon, children, className = '' }: {
  onClick: () => void; disabled: boolean; color: 'amber' | 'emerald' | 'red'; icon: React.ReactNode; children: string; className?: string
}) {
  const c = {
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40',
    red: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40',
  }[color]
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg ${c} transition-colors cursor-pointer disabled:opacity-50 ${className}`}>
      {icon}{children}
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Section = 'metrics' | 'users' | 'usage' | 'billing' | 'content' | 'health'

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'metrics',  label: 'Metrics',  icon: LayoutDashboard },
  { id: 'users',    label: 'Users',    icon: Users },
  { id: 'usage',    label: 'Usage',    icon: UserSearch },
  { id: 'billing',  label: 'Billing',  icon: DollarSign },
  { id: 'content',  label: 'Content',  icon: BookOpen },
  { id: 'health',   label: 'Health',   icon: Activity },
]

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('admin_token'))
  const [section, setSection] = useState<Section>('metrics')

  const handleLogin = (t: string) => { sessionStorage.setItem('admin_token', t); setToken(t) }
  const handleLogout = () => { sessionStorage.removeItem('admin_token'); setToken(null) }

  if (!token) return <AdminLoginForm onSuccess={handleLogin} />

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
      <aside className="w-52 shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="h-12 flex items-center gap-2 px-4 border-b border-zinc-100 dark:border-zinc-800">
          <ShieldCheck size={16} className="text-primary-500" strokeWidth={2} />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Admin Console</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setSection(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer text-left ${
                section === id
                  ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}>
              <Icon size={15} strokeWidth={1.75} />{label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer">
            <LogOut size={15} strokeWidth={1.75} />Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6 lg:p-8">
        {section === 'metrics' && <MetricsSection />}
        {section === 'users'   && <UsersSection />}
        {section === 'usage'   && <UsageSection />}
        {section === 'billing' && <BillingSection />}
        {section === 'content' && <ContentSection />}
        {section === 'health'  && <HealthSection />}
      </main>
    </div>
  )
}
