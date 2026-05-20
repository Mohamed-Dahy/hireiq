import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CloudUpload, FileText, X, Sparkles, Loader2,
  Target, Brain, Map as MapIcon, Mic, Download, CheckCircle2,
  AlertTriangle, Clock,
} from 'lucide-react'
import { uploadCV, getProfile } from '../api'
import type { CVUploadResponse } from '../api'

interface Props {
  onDone: (result: CVUploadResponse) => void
  onViewLastSession?: () => void
}

interface Template {
  id: string
  label: string
  jd: string
}

const TEMPLATES: Template[] = [
  {
    id: 'swe',
    label: 'Software Engineer',
    jd: `We are looking for a Software Engineer to join our backend team.

Requirements:
• 3+ years of experience with Python or Go
• Strong understanding of REST API design and microservices
• Experience with PostgreSQL, Redis, and message queues (Kafka / RabbitMQ)
• Familiarity with Docker, Kubernetes, and CI/CD pipelines (GitHub Actions)
• Solid grasp of data structures, algorithms, and system design principles

Responsibilities:
• Design and build scalable backend services
• Write clean, well-tested code with meaningful test coverage
• Participate in code reviews and technical design discussions
• Monitor production systems and respond to incidents

Nice to have: gRPC, Terraform, experience with distributed tracing (OpenTelemetry)`,
  },
  {
    id: 'ds',
    label: 'Data Scientist',
    jd: `We are hiring a Data Scientist to drive insights across our platform.

Requirements:
• 2+ years of experience in data science or machine learning
• Proficiency in Python — pandas, scikit-learn, NumPy, matplotlib
• Strong SQL skills and comfort working with large datasets
• Experience with ML frameworks: TensorFlow or PyTorch
• Ability to clearly communicate findings to non-technical stakeholders

Responsibilities:
• Develop, validate, and deploy predictive models
• Design and analyse A/B tests with statistical rigour
• Collaborate with engineering to serve models at scale
• Build dashboards and reports for business decisions

Nice to have: NLP / LLM fine-tuning, dbt, Apache Spark, MLflow`,
  },
  {
    id: 'pm',
    label: 'Product Manager',
    jd: `We are looking for a Product Manager to own our core product roadmap.

Requirements:
• 3+ years of product management experience at a B2B or SaaS company
• Analytical mindset — comfortable with SQL, Mixpanel, or Amplitude
• Experience running agile sprints and managing backlogs in Jira or Linear
• Excellent written communication and stakeholder management skills
• Track record of shipping products that move business KPIs

Responsibilities:
• Define product vision, strategy, and quarterly roadmap
• Write detailed PRDs, user stories, and acceptance criteria
• Work cross-functionally with engineering, design, and go-to-market teams
• Set goals, measure outcomes, and iterate quickly

Nice to have: technical background (CS degree or coding experience), PLG expertise`,
  },
  {
    id: 'devops',
    label: 'DevOps Engineer',
    jd: `We are seeking a DevOps / Platform Engineer to scale our cloud infrastructure.

Requirements:
• 3+ years in a DevOps, SRE, or Platform Engineering role
• Deep experience with Docker and Kubernetes (EKS or GKE)
• Expertise in CI/CD pipelines — GitHub Actions, ArgoCD, or Jenkins
• Cloud platform proficiency: AWS, GCP, or Azure
• Infrastructure-as-code experience with Terraform or Pulumi

Responsibilities:
• Design, build, and maintain production cloud infrastructure
• Automate deployments and enforce reliability standards (99.9%+ SLA)
• Implement monitoring, alerting, and on-call runbooks (Prometheus / Grafana)
• Partner with developers to reduce build and release cycle times

Nice to have: service mesh (Istio / Linkerd), Vault secrets management, FinOps`,
  },
  {
    id: 'fe',
    label: 'Frontend Dev',
    jd: `We are looking for a Frontend Developer who cares deeply about user experience.

Requirements:
• 3+ years building production web apps with React and TypeScript
• Proficiency in modern tooling: Vite or Webpack, ESLint, Prettier
• Strong CSS skills — Tailwind CSS or CSS Modules, responsive and accessible design
• Experience with state management: Zustand, Redux Toolkit, or React Query
• Familiarity with performance optimisation and Core Web Vitals

Responsibilities:
• Build accessible, pixel-perfect, high-performance UI components
• Collaborate closely with designers using Figma
• Write unit and integration tests with Vitest and Testing Library
• Review pull requests and raise the quality bar across the team

Nice to have: Next.js / SSR, animation libraries (Framer Motion), GraphQL, PWA`,
  },
]

const STEPS = [
  { label: 'Upload CV',        desc: 'PDF format' },
  { label: 'Job Description',  desc: 'Paste or choose template' },
  { label: 'Analyze',          desc: 'Get your score' },
]

const FEATURES = [
  { icon: Target,  label: 'Match Score',     desc: 'Precise % match against job requirements' },
  { icon: Brain,   label: 'Skill Gaps',      desc: 'Prioritised list of skills to learn next' },
  { icon: MapIcon, label: 'Career Roadmap',  desc: 'Week-by-week personalised learning plan' },
  { icon: Mic,     label: 'Interview Prep',  desc: 'Tailored questions based on the role' },
  { icon: Download,label: 'PDF Report',      desc: 'Shareable summary you can send to mentors' },
]

const TIPS = [
  'Upload your most recent and complete CV',
  'Use the full job description, not just the title',
  'Include the required skills section for best matching',
]

function FeaturesPanel() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 h-fit lg:sticky lg:top-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">What you'll get</h3>
        <ul className="space-y-4">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <li key={label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-950/30 flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={14} strokeWidth={1.5} className="text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Tips for best results</h3>
        <ul className="space-y-2.5">
          {TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 size={13} strokeWidth={2} className="text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function Upload({ onDone, onViewLastSession }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [jd, setJd] = useState('')
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [storedCvFilename, setStoredCvFilename] = useState<string | null>(null)
  const [usingStoredCv, setUsingStoredCv] = useState(false)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [quotaResetsAt, setQuotaResetsAt] = useState<string | null>(null)
  const [quotaLimit, setQuotaLimit] = useState<number>(2)
  const [quotaUsed, setQuotaUsed] = useState<number>(0)

  useEffect(() => {
    getProfile()
      .then((res) => {
        const d = res.data as any
        if (d.has_stored_cv && d.stored_cv_filename) {
          setStoredCvFilename(d.stored_cv_filename)
        }
        const limit: number = d.free_tier_analysis_limit ?? 2
        const used: number = d.analyses_in_window ?? 0
        setQuotaLimit(limit)
        setQuotaUsed(used)
        if (d.tier === 'free' && used >= limit) {
          setQuotaExceeded(true)
          setQuotaResetsAt(d.window_resets_at ?? null)
        }
      })
      .catch(() => {/* not logged in or no profile — ignore */})
  }, [])

  const applyTemplate = (t: Template) => { setJd(t.jd); setActiveTemplate(t.id) }

  const handleJdChange = (value: string) => {
    setJd(value)
    if (activeTemplate) {
      const tpl = TEMPLATES.find((t) => t.id === activeTemplate)
      if (tpl && value !== tpl.jd) setActiveTemplate(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!file && !usingStoredCv) || !jd.trim()) return
    setError('')
    setLoading(true)
    try {
      if (usingStoredCv) {
        const { data } = await import('../api').then(m => m.default.post<CVUploadResponse>('/cv/use-stored', { jd_text: jd }))
        onDone(data)
      } else {
        const res = await uploadCV(file!, jd)
        onDone(res.data)
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        const detail = err.response?.data?.detail ?? {}
        setQuotaExceeded(true)
        setQuotaResetsAt(detail.window_resets_at ?? detail.resets_at ?? null)
        if (detail.limit) setQuotaLimit(detail.limit)
        if (detail.analyses_used) setQuotaUsed(detail.analyses_used)
      } else {
        const detail = err.response?.data?.detail
        if (Array.isArray(detail)) setError(detail.map((d: any) => d.msg).join(', '))
        else setError(typeof detail === 'string' ? detail : 'Upload failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.type === 'application/pdf') setFile(dropped)
  }

  const currentStep = !(file || usingStoredCv) ? 0 : !jd.trim() ? 1 : 2

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto py-8 px-4 sm:px-6"
    >
      {/* Active session banner — full width */}
      {onViewLastSession && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 mb-6"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">You have an active analysis session.</p>
          <button
            type="button"
            onClick={onViewLastSession}
            className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 ml-4 shrink-0 cursor-pointer"
          >
            View results →
          </button>
        </motion.div>
      )}

      {/* Quota exceeded banner */}
      <AnimatePresence>
        {quotaExceeded && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-6 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-5 py-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Free analysis limit reached ({quotaUsed}/{quotaLimit})
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  You've used all your free CV analyses for this period.
                  {quotaResetsAt && (
                    <>
                      {' '}Your quota resets on{' '}
                      <span className="font-medium">
                        {new Date(quotaResetsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>.
                    </>
                  )}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <Clock size={13} className="text-amber-500 shrink-0" strokeWidth={1.5} />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Upgrade to a paid plan for unlimited daily analyses.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 lg:gap-10">
        {/* Left: form */}
        <div className="lg:col-span-3">
          {/* Header */}
          <div className="mb-7">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-1">Analyze Your CV</h2>
            <p className="text-sm text-zinc-500">
              Upload your PDF and a job description to get your match score and AI skill gap analysis.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-0 mb-7">
            {STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                    i < currentStep
                      ? 'bg-primary-600 text-white'
                      : i === currentStep
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-zinc-950'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                  }`}>
                    {i < currentStep ? (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <p className={`text-xs mt-1.5 ${i <= currentStep ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-400'}`}>{step.label}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-5 transition-colors ${i < currentStep ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-5">
            {/* Stored CV banner */}
            {storedCvFilename && !usingStoredCv && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={15} strokeWidth={1.5} className="text-primary-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{storedCvFilename}</p>
                    <p className="text-xs text-zinc-500">Your stored CV</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setUsingStoredCv(true); setFile(null) }}
                  className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 shrink-0 ml-3 cursor-pointer"
                >
                  Use this CV
                </button>
              </motion.div>
            )}

            {usingStoredCv && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between bg-primary-50 dark:bg-primary-950/30 border border-primary-500/50 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={15} strokeWidth={1.5} className="text-primary-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{storedCvFilename}</p>
                    <p className="text-xs text-primary-500">Using stored CV</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUsingStoredCv(false)}
                  className="text-zinc-400 hover:text-red-500 ml-3 cursor-pointer"
                  aria-label="Cancel stored CV"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </motion.div>
            )}

            {/* Drop zone */}
            <div className={`space-y-2 transition-all ${usingStoredCv ? 'opacity-40 pointer-events-none select-none' : ''}`}>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">1</span>
                Upload your CV
              </label>
              <div
                onDragOver={(e) => { if (!usingStoredCv) { e.preventDefault(); setDragging(true) } }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { if (!usingStoredCv) onDrop(e) }}
                onClick={() => { if (!usingStoredCv) document.getElementById('cv-file')?.click() }}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  usingStoredCv
                    ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/30 cursor-not-allowed'
                    : dragging
                    ? 'border-primary-500 bg-primary-500/5 cursor-pointer'
                    : file
                    ? 'border-primary-500/50 bg-zinc-50 dark:bg-zinc-900/50 cursor-pointer'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 bg-white dark:bg-zinc-900 cursor-pointer'
                }`}
              >
                <input id="cv-file" type="file" accept=".pdf" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                    file ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-zinc-100 dark:bg-zinc-800'
                  }`}>
                    {file
                      ? <FileText size={20} strokeWidth={1.5} className="text-primary-500" />
                      : <CloudUpload size={20} strokeWidth={1.5} className="text-zinc-400" />
                    }
                  </div>
                  {file ? (
                    <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2">
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-50">{file.name}</p>
                        <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null) }}
                        aria-label="Remove file"
                        className="text-zinc-400 hover:text-red-500 cursor-pointer p-1 rounded transition-colors"
                      >
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {dragging ? 'Drop to upload' : 'Drop your PDF here'}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">or <span className="text-primary-500">browse files</span> · PDF only</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Job description */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] flex items-center justify-center font-bold">2</span>
                Job description
              </label>
              <div>
                <p className="text-xs text-zinc-400 mb-2">Start with a template or paste your own</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((t) => {
                    const isActive = activeTemplate === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className={`px-3 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                        }`}
                      >
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="relative">
                <textarea
                  placeholder="Paste the full job description here…"
                  value={jd}
                  onChange={(e) => handleJdChange(e.target.value)}
                  rows={11}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none transition-colors"
                />
                <AnimatePresence>
                  {jd.length > 0 && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.13 }}
                      onClick={() => { setJd(''); setActiveTemplate(null) }}
                      aria-label="Clear job description"
                      className="absolute top-3 right-3 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-700 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-500 text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X size={11} strokeWidth={2.5} />
                    </motion.button>
                  )}
                </AnimatePresence>
                {jd.length > 0 && (
                  <p className="text-xs text-zinc-400 text-right mt-1.5">{jd.length.toLocaleString()} chars</p>
                )}
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2.5 rounded-md"
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading || (!file && !usingStoredCv) || !jd.trim() || quotaExceeded}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white py-3 rounded-xl text-sm font-medium disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={15} strokeWidth={2} className="animate-spin" /> Analyzing your CV…</>
                ) : (
                  <><Sparkles size={15} strokeWidth={1.5} /> Analyze CV</>
                )}
              </button>
              {(!file && !usingStoredCv) || !jd.trim() ? (
                <p className="text-center text-xs text-zinc-400 mt-2">
                  {!file && !usingStoredCv ? 'Upload a PDF CV to continue' : 'Add a job description to continue'}
                </p>
              ) : null}
            </div>
          </form>
        </div>

        {/* Right: features panel */}
        <div className="lg:col-span-2 mt-8 lg:mt-0">
          <FeaturesPanel />
        </div>
      </div>
    </motion.div>
  )
}
