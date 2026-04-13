// Centralized frontend API wrapper for all backend endpoints used in MindEcho,
// including authentication, child records, assessments, and analysis jobs.
import api from './client'
import type {
  LoginResponse, User, Child, ChildCreate,
  Assessment, AssessmentCreate, AnalysisJob,
} from '../types'

// Authentication-related API calls
// Handle login, registration, and current user profile actions
export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)
    const { data } = await api.post<LoginResponse>('/auth/login', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  register: async (payload: {
    email: string
    full_name: string
    password: string
    phone_number?: string
  }): Promise<User> => {
    const { data } = await api.post<User>('/auth/register', payload)
    return data
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get<User>('/users/me')
    return data
  },

  updateMe: async (payload: { full_name?: string; phone_number?: string }): Promise<User> => {
    const { data } = await api.patch<User>('/users/me', payload)
    return data
  },
}

// Child profile API calls
// Create and retrieve child profiles used in assessments
export const childrenApi = {
  create: async (child: ChildCreate): Promise<Child> => {
    const { data } = await api.post<Child>('/children/', child)
    return data
  },
  list: async (): Promise<Child[]> => {
    const { data } = await api.get<Child[]>('/children/')
    return data
  },
  get: async (id: number): Promise<Child> => {
    const { data } = await api.get<Child>(`/children/${id}`)
    return data
  },
}

// Assessment workflow API calls
// Create, retrieve, update, and complete assessments
export const assessmentsApi = {
  create: async (payload: AssessmentCreate): Promise<Assessment> => {
    const { data } = await api.post<Assessment>('/assessments/', payload)
    return data
  },
  list: async (): Promise<Assessment[]> => {
    const { data } = await api.get<Assessment[]>('/assessments/')
    return data
  },
  get: async (id: number): Promise<Assessment> => {
    const { data } = await api.get<Assessment>(`/assessments/${id}`)
    return data
  },
  saveQuestionnaire: async (id: number, answers: Record<string, string>): Promise<void> => {
    await api.patch(`/assessments/${id}/questionnaire`, answers)
  },
  complete: async (id: number): Promise<{ status: string; adhd_likelihood: string }> => {
    const { data } = await api.post(`/assessments/${id}/complete`)
    return data
  },
}

// Analysis and tracking API calls
// Start, stop, and fetch analysis jobs for eye, body, and speech modules
export const analysisApi = {
  // Real-time eye and body tracker control used during the live assessment flow
  // Camera label format: "Camera Label::deviceIndex" (for example, "FaceTime HD Camera::1")
  startEyeTracker: async (assessmentId: number, camLabel: string): Promise<AnalysisJob> => {
    const { data } = await api.post<AnalysisJob>('/analysis/eye/start', {
      assessment_id: assessmentId,
      cam_label: camLabel,
    })
    return data
  },

  stopEyeTracker: async (assessmentId: number): Promise<void> => {
    await api.post('/analysis/eye/stop', { assessment_id: assessmentId })
  },

  startBodyTracker: async (assessmentId: number, camLabel: string): Promise<AnalysisJob> => {
    const { data } = await api.post<AnalysisJob>('/analysis/body/start', {
      assessment_id: assessmentId,
      cam_label: camLabel,
    })
    return data
  },

  stopBodyTracker: async (assessmentId: number): Promise<void> => {
    await api.post('/analysis/body/stop', { assessment_id: assessmentId })
  },

  // Legacy upload endpoints kept for manual testing and fallback use
  startEye: async (assessmentId: number, file?: File): Promise<AnalysisJob> => {
    const form = new FormData()
    form.append('assessment_id', String(assessmentId))
    if (file) form.append('file', file)
    const { data } = await api.post<AnalysisJob>('/analysis/eye', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  startBody: async (assessmentId: number, file?: File): Promise<AnalysisJob> => {
    const form = new FormData()
    form.append('assessment_id', String(assessmentId))
    if (file) form.append('file', file)
    const { data } = await api.post<AnalysisJob>('/analysis/body', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  startSpeech: async (assessmentId: number, file?: File): Promise<AnalysisJob> => {
    const form = new FormData()
    form.append('assessment_id', String(assessmentId))
    if (file) form.append('file', file)
    const { data } = await api.post<AnalysisJob>('/analysis/speech', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  mockStartAll: async (assessmentId: number) => {
    const { data } = await api.post(`/analysis/mock-start/${assessmentId}`)
    return data
  },

  getJobs: async (assessmentId: number): Promise<AnalysisJob[]> => {
    const { data } = await api.get<AnalysisJob[]>(`/analysis/${assessmentId}`)
    return data
  },

  getJob: async (jobId: number): Promise<AnalysisJob> => {
    const { data } = await api.get<AnalysisJob>(`/analysis/job/${jobId}`)
    return data
  },
}