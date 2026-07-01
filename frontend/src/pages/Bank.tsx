import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Search, ChevronDown, ChevronUp, CheckCircle2, Circle,
  Loader2, AlertCircle, X, Clock, BarChart3,
} from 'lucide-react'
import {
  getInterviewQuestions,
  searchInterviewQuestions,
  markQuestionPracticed,
  getInterviewProgress,
} from '../api'
import type { BankQuestion, BankSearchResult, BankQuestionsResponse, BankProgressResponse } from '../api'

const HISTORY_KEY = 'bank:search_history'
const MAX_HISTORY = 10

// Fixed role tabs — maps display label to the DB role name
const ROLE_TABS = [
  { key: 'sw',    label: 'SW',           dbRole: 'Software Engineer' },
  { key: 'ds',    label: 'Data Science', dbRole: 'Data Scientist'    },
  { key: 'behav', label: 'Behavioral',   dbRole: 'All Roles'         },
] as const
type TabKey = typeof ROLE_TABS[number]['key']

// Tabs where level filtering is not applicable — use 'all' internally
const NO_LEVEL_TABS = new Set<TabKey>(['behav'])
const LEVEL_OPTIONS = ['junior', 'mid', 'senior'] as const

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') }
  catch { return [] }
}
function saveHistory(term: string) {
  const prev = loadHistory().filter(h => h !== term)
  localStorage.setItem(HISTORY_KEY, JSON.stringify([term, ...prev].slice(0, MAX_HISTORY)))
}
function clearHistory() { localStorage.removeItem(HISTORY_KEY) }

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-primary-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  )
}

function QuestionCard({
  q,
  onTogglePracticed,
  toggling,
}: {
  q: BankQuestion & { role?: string; category?: string }
  onTogglePracticed: (id: number, current: boolean) => void
  toggling: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => onTogglePracticed(q.id, q.practiced)}
            disabled={toggling}
            className="mt-0.5 shrink-0 text-primary-500 disabled:opacity-40 transition-opacity"
            title={q.practiced ? 'Mark as not practiced' : 'Mark as practiced'}
          >
            {q.practiced
              ? <CheckCircle2 size={20} className="text-accent-500" />
              : <Circle size={20} className="text-zinc-400 hover:text-primary-400 transition-colors" />
            }
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
              {q.question_text}
            </p>
            {(q as any).role && (
              <div className="flex gap-2 mt-1.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300">
                  {(q as any).role}
                </span>
                {(q as any).category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {(q as any).category}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-950/40 text-accent-700 dark:text-accent-300">
                  {q.level}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setOpen(o => !o)}
            className="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            title={open ? 'Hide answer' : 'Show answer'}
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-semibold text-accent-600 dark:text-accent-400 mb-2 uppercase tracking-wide">
                Model Answer
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                {q.model_answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CategoryAccordion({
  category, questions, progressPct, onTogglePracticed, togglingIds, defaultOpen,
}: {
  category: string
  questions: BankQuestion[]
  progressPct?: number
  onTogglePracticed: (id: number, current: boolean) => void
  togglingIds: Set<number>
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)
  const practiced = questions.filter(q => q.practiced).length

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <BookOpen size={16} className="text-primary-500 shrink-0" />
          <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 capitalize">
            {category.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {practiced}/{questions.length} practiced
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {progressPct !== undefined && (
            <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
              {progressPct}%
            </span>
          )}
          {open ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
        </div>
      </button>
      {progressPct !== undefined && <ProgressBar pct={progressPct} />}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3 bg-white dark:bg-zinc-950">
              {questions.map(q => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  onTogglePracticed={onTogglePracticed}
                  toggling={togglingIds.has(q.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Bank() {
  const [activeTab, setActiveTab] = useState<TabKey>('sw')
  const [selectedLevel, setSelectedLevel] = useState<string>('junior')
  const [questionsData, setQuestionsData] = useState<BankQuestionsResponse | null>(null)
  const [progress, setProgress] = useState<BankProgressResponse | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<BankSearchResult[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const [error, setError] = useState('')
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set())
  const [searchHistory, setSearchHistory] = useState<string[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentTab = ROLE_TABS.find(t => t.key === activeTab)!
  const effectiveLevel = NO_LEVEL_TABS.has(activeTab) ? 'all' : selectedLevel
  const showLevelFilter = !NO_LEVEL_TABS.has(activeTab)

  const loadQuestions = useCallback(async (dbRole: string, level: string) => {
    setBrowsing(true)
    setError('')
    try {
      const [qRes, pRes] = await Promise.allSettled([
        getInterviewQuestions(dbRole, level),
        getInterviewProgress(dbRole, level).catch(() => null),
      ])
      if (qRes.status === 'fulfilled') setQuestionsData(qRes.value.data)
      else throw new Error('Failed to load questions')
      if (pRes.status === 'fulfilled' && pRes.value) setProgress((pRes.value as any)?.data ?? null)
    } catch {
      setError('Failed to load questions. Please try again.')
    } finally {
      setBrowsing(false)
    }
  }, [])

  useEffect(() => {
    if (!searchTerm) {
      setQuestionsData(null)
      setProgress(null)
      loadQuestions(currentTab.dbRole, effectiveLevel)
    }
  }, [activeTab, selectedLevel, loadQuestions, searchTerm, currentTab.dbRole, effectiveLevel])

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) { setSearchResults(null); return }
    setSearchLoading(true)
    try {
      const r = await searchInterviewQuestions(term, currentTab.dbRole, effectiveLevel)
      setSearchResults(r.data.results)
      saveHistory(term.trim())
      setSearchHistory(loadHistory())
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [currentTab.dbRole, effectiveLevel])

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setShowHistory(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(value), 300)
  }

  const switchTab = (key: TabKey) => {
    setActiveTab(key)
    setSearchTerm('')
    setSearchResults(null)
    setQuestionsData(null)
    setProgress(null)
  }

  const handleTogglePracticed = async (questionId: number, current: boolean) => {
    setTogglingIds(prev => new Set(prev).add(questionId))
    try {
      await markQuestionPracticed(questionId, !current)
      if (questionsData) {
        const updated = { ...questionsData }
        for (const cat of Object.keys(updated.categories)) {
          updated.categories[cat] = updated.categories[cat].map(q =>
            q.id === questionId ? { ...q, practiced: !current } : q
          )
        }
        setQuestionsData(updated)
      }
      if (searchResults) {
        setSearchResults(searchResults.map(q =>
          q.id === questionId ? { ...q, practiced: !current } : q
        ))
      }
      getInterviewProgress(currentTab.dbRole, effectiveLevel)
        .then(r => setProgress(r.data))
        .catch(() => {})
    } catch {
      loadQuestions(currentTab.dbRole, effectiveLevel)
    } finally {
      setTogglingIds(prev => { const s = new Set(prev); s.delete(questionId); return s })
    }
  }

  const isSearchMode = searchTerm.trim().length > 0
  const totalQuestions = questionsData?.total_questions ?? 0
  const overallPct = progress?.overall_readiness_pct ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <BookOpen size={24} className="text-primary-500" />
            Interview Bank
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Browse curated questions and track your practice progress
          </p>
        </div>
        {progress && !isSearchMode && (
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 shrink-0">
            <BarChart3 size={18} className="text-accent-500" />
            <div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Readiness</p>
              <p className="text-lg font-bold text-accent-600 dark:text-accent-400">{overallPct}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4 space-y-4">

        {/* Role tabs */}
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Category</p>
          <div className="flex gap-2">
            {ROLE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Level filter — hidden for Behavioral */}
        {showLevelFilter && (
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Level</p>
            <div className="flex gap-2">
              {LEVEL_OPTIONS.map(lvl => (
                <button
                  key={lvl}
                  onClick={() => { setSelectedLevel(lvl); setSearchTerm(''); setSearchResults(null) }}
                  className={`px-3 py-1 rounded-md text-xs font-medium border capitalize transition-all cursor-pointer ${
                    selectedLevel === lvl
                      ? 'bg-accent-600 text-white border-accent-600'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            ref={searchRef}
            value={searchTerm}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => !searchTerm && searchHistory.length > 0 && setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 150)}
            placeholder="Search questions…"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm pl-9 pr-9 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setSearchResults(null); searchRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          )}

          <AnimatePresence>
            {showHistory && searchHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute z-30 top-full mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <Clock size={12} />
                    Recent searches
                  </div>
                  <button
                    onMouseDown={e => { e.preventDefault(); clearHistory(); setSearchHistory([]) }}
                    className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                {searchHistory.map((h, i) => (
                  <button
                    key={i}
                    onMouseDown={e => { e.preventDefault(); setSearchTerm(h); setShowHistory(false); runSearch(h) }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                  >
                    <Search size={12} className="text-zinc-400 shrink-0" />
                    {h}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {(browsing || searchLoading) && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primary-500" />
        </div>
      )}

      {/* Search Results */}
      {isSearchMode && !searchLoading && searchResults !== null && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {searchResults.length === 0
              ? `No results for "${searchTerm}"`
              : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${searchTerm}"`}
          </p>
          {searchResults.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
              <Search size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Try a different keyword or switch category.</p>
            </div>
          ) : (
            searchResults.map(q => (
              <QuestionCard
                key={q.id}
                q={q}
                onTogglePracticed={handleTogglePracticed}
                toggling={togglingIds.has(q.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Browse Mode */}
      {!isSearchMode && !browsing && questionsData && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{totalQuestions} question{totalQuestions !== 1 ? 's' : ''}</span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>{Object.keys(questionsData.categories).length} categories</span>
          </div>

          {totalQuestions === 0 ? (
            <div className="text-center py-16 text-zinc-400 dark:text-zinc-500">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No questions found for this selection.</p>
              {activeTab !== 'behav' && (
                <p className="text-xs mt-1">Try a different level.</p>
              )}
            </div>
          ) : (
            Object.entries(questionsData.categories).map(([cat, questions], idx) => {
              const catProgress = progress?.by_category?.[cat]
              return (
                <CategoryAccordion
                  key={cat}
                  category={cat}
                  questions={questions}
                  progressPct={catProgress?.pct}
                  onTogglePracticed={handleTogglePracticed}
                  togglingIds={togglingIds}
                  defaultOpen={idx === 0}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
