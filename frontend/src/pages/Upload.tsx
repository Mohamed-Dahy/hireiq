import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { uploadCV } from '../api'
import type { CVUploadResponse } from '../api'

interface Props {
  onDone: (result: CVUploadResponse) => void
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
    label: 'Frontend Developer',
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

export default function Upload({ onDone }: Props) {
  const reduced = useReducedMotion()
  const [file, setFile] = useState<File | null>(null)
  const [jd, setJd] = useState('')
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const applyTemplate = (t: Template) => {
    setJd(t.jd)
    setActiveTemplate(t.id)
  }

  const handleJdChange = (value: string) => {
    setJd(value)
    if (activeTemplate) {
      const tpl = TEMPLATES.find((t) => t.id === activeTemplate)
      if (tpl && value !== tpl.jd) setActiveTemplate(null)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !jd.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await uploadCV(file, jd)
      onDone(res.data)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(', '))
      } else {
        setError(detail || 'Upload failed')
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

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-2xl mx-auto py-12 px-4"
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Analyze Your CV</h2>
      <p className="text-sm text-gray-500 mb-8">
        Paste the job description and upload your PDF to get a match score + AI skill gap analysis.
      </p>

      <form onSubmit={submit} className="space-y-5">
        {/* Drop zone */}
        <motion.div
          animate={dragging
            ? { borderColor: '#7c3aed', backgroundColor: '#f5f3ff', scale: reduced ? 1 : 1.01 }
            : { borderColor: file ? '#7c3aed' : '#e5e7eb', backgroundColor: '#fff', scale: 1 }
          }
          transition={{ duration: 0.2 }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('cv-file')?.click()}
          className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer"
        >
          <input
            id="cv-file" type="file" accept=".pdf" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <motion.div
            animate={file ? { scale: reduced ? 1 : 1.02 } : { scale: 1 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-2"
          >
            <motion.div
              animate={dragging ? { y: reduced ? 0 : -4 } : { y: 0 }}
              transition={{ duration: 0.2, repeat: dragging && !reduced ? Infinity : 0, repeatType: 'reverse' }}
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1 ${file ? 'bg-purple-100' : 'bg-gray-100'}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke={file ? '#7c3aed' : '#9ca3af'} strokeWidth="1.8" className="w-6 h-6">
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.div>
            {file ? (
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 max-w-full">
                <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" className="w-4 h-4 shrink-0">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-semibold text-purple-800 truncate max-w-[260px]">{file.name}</p>
                  <p className="text-xs text-purple-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  aria-label="Remove file"
                  className="ml-1 text-purple-400 hover:text-red-500 cursor-pointer p-1"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-600">
                  {dragging ? 'Drop to upload' : 'Drop your PDF here or click to browse'}
                </p>
                <p className="text-xs text-gray-400">PDF files only</p>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* JD section */}
        <div className="space-y-3">
          {/* Template chips */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Start with a template
            </p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => {
                const isActive = activeTemplate === t.id
                return (
                  <motion.button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    whileHover={reduced ? {} : { scale: 1.04 }}
                    whileTap={reduced ? {} : { scale: 0.95 }}
                    transition={{ duration: 0.13 }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-200'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-400 hover:text-purple-700'
                    }`}
                  >
                    {t.label}
                    {isActive && (
                      <span className="ml-1.5 opacity-80">✓</span>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-300 font-medium">or paste your own</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              placeholder="Paste the job description here…"
              value={jd}
              onChange={(e) => handleJdChange(e.target.value)}
              rows={10}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
            />
            <AnimatePresence>
              {jd.length > 0 && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => { setJd(''); setActiveTemplate(null) }}
                  aria-label="Clear job description"
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gray-100 hover:bg-red-100 hover:text-red-500 text-gray-400 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {jd.length > 0 && (
            <p className="text-xs text-gray-400 text-right">{jd.length} characters</p>
          )}
        </div>

        {error && (
          <motion.p
            initial={reduced ? {} : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg"
          >
            {error}
          </motion.p>
        )}

        <motion.button
          type="submit"
          disabled={loading || !file || !jd.trim()}
          whileHover={reduced ? {} : { scale: 1.02 }}
          whileTap={reduced ? {} : { scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="w-full bg-purple-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-40 transition-colors shadow-sm shadow-purple-100 cursor-pointer"
        >
          {loading
            ? <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Analyzing your CV…
              </span>
            : 'Analyze CV'
          }
        </motion.button>
      </form>
    </motion.div>
  )
}
