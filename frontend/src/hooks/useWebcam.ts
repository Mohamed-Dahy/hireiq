import { useRef, useEffect } from 'react'

export function useWebcam(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean) {
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!active) {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      return
    }
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    })
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [active])
}
