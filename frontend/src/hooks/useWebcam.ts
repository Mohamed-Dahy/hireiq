import { useRef, useEffect, useState } from 'react'

export function useWebcam(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean) {
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      setError(null)
      return
    }
    setError(null)
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch((err: DOMException) => {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('permission')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('not-found')
        } else {
          setError('unknown')
        }
      })
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [active, videoRef])

  return { error }
}
