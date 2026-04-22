import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { uploadCV } from '../api'
import type { CVUploadResponse } from '../api'

interface Props {
  onDone: (result: CVUploadResponse) => void
}

export default function Upload({ onDone }: Props) {
  const reduced = useReducedMotion()
  const [file, setFile] = useState<File | null>(null)
  const [jd, setJd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

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
            animate={file ? { scale: reduced ? 1 : 1.1 } : { scale: 1 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-2"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-1 ${file ? 'bg-purple-100' : 'bg-gray-100'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke={file ? '#7c3aed' : '#9ca3af'} strokeWidth="1.8" className="w-6 h-6">
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {file
              ? <p className="text-sm font-semibold text-purple-700">{file.name}</p>
              : <>
                  <p className="text-sm font-medium text-gray-600">Drop your PDF here or click to browse</p>
                  <p className="text-xs text-gray-400">PDF files only</p>
                </>
            }
          </motion.div>
        </motion.div>

        {/* JD textarea */}
        <textarea
          placeholder="Paste the job description here…"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={8}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
        />

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
