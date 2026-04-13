// Shared TypeScript types used across the MindEcho frontend
// for authentication, child records, assessments, analysis jobs, and UI errors.

// Authentication-related types
// User account data returned from authenticated backend endpoints
export interface User {
  id: number
  email: string
  full_name: string
  role: string
  phone_number?: string
  created_at: string
  is_active: boolean
}

// Response returned after a successful login request
export interface LoginResponse {
  access_token: string
  token_type: string
  user: Pick<User, 'id' | 'email' | 'full_name' | 'role'>
}

// Child profile types
// Child profile stored and linked to an assessment
export interface Child {
  id: number
  full_name: string
  age: number
  class_name: string
  teacher_name: string
  assessment_date: string
  photo_url?: string
  created_at: string
}

// Payload used when creating a new child profile
export interface ChildCreate {
  full_name: string
  age: number
  class_name: string
  teacher_name: string
  assessment_date: string
}

// Assessment workflow types
export type AssessmentStatus = 'in_progress' | 'processing' | 'completed'
export type LikelihoodLevel = 'Low' | 'Medium' | 'High'

// Assessment record containing child info, status, and final result
export interface Assessment {
  id: number
  user_id: number
  child_id: number
  status: AssessmentStatus
  adhd_likelihood?: LikelihoodLevel
  questionnaire_answers?: string
  created_at: string
  completed_at?: string
  child?: Child
}

e// Payload used when creating a new assessment
export interface AssessmentCreate {
  child_id: number
  questionnaire_answers?: string
}

// Analysis job types
export type AnalysisType   = 'eye' | 'body' | 'speech'
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'

// Analysis job record returned from backend endpoints
export interface AnalysisJob {
  id: number
  user_id: number
  assessment_id: number
  type: AnalysisType
  status: AnalysisStatus
  result_json?: string
  error_message?: string
  created_at: string
  completed_at?: string
}

// Analysis result schemas returned from backend processing
export interface EyeResult {
  attention_score: number
  gaze_stability: string
  focus_duration_seconds: number
  saccade_count: number
  fixation_count: number
  analysis_notes: string
  timestamps: { t: number; score: number }[]
}

// Body movement result schema used in the report page
export interface BodyResult {
  hyperactivity_score: number
  movement_intensity: string
  fidget_events: number
  posture_changes: number
  analysis_notes: string
  timestamps: { t: number; score: number }[]
}

// Speech analysis result schema used in the report page
export interface SpeechResult {
  speech_clarity_score: number
  hesitation_count: number
  word_confidence: string
  uncertain_words_detected: string
  speech_rate_wpm: number
  analysis_notes: string
  waveform_data: number[]
}

// Generic UI and API helper types
export interface ApiError {
  detail: string
}
