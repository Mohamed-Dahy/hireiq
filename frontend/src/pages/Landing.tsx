import { motion, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'

interface Props {
  onGetStarted: () => void
  onLogin: () => void
}

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'CV & JD Matching',
    desc: 'Upload your PDF CV and any job description. Our RAG pipeline scores compatibility from 0–100 in seconds.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'AI Skill Gap Analysis',
    desc: 'Groq-powered LLaMA 3 identifies your missing skills and suggests learning paths — streamed live to your screen.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    title: 'Mock Interview Engine',
    desc: 'Answer tailored questions by voice. Whisper transcribes your answer and LLaMA scores clarity, relevance, and depth.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
    title: 'Eye Contact Feedback',
    desc: 'OpenCV analyzes your webcam feed in real time and reports your eye contact ratio — just like a real interviewer would.',
  },
]

const steps = [
  { num: '01', title: 'Upload your CV', desc: 'Drop your PDF and paste the job description.' },
  { num: '02', title: 'Get your score', desc: 'Semantic + keyword matching returns a 0–100 match score instantly.' },
  { num: '03', title: 'Read the analysis', desc: 'Skill gaps and interview questions stream live from LLaMA 3.' },
  { num: '04', title: 'Practice & improve', desc: 'Record answers, get scored, and track your progress over time.' },
]

const stats = [
  { value: '100k', label: 'Tokens / day — free' },
  { value: '<2s', label: 'Match score latency' },
  { value: '4', label: 'AI signals combined' },
  { value: '100%', label: 'Free-tier powered' },
]

// Reusable animation variants following the skill's 150–300ms ease-out rule
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0, 0, 0.2, 1] } },
}

const staggerContainer = (staggerChildren = 0.1): Variants => ({
  hidden: {},
  show:   { transition: { staggerChildren } },
})

export default function Landing({ onGetStarted, onLogin }: Props) {
  const reduced = useReducedMotion()

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 overflow-x-hidden">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-purple-100"
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-bold text-purple-700 text-lg tracking-tight">HireIQ</span>
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              onClick={onLogin}
              whileHover={{ scale: reduced ? 1 : 1.03 }}
              whileTap={{ scale: reduced ? 1 : 0.97 }}
              transition={{ duration: 0.15 }}
              className="text-sm text-gray-600 hover:text-purple-700 font-medium transition-colors cursor-pointer"
            >
              Log in
            </motion.button>
            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: reduced ? 1 : 1.04 }}
              whileTap={{ scale: reduced ? 1 : 0.96 }}
              transition={{ duration: 0.15 }}
              className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors shadow-sm cursor-pointer"
            >
              Get started free
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-100 rounded-full blur-3xl opacity-50" />
        </div>

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium px-4 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            Powered by Groq · LLaMA 3 · 100% free tier
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight max-w-3xl mx-auto mb-6">
            Land your dream job with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-violet-500">
              AI-powered
            </span>{' '}
            interview coaching
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Upload your CV, match it to any job description, discover skill gaps, and practice
            answering tailored interview questions — all in one place.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: reduced ? 1 : 1.04, boxShadow: '0 20px 40px rgba(124,58,237,0.3)' }}
              whileTap={{ scale: reduced ? 1 : 0.97 }}
              transition={{ duration: 0.15 }}
              className="bg-purple-600 text-white px-8 py-3.5 rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 cursor-pointer"
            >
              Analyze my CV — it's free
            </motion.button>
            <motion.button
              onClick={onLogin}
              whileHover={{ scale: reduced ? 1 : 1.03 }}
              whileTap={{ scale: reduced ? 1 : 0.97 }}
              transition={{ duration: 0.15 }}
              className="border border-gray-200 text-gray-700 px-8 py-3.5 rounded-xl font-semibold text-sm hover:border-purple-300 hover:text-purple-700 transition-all cursor-pointer"
            >
              I have an account
            </motion.button>
          </motion.div>

          {/* Mock UI preview card */}
          <motion.div
            variants={fadeUp}
            className="mt-16 max-w-2xl w-full mx-auto bg-white rounded-2xl shadow-2xl shadow-purple-100 border border-purple-100 p-6 text-left"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-2 text-xs text-gray-400">hireiq.app</span>
            </div>
            <div className="flex items-center gap-6 mb-4">
              <div className="flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.5, ease: 'easeOut' }}
                  className="w-20 h-20 rounded-full border-4 border-purple-500 flex items-center justify-center"
                >
                  <span className="text-xl font-extrabold text-purple-600">87%</span>
                </motion.div>
                <span className="text-xs text-gray-400 mt-1">Match Score</span>
              </div>
              <div className="flex-1 flex flex-wrap gap-2">
                {['Python', 'FastAPI', 'Docker', 'Machine Learning'].map((s, i) => (
                  <motion.span
                    key={s}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + i * 0.08, duration: 0.2, ease: 'easeOut' }}
                    className="bg-purple-50 text-purple-700 text-xs px-3 py-1 rounded-full"
                  >
                    {s}
                  </motion.span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {[1, 0.8, 0.6].map((w, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 1 + i * 0.1, duration: 0.4, ease: 'easeOut' }}
                  className={`h-2.5 ${i === 2 ? 'bg-purple-50' : 'bg-purple-100'} rounded-full`}
                  style={{ width: `${w * 100}%` }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS ───────────────────────────────────────────────────────────── */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        variants={staggerContainer(0.1)}
        className="py-12 bg-purple-600"
      >
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <motion.div key={s.label} variants={fadeUp}>
              <p className="text-3xl font-extrabold text-white">{s.value}</p>
              <p className="text-sm text-purple-200 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer(0.08)}
            className="text-center mb-14"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold text-purple-600 uppercase tracking-widest mb-2">Features</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-gray-900">Everything you need to get hired</motion.h2>
            <motion.p variants={fadeUp} className="text-gray-500 mt-3 max-w-lg mx-auto">
              One platform combining CV analysis, LLM coaching, and voice mock interviews.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer(0.1)}
            className="grid sm:grid-cols-2 gap-6"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={reduced ? {} : { y: -4, boxShadow: '0 12px 32px rgba(124,58,237,0.1)' }}
                transition={{ duration: 0.2 }}
                className="group border border-gray-100 rounded-2xl p-6 hover:border-purple-200 transition-colors duration-200 cursor-default"
              >
                <motion.div
                  whileHover={reduced ? {} : { scale: 1.1, rotate: 4 }}
                  transition={{ duration: 0.2 }}
                  className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors duration-200"
                >
                  {f.icon}
                </motion.div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-purple-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer(0.08)}
            className="text-center mb-14"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold text-purple-600 uppercase tracking-widest mb-2">How it works</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl font-bold text-gray-900">From CV to interview-ready in minutes</motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer(0.12)}
            className="grid sm:grid-cols-2 gap-6"
          >
            {steps.map((s, i) => (
              <motion.div
                key={s.num}
                variants={fadeUp}
                whileHover={reduced ? {} : { y: -3 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl p-6 border border-purple-100 relative overflow-hidden"
              >
                <span className="absolute top-4 right-4 text-5xl font-black text-purple-50 select-none">{s.num}</span>
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center text-sm font-bold mb-3">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white text-center">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={staggerContainer(0.1)}
          className="max-w-2xl mx-auto"
        >
          <motion.div
            variants={fadeUp}
            className="bg-gradient-to-br from-purple-600 to-violet-600 rounded-3xl p-12 text-white shadow-2xl shadow-purple-200"
          >
            <h2 className="text-3xl font-extrabold mb-3">Ready to ace your next interview?</h2>
            <p className="text-purple-200 mb-8 text-sm leading-relaxed">
              No credit card. No subscriptions. Runs entirely on free-tier AI infrastructure.
            </p>
            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: reduced ? 1 : 1.05, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
              whileTap={{ scale: reduced ? 1 : 0.97 }}
              transition={{ duration: 0.15 }}
              className="bg-white text-purple-700 font-semibold px-8 py-3.5 rounded-xl text-sm hover:bg-purple-50 transition-colors shadow-lg cursor-pointer"
            >
              Start for free →
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 px-6 text-center text-sm text-gray-400">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-purple-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-semibold text-gray-600">HireIQ</span>
        </div>
        <p>Built with FastAPI · LangChain · Groq · React · Tailwind</p>
      </footer>

    </div>
  )
}
