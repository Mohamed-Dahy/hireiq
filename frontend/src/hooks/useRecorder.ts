import { useRef, useState } from 'react'

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      mediaRef.current = recorder
      setRecording(true)
    } catch (err) {
      const e = err as DOMException
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Enable it in your browser settings to record.')
      } else if (e.name === 'NotFoundError') {
        setError('No microphone detected.')
      } else {
        setError('Could not access microphone.')
      }
    }
  }

  const stop = () => {
    mediaRef.current?.stop()
    setRecording(false)
  }

  return { recording, audioBlob, start, stop, error }
}
