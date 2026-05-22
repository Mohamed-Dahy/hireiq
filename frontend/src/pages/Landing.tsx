import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers, FileText, Sparkles, Mic, Eye, Briefcase, Users,
  Check, ArrowRight, Moon, Sun, ChevronDown, Menu, X,
  Zap, Shield, Star, BarChart2,
} from 'lucide-react'
import { PLANS, TESTIMONIALS } from '../lib/constants'

interface Props {
  onGetStarted: () => void
  onLogin: () => void
  dark: boolean
  onToggleDark: () => void
}

const services = [
  { icon: FileText,  color: 'bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400',  title: 'CV & JD Matching',       desc: 'Semantic + keyword scoring, 0–100 match in seconds.' },
  { icon: Sparkles,  color: 'bg-accent-50 dark:bg-accent-950/50 text-accent-600 dark:text-accent-400',      title: 'AI Skill Gap Analysis',   desc: 'LLaMA 3 identifies gaps and builds a learning roadmap.' },
  { icon: Mic,       color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',          title: 'Mock Interview Engine',   desc: 'Voice answers scored on clarity, relevance, and depth.' },
  { icon: Eye,       color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',  title: 'Eye Contact Feedback',    desc: 'OpenCV tracks eye contact ratio in real time.' },
  { icon: Briefcase, color: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',              title: 'ATS Job Tracker',         desc: 'Kanban for applications with AI prep questions per role.' },
  { icon: Users,     color: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',              title: 'Recruiter Dashboard',     desc: 'Compare candidates side-by-side. Export shortlists to PDF.' },
]

const platform = [
  { icon: Zap,      title: 'Sub-2 s match speed',  desc: 'Results returned before you finish blinking.' },
  { icon: BarChart2, title: '6+ AI signals',        desc: 'Embedding, keyword, tone, structure & more.' },
  { icon: Shield,   title: 'GDPR compliant',        desc: 'Your data stays private — zero ads, zero selling.' },
  { icon: Star,     title: 'Free tier forever',     desc: 'No credit card. Upgrade only when ready.' },
]

const steps = [
  { num: '01', title: 'Upload your CV',     desc: 'Drop your PDF and paste a job description.' },
  { num: '02', title: 'Get your score',     desc: 'Semantic + keyword matching returns a 0–100 score instantly.' },
  { num: '03', title: 'Read the analysis',  desc: 'Skill gaps and tailored questions stream live from LLaMA 3.' },
  { num: '04', title: 'Practice & improve', desc: 'Record answers, get scored on 3 dimensions, track progress.' },
]

const stats = [
  { value: '< 2s',  label: 'Match score latency' },
  { value: '6+',    label: 'AI signals combined' },
  { value: '100%',  label: 'Free tier available' },
  { value: '3 min', label: 'Avg time to insights' },
]

const fade = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } }

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return
      handler()
    }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler])
}

export default function Landing({ onGetStarted, onLogin, dark, onToggleDark }: Props) {
  const [servicesOpen, setServicesOpen] = useState(false)
  const [platformOpen, setPlatformOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const servicesRef = useRef<HTMLDivElement>(null)
  const platformRef = useRef<HTMLDivElement>(null)

  useClickOutside(servicesRef, () => setServicesOpen(false))
  useClickOutside(platformRef, () => setPlatformOpen(false))

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-50 overflow-x-hidden">

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} strokeWidth={1.5} className="text-primary-500" />
            <span className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm tracking-tight">HireIQ</span>
          </div>

          <div className="hidden sm:flex items-center gap-1">
            {/* Services dropdown */}
            <div ref={servicesRef} className="relative">
              <button
                onClick={() => { setServicesOpen(v => !v); setPlatformOpen(false) }}
                className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${servicesOpen ? 'text-zinc-900 dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              >
                Services
                <ChevronDown size={13} strokeWidth={2} className={`transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {servicesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute top-full left-0 mt-2 w-[480px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl shadow-zinc-200/50 dark:shadow-zinc-950/60 overflow-hidden"
                  >
                    <div className="p-4">
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3 px-1">What HireIQ does</p>
                      <div className="grid grid-cols-2 gap-1">
                        {services.map((s) => (
                          <button
                            key={s.title}
                            onClick={() => { setServicesOpen(false); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }}
                            className="flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left cursor-pointer group"
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                              <s.icon size={15} strokeWidth={1.5} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{s.title}</p>
                              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 leading-snug">{s.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-3 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">6 features · AI-powered · Free to start</span>
                      <button onClick={() => { setServicesOpen(false); onGetStarted() }} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 cursor-pointer flex items-center gap-1">
                        Try it free <ArrowRight size={11} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Platform / Why HireIQ dropdown */}
            <div ref={platformRef} className="relative">
              <button
                onClick={() => { setPlatformOpen(v => !v); setServicesOpen(false) }}
                className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${platformOpen ? 'text-zinc-900 dark:text-zinc-50 bg-zinc-100 dark:bg-zinc-800' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              >
                Why HireIQ
                <ChevronDown size={13} strokeWidth={2} className={`transition-transform duration-200 ${platformOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {platformOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl shadow-zinc-200/50 dark:shadow-zinc-950/60 overflow-hidden"
                  >
                    <div className="p-4 space-y-1">
                      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3 px-1">The HireIQ difference</p>
                      {platform.map((p) => (
                        <div key={p.title} className="flex items-start gap-3 p-2.5 rounded-xl">
                          <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center shrink-0">
                            <p.icon size={14} strokeWidth={1.5} className="text-primary-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{p.title}</p>
                            <p className="text-xs text-zinc-400 mt-0.5">{p.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
                      <a href="#how-it-works" onClick={() => setPlatformOpen(false)} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 cursor-pointer flex items-center gap-1">
                        See how it works <ArrowRight size={11} />
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <a href="#pricing" className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900">Pricing</a>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onToggleDark} aria-label="Toggle theme"
              className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
              {dark ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
            </button>
            <button onClick={onLogin} className="hidden sm:block text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors cursor-pointer px-2 py-1">
              Sign in
            </button>
            <button onClick={onGetStarted} className="hidden sm:block text-sm bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer">
              Get started
            </button>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Menu"
              className="sm:hidden w-8 h-8 flex items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              {mobileOpen ? <X size={17} strokeWidth={1.5} /> : <Menu size={17} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile nav drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40 sm:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
              className="fixed top-14 left-0 right-0 z-40 sm:hidden bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 shadow-lg"
            >
              <div className="px-5 py-4 flex flex-col gap-1">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Navigate</p>
                <button
                  onClick={() => { setMobileOpen(false); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }}
                  className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 py-2.5 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer"
                >
                  Services
                </button>
                <button
                  onClick={() => { setMobileOpen(false); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }) }}
                  className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 py-2.5 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer"
                >
                  Why HireIQ
                </button>
                <a
                  href="#pricing"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 py-2.5 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer"
                >
                  Pricing
                </a>
                <div className="flex gap-2 pt-3">
                  <button onClick={() => { setMobileOpen(false); onLogin() }} className="flex-1 text-sm border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 py-2.5 rounded-xl font-medium transition-colors cursor-pointer">
                    Sign in
                  </button>
                  <button onClick={() => { setMobileOpen(false); onGetStarted() }} className="flex-1 text-sm bg-primary-600 hover:bg-primary-500 text-white py-2.5 rounded-xl font-medium transition-colors cursor-pointer">
                    Get started
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="pt-36 pb-24 px-6 relative">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary-500/5 dark:bg-primary-500/8 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
          className="max-w-4xl mx-auto text-center relative"
        >
          <motion.div variants={fade} className="inline-flex items-center gap-2 bg-primary-50 dark:bg-primary-950/60 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
            Now with voice-based interview scoring
            <ArrowRight size={11} />
          </motion.div>

          <motion.h1 variants={fade} className="text-5xl sm:text-6xl lg:text-[68px] font-bold text-zinc-900 dark:text-zinc-50 leading-[1.06] tracking-tight mb-6">
            The AI career<br className="hidden sm:block" />{' '}
            <span className="bg-linear-to-r from-primary-600 via-primary-500 to-accent-500 bg-clip-text text-transparent">
              intelligence platform
            </span>
          </motion.h1>

          <motion.p variants={fade} className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-8 leading-relaxed">
            Match your CV to any job description, discover skill gaps, and practice interviews — powered by LLaMA 3 and Whisper AI.
          </motion.p>

          {/* Social proof */}
          <motion.div variants={fade} className="flex items-center justify-center gap-3 mb-8">
            <div className="flex -space-x-2">
              {['A', 'M', 'S', 'D', 'R'].map((l, i) => (
                <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 border-white dark:border-zinc-950" style={{ background: ['#2563eb','#0d9488','#d97706','#059669','#2563eb'][i], color: 'white' }}>
                  {l}
                </div>
              ))}
            </div>
            <div className="text-left">
              <div className="flex gap-0.5 mb-0.5">
                {[1,2,3,4,5].map(i => <svg key={i} viewBox="0 0 20 20" fill="#3b82f6" className="w-3 h-3"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
              </div>
              <p className="text-xs text-zinc-500"><span className="font-semibold text-zinc-800 dark:text-zinc-200">2,000+</span> job seekers trust HireIQ</p>
            </div>
          </motion.div>

          <motion.div variants={fade} className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <button onClick={onGetStarted}
              className="bg-primary-600 hover:bg-primary-500 text-white px-7 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2 shadow-lg shadow-primary-500/25">
              Analyze my CV — it's free
              <ArrowRight size={14} strokeWidth={2} />
            </button>
            <button onClick={onLogin}
              className="border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-7 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer">
              Sign in to existing account
            </button>
          </motion.div>

          <motion.div variants={fade} className="flex flex-wrap items-center justify-center gap-5 mt-6 text-xs text-zinc-400">
            {['Free tier · no credit card', 'GDPR compliant', 'Open-source backend'].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <Check size={11} strokeWidth={2.5} className="text-primary-500" />
                {t}
              </span>
            ))}
          </motion.div>

          {/* Product preview card */}
          <motion.div
            variants={fade}
            className="mt-16 max-w-2xl w-full mx-auto bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl shadow-zinc-200/60 dark:shadow-zinc-950/60 text-left"
          >
            {/* Gradient header bar */}
            <div className="h-1.5 bg-linear-to-r from-primary-500 via-primary-400 to-accent-500" />
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div className="flex-1 mx-3 h-5 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center px-2.5">
                <span className="text-[11px] text-zinc-400 font-mono">hireiq.app · Analysis</span>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-zinc-500 mb-1 font-medium uppercase tracking-widest">Match Score</p>
                  <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums leading-none">
                    87<span className="text-2xl text-primary-400 font-normal">%</span>
                  </p>
                  <p className="text-xs text-emerald-500 font-medium mt-1">Strong match ↑</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500 mb-1">Analyzed</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium font-mono">senior-eng-cv.pdf</p>
                  <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800">Gap analysis</span>
                </div>
              </div>
              <div className="mb-5">
                <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Matched Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Python', 'FastAPI', 'Docker', 'PostgreSQL', 'Redis'].map((s) => (
                    <span key={s} className="bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 text-xs px-2.5 py-1 rounded-full border border-primary-200 dark:border-primary-800 font-medium">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Priority Skill Gaps</p>
                <div className="space-y-2.5">
                  {[{ label: 'Kubernetes', w: 85 }, { label: 'Terraform', w: 62 }, { label: 'OpenTelemetry', w: 44 }].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500 w-28 font-mono shrink-0">{item.label}</span>
                      <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-linear-to-r from-primary-500 to-primary-400 rounded-full" style={{ width: `${item.w}%` }} />
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
      <section className="border-y border-zinc-200 dark:border-zinc-800 py-10 bg-zinc-50 dark:bg-zinc-900/60">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map((s, i) => (
            <div key={s.label}>
              <p className={`text-2xl font-bold tracking-tight ${i === 0 ? 'text-primary-600 dark:text-primary-400' : i === 1 ? 'text-accent-600 dark:text-accent-400' : 'text-zinc-900 dark:text-zinc-50'}`}>{s.value}</p>
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
            <motion.p variants={fade} className="text-xs font-semibold text-primary-500 uppercase tracking-widest mb-3">Features</motion.p>
            <motion.h2 variants={fade} className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight max-w-md">
              Everything you need to get hired
            </motion.h2>
            <motion.p variants={fade} className="text-zinc-500 dark:text-zinc-400 mt-3 max-w-lg">
              One platform combining CV analysis, LLM coaching, and voice mock interviews.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {services.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fade}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:shadow-lg hover:shadow-zinc-100 dark:hover:shadow-zinc-900 hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color} transition-transform group-hover:scale-110 duration-200`}>
                  <f.icon size={18} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{f.title}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
                {i === 0 && <span className="inline-block mt-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800">Core feature</span>}
                {i === 1 && <span className="inline-block mt-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-950/50 text-accent-600 dark:text-accent-400 border border-accent-200 dark:border-accent-800">AI-powered</span>}
                {i === 2 && <span className="inline-block mt-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Voice scoring</span>}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-zinc-50 dark:bg-zinc-900/60 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="mb-10 text-center"
          >
            <motion.p variants={fade} className="text-xs font-semibold text-primary-500 uppercase tracking-widest mb-3">Testimonials</motion.p>
            <motion.h2 variants={fade} className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Real results from real job seekers</motion.h2>
          </motion.div>
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
            className="grid sm:grid-cols-3 gap-4"
          >
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                variants={fade}
                className={`bg-white dark:bg-zinc-950 border rounded-2xl p-6 flex flex-col ${
                  i === 0
                    ? 'border-primary-200 dark:border-primary-900 shadow-md shadow-primary-500/5'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(j => (
                    <svg key={j} viewBox="0 0 20 20" fill="#3b82f6" className="w-3.5 h-3.5">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed flex-1 mb-4">"{t.text}"</p>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {t.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{t.role}</p>
                  </div>
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
            className="mb-14 text-center"
          >
            <motion.p variants={fade} className="text-xs font-semibold text-primary-500 uppercase tracking-widest mb-3">How it works</motion.p>
            <motion.h2 variants={fade} className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              From CV to interview-ready in minutes
            </motion.h2>
          </motion.div>
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 relative"
          >
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                variants={fade}
                className="relative border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 bg-white dark:bg-zinc-900 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-2xl font-bold text-zinc-100 dark:text-zinc-800 tabular-nums font-mono select-none">{s.num}</span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{s.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-zinc-50 dark:bg-zinc-900/60 border-y border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="mb-12 text-center"
          >
            <motion.p variants={fade} className="text-xs font-semibold text-primary-500 uppercase tracking-widest mb-3">Pricing</motion.p>
            <motion.h2 variants={fade} className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Simple, transparent pricing</motion.h2>
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
                  className={`relative bg-white dark:bg-zinc-950 rounded-2xl p-6 border flex flex-col transition-shadow ${
                    isPro
                      ? 'border-primary-500 shadow-lg shadow-primary-500/10 ring-1 ring-primary-500/20'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-600 text-white text-[11px] font-semibold px-3 py-0.5 rounded-full shadow-sm">Most popular</span>
                    </div>
                  )}
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{plan.name}</p>
                    <div className="mt-3 flex items-end gap-1">
                      <span className={`text-3xl font-bold ${isPro ? 'text-primary-600 dark:text-primary-400' : 'text-zinc-900 dark:text-zinc-50'}`}>{plan.price}</span>
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
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                      isPro
                        ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-sm shadow-primary-500/20'
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
          className="max-w-3xl mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-primary-600 via-primary-700 to-primary-900 p-12 text-center">
            {/* Decorative blobs */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
            <div className="absolute top-1/2 right-1/4 w-20 h-20 rounded-full bg-accent-500/20" />

            <div className="relative">
              <p className="text-xs font-semibold text-primary-200 uppercase tracking-widest mb-4">Get started today</p>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-3">
                Ready to ace your next interview?
              </h2>
              <p className="text-primary-200 mb-8 text-sm leading-relaxed">
                No credit card required. Free tier includes 2 CV analyses every 10 days and unlimited mock interview questions.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={onGetStarted}
                  className="bg-white text-primary-700 font-semibold px-8 py-3 rounded-xl text-sm transition-colors cursor-pointer inline-flex items-center gap-2 hover:bg-primary-50 shadow-lg">
                  Start for free
                  <ArrowRight size={14} strokeWidth={2} />
                </button>
                <button onClick={onLogin}
                  className="text-primary-200 hover:text-white text-sm font-medium cursor-pointer transition-colors flex items-center gap-1">
                  Already have an account? Sign in →
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-10 px-6 bg-zinc-50 dark:bg-zinc-900/40">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers size={16} strokeWidth={1.5} className="text-primary-500" />
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">HireIQ</span>
              </div>
              <p className="text-xs text-zinc-500 max-w-xs">AI-powered career intelligence. Match CVs, close skill gaps, practice interviews.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2 uppercase tracking-widest">Product</p>
                <div className="space-y-1.5">
                  <a href="#features" className="block text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Features</a>
                  <a href="#pricing" className="block text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Pricing</a>
                  <a href="#how-it-works" className="block text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">How it works</a>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2 uppercase tracking-widest">For</p>
                <div className="space-y-1.5">
                  <span className="block text-xs text-zinc-500">Job seekers</span>
                  <span className="block text-xs text-zinc-500">Recruiters</span>
                  <span className="block text-xs text-zinc-500">Teams</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-2 uppercase tracking-widest">Legal</p>
                <div className="space-y-1.5">
                  <a href="#" className="block text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Privacy</a>
                  <a href="#" className="block text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Terms</a>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-zinc-400">© 2026 HireIQ. Built with FastAPI · LangChain · Groq · React · Tailwind CSS</p>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
