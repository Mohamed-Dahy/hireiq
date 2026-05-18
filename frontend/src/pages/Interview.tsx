import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
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
  const { recording, audioBlob, start, stop, error: micError } = useRecorder()
  const [feedback, setFeedback] = useState<null | {
    transcript: string
    clarity_score: number
    relevance_score: number
    depth_score: number
    eye_contact_ratio: number | null
  }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { error: camError } = useWebcam(videoRef, active)
  const framesRef = useRef<Blob[]>([])

  // Capture a JPEG frame every 500 ms while recording
  useEffect(() => {
    if (!recording) return
    framesRef.current = []
    const id = setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 320
      canvas.height = video.videoHeight || 240
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      canvas.toBlob((b) => { if (b) framesRef.current.push(b) }, 'image/jpeg', 0.7)
    }, 500)
    return () => clearInterval(id)
  }, [recording])

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
      const answerData = res.data

      let eyeContactRatio: number | null = null
      const frames = framesRef.current
      if (frames.length > 0 && !camError) {
        try {
          const ecForm = new FormData()
          ecForm.append('result_id', String(answerData.id))
          frames.forEach((f, i) => ecForm.append('frames', f, `frame_${i}.jpg`))
          const ecRes = await api.post('/interview/eye-contact', ecForm)
          eyeContactRatio = ecRes.data.eye_contact_ratio
        } catch {
          // Eye contact is optional — don't fail the whole submission
        }
      }

      framesRef.current = []
      setFeedback({ ...answerData, eye_contact_ratio: eyeContactRatio })
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
      className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight mb-1">Mock Interview</h2>
        <p className="text-sm text-zinc-500">Enable your webcam, pick a question, then record your answer.</p>
      </div>

      {/* Question selector */}
      <div className="space-y-3">
        {questions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">Questions from your analysis</p>
            {questions.map((q, i) => (
              <button
                key={i}
                onClick={() => { setSelectedQ(q); setCustomQ('') }}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors cursor-pointer ${
                  selectedQ === q
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 font-medium'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'
                }`}
              >
                <span className="text-primary-500 font-medium mr-2">Q{i + 1}</span>{q}
              </button>
            ))}
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">
            {questions.length > 0 ? 'Or type your own question' : 'Type a question'}
          </p>
          <input
            type="text"
            placeholder="e.g. Tell me about a challenging project you worked on…"
            value={customQ}
            onChange={(e) => { setCustomQ(e.target.value); setSelectedQ('') }}
            className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          />
        </div>
      </div>

      {/* Session start */}
      {!active && (
        <button
          onClick={() => setActive(true)}
          className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
        >
          Enable Webcam &amp; Start
        </button>
      )}

      {active && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {camError ? (
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5 text-amber-600 dark:text-amber-400">
                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
                    {camError === 'permission' && 'Camera permission denied'}
                    {camError === 'not-found' && 'No camera detected'}
                    {camError === 'unknown' && 'Could not access camera'}
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-3 leading-relaxed">
                    {camError === 'permission' && 'HireIQ needs camera access to track your eye contact. Click the camera icon in your address bar, select "Allow", then click Try again.'}
                    {camError === 'not-found' && 'Make sure a webcam is connected to your device, then click Try again.'}
                    {camError === 'unknown' && 'Something went wrong accessing your camera. Try refreshing the page.'}
                  </p>
                  <button
                    onClick={() => { setActive(false); setTimeout(() => setActive(true), 100) }}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-zinc-900">
              <video ref={videoRef} autoPlay muted className="w-full rounded-xl" />
              {recording && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Recording
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {!recording ? (
              <button
                onClick={start}
                disabled={!activeQuestion}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 transition-colors cursor-pointer"
              >
                Record Answer
              </button>
            ) : (
              <button
                onClick={stop}
                className="bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                Stop Recording
              </button>
            )}

            {audioBlob && !recording && (
              <button
                onClick={submitAnswer}
                disabled={loading || !activeQuestion}
                className="bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> Scoring…</>
                ) : 'Submit Answer'}
              </button>
            )}
          </div>

          {!activeQuestion && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-lg">
              Select or type a question before recording.
            </p>
          )}

          {micError && (
            <motion.p
              initial={reduced ? {} : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-amber-700 dark:text-amber-300 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded-lg"
            >
              {micError}
            </motion.p>
          )}

          {error && (
            <motion.p
              initial={reduced ? {} : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg"
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
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6"
        >
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4">Your Feedback</h3>
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
