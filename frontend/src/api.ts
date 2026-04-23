import axios from 'axios'

const api = axios.create({ baseURL: '/' })
export default api

// Attach JWT to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Network connectivity tracking ────────────────────────────────────────────
// Dispatches 'network:offline' / 'network:online' on transitions only,
// so App.tsx can show / hide the "server unreachable" banner.
let _offline = false

// ── Token refresh interceptor ────────────────────────────────────────────────
let isRefreshing = false
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

const flushQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)))
  failedQueue = []
}

api.interceptors.response.use(
  (res) => {
    // Transition: was offline, now a response succeeded → back online
    if (_offline) {
      _offline = false
      window.dispatchEvent(new CustomEvent('network:online'))
    }
    return res
  },
  async (error) => {
    const original = error.config

    // No response at all → backend unreachable
    if (!error.response) {
      if (!_offline) {
        _offline = true
        window.dispatchEvent(new CustomEvent('network:offline'))
      }
      return Promise.reject(error)
    }

    // Transition back from network error (got a real HTTP error, server IS up)
    if (_offline) {
      _offline = false
      window.dispatchEvent(new CustomEvent('network:online'))
    }

    // Pass through non-401 errors or already-retried requests
    if (error.response.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    // Queue concurrent 401s while a refresh is in flight
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    const storedRefresh = localStorage.getItem('refresh_token')
    if (!storedRefresh) {
      isRefreshing = false
      localStorage.clear()
      window.dispatchEvent(new CustomEvent('auth:expired'))
      return Promise.reject(error)
    }

    try {
      // Use base axios (not `api`) to skip this interceptor on the refresh call
      const { data } = await axios.post<TokenResponse>('/auth/refresh', { refresh_token: storedRefresh })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`
      flushQueue(null, data.access_token)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return api(original)
    } catch (refreshError) {
      flushQueue(refreshError, null)
      localStorage.clear()
      window.dispatchEvent(new CustomEvent('auth:expired'))
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

// ── Types ────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserProfile {
  id: number
  email: string
  username: string
  created_at: string
  total_sessions: number
  avg_match_score: number | null
  total_interviews: number
  best_score: number | null
}

export interface CVUploadResponse {
  session_id: number
  cv_filename: string
  match_score: number
  skills_found: string[]
}

export interface CVSession {
  id: number
  cv_filename: string
  match_score: number | null
  created_at: string
}

export interface InterviewResult {
  id: number
  question: string
  transcript: string | null
  clarity_score: number | null
  relevance_score: number | null
  depth_score: number | null
  eye_contact_ratio: number | null
  created_at: string
}

export interface CVSessionDetail extends CVSession {
  interview_results: InterviewResult[]
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const register = (email: string, username: string, password: string) =>
  api.post<TokenResponse>('/auth/register', { email, username, password })

export const login = (email: string, password: string) =>
  api.post<TokenResponse>('/auth/login', { email, password })

export const getMe = () =>
  api.get<UserProfile>('/auth/me')

// ── CV ───────────────────────────────────────────────────────────────────────

export const uploadCV = (file: File, jdText: string) => {
  const form = new FormData()
  form.append('cv_file', file)
  form.append('jd_text', jdText)
  return api.post<CVUploadResponse>('/cv/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const getScore = (sessionId: number) =>
  api.get<{ session_id: number; match_score: number }>(`/cv/${sessionId}/score`)

export const getSessions = () =>
  api.get<CVSession[]>('/cv/sessions')

export const getSessionDetail = (sessionId: number) =>
  api.get<CVSessionDetail>(`/cv/${sessionId}/detail`)

export const deleteSession = (sessionId: number) =>
  api.delete(`/cv/${sessionId}`)

// ── Analysis (SSE stream) ─────────────────────────────────────────────────────

export const startAnalysisStream = (sessionId: number): EventSource =>
  new EventSource(`/analyze?session_id=${sessionId}&token=${localStorage.getItem('access_token')}`)
