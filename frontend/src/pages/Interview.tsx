import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useRecorder } from '../hooks/useRecorder'
import { useWebcam } from '../hooks/useWebcam'
import FeedbackPanel from '../components/FeedbackPanel'
import api from '../api'

interface Props {
  sessionId?: number
  questions?: string[]
}

export default function Interview({ sessionId, questions = [] }: Props) {
  const reduced = useReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [active, setActive] = useState(false)
  const [selectedQ, setSelectedQ] = useState(questions[0] ?? '')
  const [customQ, setCustomQ] = useState('')
  const { recording, audioBlob, start, stop } = useRecorder()
  const [feedback, setFeedback] = useState<null | {
    transcript: string
    clarity_score: number
    relevance_score: number
    depth_score: number
    eye_contact_ratio: number | null
  }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useWebcam(videoRef, active)

  const activeQuestion = selectedQ || customQ

  const submitAnswer = async () => {
    if (!audioBlob || !activeQuestion) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('audio', audioBlob, 'answer.webm')
      form.append('session_id', String(sessionId ?? 0))
      form.append('question', activeQuestion)
      const res = await api.post('/interview/answer', form)
      setFeedback(res.data)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : detail || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={reduced ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="max-w-2xl mx-auto py-12 px-4 space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Mock Interview</h2>
        <p className="text-sm text-gray-500">Enable your webcam, pick a question, then record your answer.</p>
      </div>

      {/* Question selector */}
      <div className="space-y-3">
        {questions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questions from your analysis</p>
            {questions.map((q, i) => (
              <motion.button
                key={i}
                whileHover={reduced ? {} : { x: 3 }}
                transition={{ duration: 0.15 }}
                onClick={() => { setSelectedQ(q); setCustomQ('') }}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors cursor-pointer ${
                  selectedQ === q
                    ? 'border-purple-500 bg-purple-50 text-purple-800 font-medium'
                    : 'border-gray-200 text-gray-700 hover:border-purple-300'
                }`}
              >
                <span className="text-purple-400 font-bold mr-2">Q{i + 1}</span>{q}
              </motion.button>
            ))}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {questions.length > 0 ? 'Or type your own question' : 'Type a question'}
          </p>
          <input
            type="text"
            placeholder="e.g. Tell me about a challenging project you worked on…"
            value={customQ}
            onChange={(e) => { setCustomQ(e.target.value); setSelectedQ('') }}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Session start */}
      {!active && (
        <motion.button
          onClick={() => setActive(true)}
          whileHover={reduced ? {} : { scale: 1.02 }}
          whileTap={reduced ? {} : { scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="bg-purple-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors cursor-pointer shadow-sm shadow-purple-100"
        >
          Enable Webcam & Start
        </motion.button>
      )}

      {active && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <div className="relative rounded-2xl overflow-hidden bg-gray-900">
            <video ref={videoRef} autoPlay muted className="w-full rounded-2xl" />
            {recording && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Recording
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {!recording ? (
              <motion.button
                onClick={start}
                disabled={!activeQuestion}
                whileHover={reduced ? {} : { scale: 1.03 }}
                whileTap={reduced ? {} : { scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="bg-red-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Record Answer
              </motion.button>
            ) : (
              <motion.button
                onClick={stop}
                whileHover={reduced ? {} : { scale: 1.03 }}
                whileTap={reduced ? {} : { scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-900 transition-colors cursor-pointer"
              >
                Stop Recording
              </motion.button>
            )}

            {audioBlob && !recording && (
              <motion.button
                onClick={submitAnswer}
                disabled={loading || !activeQuestion}
                whileHover={reduced ? {} : { scale: 1.03 }}
                whileTap={reduced ? {} : { scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {loading
                  ? <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Scoring…
                    </span>
                  : 'Submit Answer'
                }
              </motion.button>
            )}
          </div>

          {!activeQuestion && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              Select or type a question before recording.
            </p>
          )}

          {error && (
            <motion.p
              initial={reduced ? {} : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg"
            >
              {error}
            </motion.p>
          )}
        </motion.div>
      )}

      {/* Feedback */}
      {feedback && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0, 0, 0.2, 1] }}
          className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Your Feedback</h3>
          <FeedbackPanel
            transcript={feedback.transcript}
            clarity={feedback.clarity_score}
            relevance={feedback.relevance_score}
            depth={feedback.depth_score}
            eyeContact={feedback.eye_contact_ratio != null ? Math.round(feedback.eye_contact_ratio * 100) : -1}
          />
        </motion.div>
      )}
    </motion.div>
  )
}
