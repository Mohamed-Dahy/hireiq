import { useState, useEffect, useRef, useCallback } from 'react'

interface OtpInputProps {
  onChange: (code: string) => void
  disabled?: boolean
  error?: boolean
}

const OtpInput: React.FC<OtpInputProps> = ({ onChange, disabled = false, error = false }) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const [values, setValues] = useState<string[]>(Array(5).fill(''))

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  const triggerChange = useCallback((vals: string[]) => {
    const code = vals.join('')
    if (code.length === 5) onChange(code)
  }, [onChange])

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return
    const next = [...values]
    next[index] = value
    setValues(next)
    if (value && index < 4) inputsRef.current[index + 1]?.focus()
    triggerChange(next)
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace') return
    if (!values[index] && index > 0) {
      const next = [...values]
      next[index - 1] = ''
      setValues(next)
      inputsRef.current[index - 1]?.focus()
      triggerChange(next)
    } else {
      const next = [...values]
      next[index] = ''
      setValues(next)
      triggerChange(next)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5)
    if (!pasted) return
    const next = Array(5).fill('')
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setValues(next)
    inputsRef.current[Math.min(pasted.length, 4)]?.focus()
    triggerChange(next)
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 5 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el }}
          type="text"
          maxLength={1}
          inputMode="numeric"
          pattern="[0-9]"
          disabled={disabled}
          value={values[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className={`w-12 h-12 text-center text-xl border-2 rounded-lg transition-colors ${
            error
              ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
              : 'border-zinc-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          } bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none disabled:opacity-50`}
        />
      ))}
    </div>
  )
}

export default OtpInput
