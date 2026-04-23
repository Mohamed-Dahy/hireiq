import axios from 'axios'

const api = axios.create({ baseURL: '/' })
export default api

// Attach JWT token to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

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

export const refresh = (refresh_token: string) =>
  api.post<TokenResponse>('/auth/refresh', { refresh_token })

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
