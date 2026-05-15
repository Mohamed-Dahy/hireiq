import { motion } from 'framer-motion'
import {
  Layers, FileText, Sparkles, Mic, Eye, Briefcase, Users,
  Check, ArrowRight, Moon, Sun,
} from 'lucide-react'
import { PLANS, TESTIMONIALS } from '../lib/constants'

interface Props {
  onGetStarted: () => void
  onLogin: () => void
  dark: boolean
  onToggleDark: () => void
}

const features = [
  { icon: FileText,  title: 'CV & JD Matching',       desc: 'Semantic + keyword scoring returns a 0–100 match score in seconds against any job description.' },
  { icon: Sparkles,  title: 'AI Skill Gap Analysis',   desc: 'LLaMA 3 via Groq identifies missing skills and builds a prioritised learning roadmap, streamed live.' },
  { icon: Mic,       title: 'Mock Interview Engine',   desc: 'Answer questions by voice. Whisper transcribes, LLaMA scores clarity, relevance, and depth.' },
  { icon: Eye,       title: 'Eye Contact Feedback',    desc: 'OpenCV tracks your webcam in real time and reports eye contact ratio — just like a real interviewer.' },
  { icon: Briefcase, title: 'ATS Job Tracker',         desc: 'Kanban board for applications. Track every stage from saved to offer with AI prep questions per role.' },
  { icon: Users,     title: 'Recruiter Dashboard',     desc: 'Compare and rank candidates side-by-side. Export shortlists to PDF. Built for hiring teams.' },
]

const steps = [
  { num: '01', title: 'Upload your CV',     desc: 'Drop your PDF and paste a job description.' },
  { num: '02', title: 'Get your score',     desc: 'Semantic + keyword matching returns a 0–100 match score instantly.' },
  { num: '03', title: 'Read the analysis',  desc: 'Skill gaps and tailored questions stream live from LLaMA 3.' },
  { num: '04', title: 'Practice & improve', desc: 'Record answers, get scored on 3 dimensions, track progress over time.' },
]

const stats = [
  { value: '< 2s',  label: 'Match score latency' },
  { value: '6+',    label: 'AI signals combined' },
  { value: '100%',  label: 'Free tier available' },
  { value: '4.8★',  label: 'Avg user rating' },
]

const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

export default function Landing({ onGetStarted, onLogin, dark, onToggleDark }: Props) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-50 overflow-x-hidden">

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} strokeWidth={1.5} className="text-primary-500" />
            <span className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm tracking-tight">HireIQ</span>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <a href="#features"    className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">How it works</a>
            <a href="#pricing"     className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleDark}
              aria-label="Toggle theme"
              className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {dark ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
            </button>
            <button
              onClick={onLogin}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors cursor-pointer px-2 py-1"
            >
              Sign in
            </button>
            <button
              onClick={onGetStarted}
              className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-md font-medium transition-colors cursor-pointer"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="pt-36 pb-24 px-6">
        <motion.div
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div variants={fade} className="inline-flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8 cursor-default">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
            Now with voice-based interview scoring
            <ArrowRight size={11} />
          </motion.div>

          <motion.h1 variants={fade} className="text-5xl sm:text-6xl lg:text-[68px] font-semibold text-zinc-900 dark:text-zinc-50 leading-[1.08] tracking-tight mb-6">
            The AI career<br className="hidden sm:block" /> intelligence platform
          </motion.h1>

          <motion.p variants={fade} className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Match your CV to any job description, discover skill gaps, and practice interviews — powered by LLaMA 3 and Whisper AI.
          </motion.p>

          <motion.div variants={fade} className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <button
              onClick={onGetStarted}
              className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
            >
              Analyze my CV — it's free
              <ArrowRight size={14} strokeWidth={2} />
            </button>
            <button
              onClick={onLogin}
              className="border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-6 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
            >
              Sign in to existing account
            </button>
          </motion.div>

          <motion.div variants={fade} className="flex flex-wrap items-center justify-center gap-5 mt-7 text-xs text-zinc-400">
            {['Free tier · no credit card', 'GDPR compliant', 'Open-source backend'].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <Check size={11} strokeWidth={2.5} className="text-zinc-400" />
                {t}
              </span>
            ))}
          </motion.div>

          {/* Product preview card */}
          <motion.div
            variants={fade}
            className="mt-16 max-w-2xl w-full mx-auto bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm text-left"
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex-1 mx-3 h-5 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center px-2.5">
                <span className="text-[11px] text-zinc-400 font-mono">hireiq.app · Analysis</span>
              </div>
            </div>
            {/* Content */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Match Score</p>
                  <p className="text-4xl font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums leading-none">
                    87<span className="text-2xl text-zinc-400 font-normal">%</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500 mb-1">Analyzed</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium font-mono">senior-eng-cv.pdf</p>
                </div>
              </div>
              <div className="mb-5">
                <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Matched Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Python', 'FastAPI', 'Docker', 'PostgreSQL', 'Redis'].map((s) => (
                    <span key={s} className="bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 font-mono">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Skill Gaps</p>
                <div className="space-y-2.5">
                  {[{ label: 'Kubernetes', w: 85 }, { label: 'Terraform', w: 62 }, { label: 'OpenTelemetry', w: 44 }].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500 w-28 font-mono shrink-0">{item.label}</span>
                      <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${item.w}%` }} />
                      </div>
                      <span className="text-xs text-zinc-400 w-8 text-right font-mono">{item.w}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────────── */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 py-10 bg-zinc-50 dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">{s.value}</p>
              <p className="text-xs text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="mb-14"
          >
            <motion.p variants={fade} className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">Features</motion.p>
            <motion.h2 variants={fade} className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight max-w-md">
              Everything you need to get hired
            </motion.h2>
            <motion.p variants={fade} className="text-zinc-500 dark:text-zinc-400 mt-3 max-w-lg">
              One platform combining CV analysis, LLM coaching, and voice mock interviews.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fade}
                className="bg-white dark:bg-zinc-950 p-6 group"
              >
                <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4 text-primary-500">
                  <f.icon size={16} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">{f.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-zinc-50 dark:bg-zinc-900 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="mb-10"
          >
            <motion.p variants={fade} className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">Testimonials</motion.p>
            <motion.h2 variants={fade} className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Real results from real job seekers</motion.h2>
          </motion.div>
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
            className="grid sm:grid-cols-3 gap-4"
          >
            {TESTIMONIALS.map((t) => (
              <motion.div
                key={t.name}
                variants={fade}
                className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5"
              >
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} viewBox="0 0 20 20" fill="#8b5cf6" className="w-3.5 h-3.5">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="mb-14"
          >
            <motion.p variants={fade} className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">How it works</motion.p>
            <motion.h2 variants={fade} className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight max-w-sm">
              From CV to interview-ready in minutes
            </motion.h2>
          </motion.div>
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {steps.map((s) => (
              <motion.div
                key={s.num}
                variants={fade}
                className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900"
              >
                <p className="text-3xl font-semibold text-zinc-200 dark:text-zinc-700 tabular-nums font-mono mb-4 select-none">{s.num}</p>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">{s.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-zinc-50 dark:bg-zinc-900 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="mb-12"
          >
            <motion.p variants={fade} className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">Pricing</motion.p>
            <motion.h2 variants={fade} className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Simple, transparent pricing</motion.h2>
            <motion.p variants={fade} className="text-zinc-500 dark:text-zinc-400 mt-2">Start free. Upgrade when you need more.</motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            className="grid sm:grid-cols-3 gap-4"
          >
            {PLANS.map((plan) => {
              const isPro = plan.key === 'pro'
              return (
                <motion.div
                  key={plan.key}
                  variants={fade}
                  className={`relative bg-white dark:bg-zinc-950 rounded-xl p-6 border flex flex-col ${
                    isPro
                      ? 'border-primary-500 shadow-sm shadow-primary-500/10'
                      : 'border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-600 text-white text-[11px] font-medium px-3 py-0.5 rounded-full">Most popular</span>
                    </div>
                  )}
                  <div className="mb-5">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{plan.name}</p>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{plan.price}</span>
                      <span className="text-sm text-zinc-400 mb-0.5">/{plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-2.5 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <Check size={14} strokeWidth={2} className="text-primary-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={onGetStarted}
                    className={`w-full py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      isPro
                        ? 'bg-primary-600 hover:bg-primary-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <motion.div
          initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}
          variants={fade}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-4">Get started</p>
            <h2 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-3">
              Ready to ace your next interview?
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-8 text-sm leading-relaxed">
              No credit card required. Free tier includes 3 CV analyses and 5 mock interview questions every month.
            </p>
            <button
              onClick={onGetStarted}
              className="bg-primary-600 hover:bg-primary-500 text-white font-medium px-8 py-2.5 rounded-md text-sm transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              Start for free
              <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers size={16} strokeWidth={1.5} className="text-primary-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">HireIQ</span>
          </div>
          <p className="text-xs text-zinc-400">Built with FastAPI · LangChain · Groq · React · Tailwind CSS</p>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <a href="#" className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Terms</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
