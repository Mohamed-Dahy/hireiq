import axios from 'axios'

const api = axios.create({
  baseURL: '/',
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
})
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

    // Skip refresh for auth endpoints — their 401s are credential errors, not expired tokens
    const AUTH_NO_REFRESH = [
      '/auth/login', '/auth/register', '/auth/verify-email',
      '/auth/resend-verification', '/auth/forgot-password',
      '/auth/reset-password', '/auth/refresh',
    ]
    const isAuthEndpoint = AUTH_NO_REFRESH.some(ep => original.url?.includes(ep))

    // Pass through non-401 errors, already-retried requests, or auth endpoint 401s
    if (error.response.status !== 401 || original._retry || isAuthEndpoint) {
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

export interface RegisterResponse {
  message: string
  email: string
}

export interface MessageResponse {
  message: string
}

export interface RecentSession {
  id: number
  cv_filename: string
  match_score: number | null
  created_at: string
  has_gap_report: boolean
  jd_snippet: string | null
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
  sessions_this_month: number
  roadmaps_generated: number
  recent_sessions: RecentSession[]
  // Phase 7 profile extensions
  is_admin: boolean
  tier: string
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  bio: string | null
  stored_cv_filename: string | null
  has_stored_cv: boolean
  analyses_in_window: number
  window_resets_at: string | null
}

export interface CVUploadResponse {
  session_id: number
  cv_filename: string
  match_score: number
  skills_found: string[]
  is_linkedin?: boolean
}

export interface SkillItem {
  skill: string
  category: string
  level: string
}

export interface GapItem {
  skill: string
  importance: string
  reason: string
  resource: string
}

export interface RoadmapItem {
  topic: string
  priority: string
  estimated_hours: number
  resources: string[]
}

export interface QuestionItem {
  question: string
  model_answer: string
}

export interface StructuredAnalysis {
  candidate_level?: string
  skill_inventory: SkillItem[]
  gap_report: GapItem[]
  study_roadmap: RoadmapItem[]
  questions?: QuestionItem[]
}

export interface CVSession {
  id: number
  cv_filename: string
  match_score: number | null
  created_at: string
  has_gap_report: boolean
  jd_snippet: string | null
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
  api.post<RegisterResponse>('/auth/register', { email, username, password })

export const login = (email: string, password: string) =>
  api.post<TokenResponse>('/auth/login', { email, password })

export const logout = (refreshToken?: string) =>
  api.post<MessageResponse>('/auth/logout', refreshToken ? { refresh_token: refreshToken } : {})

export const verifyEmail = (token: string) =>
  api.post<MessageResponse>('/auth/verify-email', { token })

export const resendVerification = (email: string) =>
  api.post<MessageResponse>('/auth/resend-verification', { email })

export const forgotPassword = (email: string) =>
  api.post<MessageResponse>('/auth/forgot-password', { email })

export const resetPassword = (token: string, newPassword: string) =>
  api.post<MessageResponse>('/auth/reset-password', { token, new_password: newPassword })

export const getMe = () =>
  api.get<UserProfile>('/auth/me')

export const deleteAccount = () =>
  api.delete<MessageResponse>('/auth/account')

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

export const getEnhancedAnalysis = (sessionId: number) =>
  api.get<StructuredAnalysis>(`/cv/${sessionId}/analysis`)

// ── Phase 6: ATS Job Tracker ─────────────────────────────────────────────────

export type JobStatus =
  | 'saved' | 'applied' | 'phone_screen' | 'technical'
  | 'final_round' | 'offer' | 'accepted' | 'rejected' | 'withdrawn'

export interface JobApplication {
  id: number
  company: string
  title: string
  location: string | null
  remote_type: string | null
  job_url: string | null
  jd_text: string | null
  status: JobStatus
  source: string | null
  priority: string | null
  deadline_date: string | null
  followup_date: string | null
  applied_date: string | null
  salary_min: number | null
  salary_max: number | null
  notes: string | null
  cover_letter: string | null
  rejection_reason: string | null
  cv_session_id: number | null
  match_score: number | null
  ai_gap_summary: string | null
  ai_prep_questions: string | null
  stage_entered_at: string
  is_archived: boolean
  is_stale: boolean
  created_at: string
  updated_at: string
}

export interface ActivityResponse {
  id: number
  job_application_id: number
  event_type: string
  event_date: string
  notes: string | null
  created_at: string
}

export interface ContactResponse {
  id: number
  job_application_id: number
  name: string
  role: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  notes: string | null
  created_at: string
}

export interface JobStatsResponse {
  total_active: number
  by_status: Record<string, number>
  by_source: Record<string, number>
  response_rate: number
  interview_rate: number
  offer_rate: number
  stale_count: number
  upcoming_count: number
  weekly_trend: { week: string; count: number }[]
}

export interface JobFilters {
  status?: string
  priority?: string
  is_archived?: boolean
}

export interface CreateJobPayload {
  company: string
  title: string
  location?: string
  remote_type?: string
  job_url?: string
  jd_text?: string
  source?: string
  priority?: string
  deadline_date?: string
  followup_date?: string
  salary_min?: number
  salary_max?: number
  notes?: string
}

export const getJobs = (filters?: JobFilters) =>
  api.get<JobApplication[]>('/jobs', { params: filters })

export const createJob = (data: CreateJobPayload) =>
  api.post<JobApplication>('/jobs', data)

export const getJob = (id: number) =>
  api.get<JobApplication>(`/jobs/${id}`)

export const updateJob = (id: number, data: Partial<CreateJobPayload>) =>
  api.patch<JobApplication>(`/jobs/${id}`, data)

export const deleteJob = (id: number) =>
  api.delete<JobApplication>(`/jobs/${id}`)

export const transitionStatus = (id: number, newStatus: string, note?: string) =>
  api.patch<JobApplication>(`/jobs/${id}/status`, { new_status: newStatus, note })

export const analyzeJob = (id: number) =>
  api.post<{ match_score: number | null; ai_gap_summary: string | null }>(`/jobs/${id}/analyze`)

export const getJobPrep = (id: number) =>
  api.get<{ questions: { question: string; model_answer: string }[] }>(`/jobs/${id}/prep`)

export const logActivity = (
  id: number,
  data: { event_type: string; event_date?: string; notes?: string },
) =>
  api.post<ActivityResponse>(`/jobs/${id}/activities`, data)

export const getActivities = (id: number) =>
  api.get<ActivityResponse[]>(`/jobs/${id}/activities`)

export const addContact = (
  id: number,
  data: { name: string; role?: string; email?: string; phone?: string; linkedin_url?: string; notes?: string },
) =>
  api.post<ContactResponse>(`/jobs/${id}/contacts`, data)

export const getContacts = (id: number) =>
  api.get<ContactResponse[]>(`/jobs/${id}/contacts`)

export const deleteContact = (jobId: number, contactId: number) =>
  api.delete<ContactResponse>(`/jobs/${jobId}/contacts/${contactId}`)

export const getJobStats = () =>
  api.get<JobStatsResponse>('/jobs/stats')

export const getUpcomingJobs = () =>
  api.get<JobApplication[]>('/jobs/upcoming')

export const getStaleJobs = () =>
  api.get<JobApplication[]>('/jobs/stale')

// ── Phase 7: Recruiter Dashboard ─────────────────────────────────────────────

export interface RecruiterList {
  id: number
  name: string
  job_title: string | null
  candidate_count: number
  created_at: string
}

export interface RecruiterCandidate {
  id: number
  session_id: number
  rank: number | null
  cv_filename: string
  match_score: number | null
  skill_inventory: unknown
  created_at: string
}

export interface RecruiterCandidateListResponse {
  list_id: number
  list_name: string
  candidates: RecruiterCandidate[]
}

export const getRecruiterLists = () =>
  api.get<RecruiterList[]>('/recruiter/lists')

export const createRecruiterList = (name: string, job_title?: string) =>
  api.post<RecruiterList>('/recruiter/lists', { name, job_title })

export const deleteRecruiterList = (listId: number) =>
  api.delete(`/recruiter/lists/${listId}`)

export const getRecruiterCandidates = (listId: number) =>
  api.get<RecruiterCandidateListResponse>(`/recruiter/lists/${listId}/candidates`)

export const addRecruiterCandidate = (listId: number, sessionId: number) =>
  api.post<RecruiterCandidate>(`/recruiter/lists/${listId}/candidates`, { session_id: sessionId })

export const removeRecruiterCandidate = (listId: number, candidateId: number) =>
  api.delete(`/recruiter/lists/${listId}/candidates/${candidateId}`)

export const updateCandidateRank = (listId: number, candidateId: number, rank: number) =>
  api.patch<RecruiterCandidate>(`/recruiter/lists/${listId}/candidates/${candidateId}`, { rank })

export const exportRecruiterList = (listId: number) =>
  api.get<ArrayBuffer>(`/recruiter/lists/${listId}/export`, { responseType: 'arraybuffer' })

// ── Phase 9: Referrals ─────────────────────────────────────────────────────

export interface ReferralCodeResponse {
  code: string
  referral_url: string
}

export interface ReferralStats {
  total_referred: number
  total_converted: number
  days_earned: number
}

export interface LeaderboardEntry {
  username: string
  referral_count: number
}

export const getMyReferralCode = () =>
  api.get<ReferralCodeResponse>('/referrals/my-code')

export const getReferralStats = () =>
  api.get<ReferralStats>('/referrals/stats')

export const getLeaderboard = () =>
  api.get<LeaderboardEntry[]>('/referrals/leaderboard')

// ── Phase 11: Career Roadmap ──────────────────────────────────────────────

export interface RoadmapResource {
  name: string
  url: string
  type: string
  is_free: boolean
  estimated_hours: number
}

export interface RoadmapPhase {
  name: string
  estimated_weeks: number
  skills_covered: string[]
  resources: RoadmapResource[]
  project_to_build: string
  milestone: string
}

export interface CareerInsight {
  salary_range_local: string
  salary_range_remote: string
  top_companies: string[]
  hot_skills: string[]
  market_demand: string
}

export interface QuickWin {
  action: string
  why: string
  time_required: string
}

export interface RoadmapListItem {
  id: number
  target_role: string
  total_estimated_weeks: number
  created_at: string
}

export interface RoadmapResponse {
  id: number
  target_role: string
  total_estimated_weeks: number
  phases: RoadmapPhase[]
  career_insight: CareerInsight
  quick_wins: QuickWin[]
  created_at: string
}

export const generateRoadmap = (cv_session_id: number | null, target_role: string, role_description?: string) =>
  api.post<RoadmapResponse>('/roadmap/generate', { cv_session_id, target_role, role_description })

export const listRoadmaps = () =>
  api.get<RoadmapListItem[]>('/roadmap')

export const getRoadmap = (id: number) =>
  api.get<RoadmapResponse>(`/roadmap/${id}`)

export const getMySessions = () =>
  api.get<CVSession[]>('/cv/sessions')

// ── Phase 7: User Profile ────────────────────────────────────────────────────

export interface ProfileUpdatePayload {
  username?: string
  bio?: string
  linkedin_url?: string
  github_url?: string
  portfolio_url?: string
}

export const getProfile = () =>
  api.get<UserProfile>('/profile/me')

export const updateProfile = (data: ProfileUpdatePayload) =>
  api.put<MessageResponse>('/profile/update', data)

export const uploadStoredCv = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<{ message: string; filename: string }>('/profile/cv', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const deleteStoredCv = () =>
  api.delete<MessageResponse>('/profile/cv')

export const sendChangeOtp = () =>
  api.post<MessageResponse>('/profile/send-change-otp', {})

export const changePassword = (otp_code: string, new_password: string) =>
  api.post<MessageResponse>('/profile/change-password', { otp_code, new_password })

// ── Phase 9: Interview Question Bank ────────────────────────────────────────

export interface BankQuestion {
  id: number
  question_text: string
  model_answer: string
  level: string
  practiced: boolean
}

export interface BankSearchResult extends BankQuestion {
  role: string
  category: string
}

export interface BankQuestionsResponse {
  role: string
  level: string
  total_questions: number
  categories: Record<string, BankQuestion[]>
}

export interface BankSearchResponse {
  query: string
  results: BankSearchResult[]
  total: number
}

export interface BankProgressCategory {
  practiced: number
  total: number
  pct: number
}

export interface BankProgressResponse {
  role: string
  level: string
  overall_readiness_pct: number
  by_category: Record<string, BankProgressCategory>
}

export const getInterviewRoles = () =>
  api.get<{ roles: string[] }>('/interview-bank/roles')

export const getInterviewQuestions = (role: string, level: string) =>
  api.get<BankQuestionsResponse>('/interview-bank/questions', { params: { role, level } })

export const searchInterviewQuestions = (q: string, role?: string, level?: string) =>
  api.get<BankSearchResponse>('/interview-bank/search', { params: { q, role, level } })

export const markQuestionPracticed = (questionId: number, practiced: boolean) =>
  api.post<{ question_id: number; practiced: boolean; practiced_at: string | null }>(
    '/interview-bank/progress',
    { question_id: questionId, practiced },
  )

export const getInterviewProgress = (role: string, level: string) =>
  api.get<BankProgressResponse>('/interview-bank/progress', { params: { role, level } })
