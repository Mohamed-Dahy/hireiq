import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, ArrowLeft, Layers } from 'lucide-react'
import OtpInput from '../components/OtpInput'
import api from '../api'

type OtpPurpose = 'registration' | 'password_reset' | 'password_change'

const TITLES: Record<OtpPurpose, string> = {
  registration: 'Verify your email',
  password_reset: 'Confirm password reset',
  password_change: 'Confirm password change',
}

const MASK_EMAIL = (email: string) => {
  const [name, domain] = email.split('@')
  return `${name[0] || ''}***@${domain || ''}`
}

interface VerifyOtpProps {
  email?: string
  purpose?: string
  onSuccess?: () => void
  onBack?: () => void
}

const VerifyOtp: React.FC<VerifyOtpProps> = ({ email: propEmail, purpose: propPurpose, onSuccess, onBack: propOnBack }) => {
  const params = new URLSearchParams(window.location.search)
  const rawPurpose = propPurpose || params.get('purpose') || 'registration'
  const email = propEmail || params.get('email') || ''
  const purpose = (rawPurpose === 'signup' ? 'registration' : rawPurpose) as OtpPurpose
  const purposeForApi = purpose === 'registration' ? 'registration' : purpose === 'password_change' ? 'password_change' : 'password_reset'

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(60)
  const [success, setSuccess] = useState(false)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleVerify = useCallback(async () => {
    if (!code || code.length !== 5) return
    setError('')
    setVerifying(true)
    try {
      const resp = await api.post('/auth/verify-otp', {
        email,
        code,
        purpose: purposeForApi,
      })
      setSuccess(true)
      if (purpose === 'registration') {
        setTimeout(() => onSuccess?.(), 1500)
      } else if (purpose === 'password_reset') {
        setResetToken(resp.data.reset_token)
      } else if (purpose === 'password_change') {
        setTimeout(() => onSuccess?.(), 1500)
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Verification failed'
      setError(detail)
    } finally {
      setVerifying(false)
    }
  }, [code, email, purpose, purposeForApi, onSuccess])

  const handleResetPassword = useCallback(async () => {
    if (!resetToken || !newPassword || newPassword.length < 6) return
    setError('')
    setResetting(true)
    try {
      await api.post('/auth/reset-password', {
        reset_token: resetToken,
        new_password: newPassword,
      })
      setTimeout(() => onSuccess?.(), 1500)
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Password reset failed'
      setError(detail)
    } finally {
      setResetting(false)
    }
  }, [resetToken, newPassword, onSuccess])

  const handleResend = useCallback(async () => {
    setError('')
    setResending(true)
    try {
      await api.post('/auth/send-otp', {
        email,
        purpose: purposeForApi,
      })
      setResendCooldown(60)
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to resend code'
      setError(detail)
    } finally {
      setResending(false)
    }
  }, [email, purposeForApi])

  const handleBack = () => {
    if (purpose === 'password_reset' && resetToken) {
      setResetToken(null)
      setSuccess(false)
      return
    }
    propOnBack?.()
  }

  if (success && purpose === 'password_reset' && resetToken) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md p-8">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={22} strokeWidth={1.5} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 text-center mb-6">Set new password</h2>
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">New password</label>
              <input
                type="password"
                placeholder="Min 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
            </div>
            <button
              onClick={handleResetPassword}
              disabled={resetting || newPassword.length < 6}
              className="w-full bg-blue-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {resetting ? <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> Resetting…</> : 'Reset password'}
            </button>
          </div>
          {error && <p className="text-red-600 dark:text-red-400 text-xs mt-3 text-center">{error}</p>}
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={22} strokeWidth={1.5} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
            {purpose === 'registration' ? 'Email verified!' : 'Code verified!'}
          </h2>
          <p className="text-sm text-zinc-500">
            {purpose === 'registration' ? 'You can now log in.' : 'Redirecting…'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-2 mb-8">
        <Layers size={20} strokeWidth={1.5} className="text-blue-600" />
        <span className="font-semibold text-zinc-900 dark:text-zinc-50 text-base tracking-tight">HireIQ</span>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md p-8">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 mb-6 transition-colors cursor-pointer">
          <ArrowLeft size={14} strokeWidth={1.5} /> Back
        </button>

        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
          {TITLES[purpose] || 'Verify'}
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Code sent to {MASK_EMAIL(email)}
        </p>

        <OtpInput onChange={setCode} disabled={verifying} error={!!error} />

        {error && (
          <p className="text-red-600 dark:text-red-400 text-xs mt-3 text-center">{error}</p>
        )}

        <button
          onClick={handleVerify}
          disabled={verifying || code.length !== 5}
          className="w-full bg-blue-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer mt-6 flex items-center justify-center gap-2"
        >
          {verifying ? <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> Verifying…</> : 'Verify'}
        </button>

        <div className="mt-4 text-center">
          <button
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
            className="text-sm text-blue-600 hover:text-blue-700 disabled:text-zinc-400 dark:disabled:text-zinc-600 transition-colors cursor-pointer"
          >
            {resending ? 'Sending…' : resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VerifyOtp
