import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { assessmentsApi, analysisApi } from '../api/endpoints'
import type { Assessment, AnalysisJob, EyeResult, BodyResult, SpeechResult } from '../types'
import { LikelihoodBadge, Spinner, ScoreGauge, RingScore, Waveform, StatusDot } from '../components/ui'
import { ChevronLeft, Camera, Eye, Mic, Download, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// Detailed report page that displays the final assessment result,
// module-specific analysis outputs, and downloadable report actions.
export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [jobs, setJobs] = useState<AnalysisJob[]>([])
  const [loading, setLoading] = useState(true)

  // Load the selected assessment and all related analysis jobs when the page opens
  useEffect(() => {
    if (!id) return
    Promise.all([
      assessmentsApi.get(Number(id)),
      analysisApi.getJobs(Number(id)),
    ]).then(([a, j]) => {
      setAssessment(a)
      setJobs(j)
    }).finally(() => setLoading(false))
  }, [id])

  // Return the analysis job matching a specific module type
  const getJob = (type: string) => jobs.find((j) => j.type === type)
  // Parse and return the stored JSON result for a given analysis module
  const getResult = <T,>(type: string): T | null => {
    const job = getJob(type)
    if (!job?.result_json) return null
    try { return JSON.parse(job.result_json) as T } catch { return null }
  }

  // Extract module-specific results used to populate the report sections
  const eyeResult = getResult<EyeResult>('eye')
  const bodyResult = getResult<BodyResult>('body')
  const speechResult = getResult<SpeechResult>('speech')

  if (loading) return (
    <div className="flex justify-center py-16">
      <Spinner size={32} className="text-primary-600" />
    </div>
  )

  if (!assessment) return (
    <div className="card text-center py-16">
      <AlertCircle size={40} className="text-bark-300 mx-auto mb-3" />
      <p className="font-display font-semibold text-bark-500">Assessment not found</p>
    </div>
  )

  return (
    <div className="animate-fade-in space-y-6">
      {/* Report header with navigation, date, and final ADHD likelihood */}
      <div>
        <button onClick={() => navigate('/reports')} className="flex items-center gap-1.5 text-bark-500 hover:text-bark-800 text-sm font-body mb-4 transition-colors">
          <ChevronLeft size={16} /> Reports
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-bark-900 text-3xl">Report</h1>
            <p className="text-bark-400 font-body text-sm mt-1">
              {new Date(assessment.created_at).toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
          </div>
          {assessment.adhd_likelihood && (
            <LikelihoodBadge level={assessment.adhd_likelihood} />
          )}
        </div>
      </div>

      {/* Summary card showing the assessed child's basic information */}
      <div className="card flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-cream-200 flex items-center justify-center font-display font-bold text-bark-700 text-xl flex-shrink-0">
          {assessment.child?.full_name?.[0]?.toUpperCase() ?? 'C'}
        </div>
        <div>
          <p className="font-display font-bold text-bark-900 text-xl">{assessment.child?.full_name}</p>
          <p className="text-bark-400 font-body text-sm">
            Age {assessment.child?.age} · Class {assessment.child?.class_name} · {assessment.child?.teacher_name}
          </p>
        </div>
        <div className="ml-auto">
          <span className={`px-3 py-1 rounded-pill text-sm font-semibold font-display
            ${assessment.status === 'completed' ? 'bg-primary-100 text-primary-700' : 'bg-amber-100 text-amber-700'}`}>
            {assessment.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Status cards showing the progress of body, eye, and speech analysis jobs */}
      <div className="grid grid-cols-3 gap-4">
        {(['body', 'eye', 'speech'] as const).map((type) => {
          const job = getJob(type)
          const labels = { body: 'Movement', eye: 'Eye Tracking', speech: 'Speech' }
          const icons  = { body: Camera, eye: Eye, speech: Mic }
          const Icon = icons[type]
          return (
            <div key={type} className="card flex items-center gap-3">
              <div className="w-9 h-9 bg-cream-100 rounded-lg flex items-center justify-center">
                <Icon size={18} className="text-bark-500" />
              </div>
              <div>
                <p className="font-display font-semibold text-bark-800 text-sm">{labels[type]}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {job ? <StatusDot status={job.status} /> : <StatusDot status="pending" />}
                  <span className="text-xs text-bark-400 font-body capitalize">{job?.status ?? 'no data'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {assessment.status !== 'completed' && (
        <div className="card bg-amber-50 border border-amber-200 flex items-center gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-amber-700 font-body text-sm">
            This assessment is still in progress. Results will appear when analysis is complete.
          </p>
        </div>
      )}

      {/* Body movement analysis section */}
      {bodyResult && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Camera size={18} className="text-bark-500" />
            <h3 className="font-display font-bold text-bark-900">Hyperactivity Score</h3>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            <RingScore score={bodyResult.hyperactivity_score} label="Movement Intensity" size={100} />
            <div className="flex-1 space-y-2 min-w-[200px]">
              <Row label="Movement Intensity" value={bodyResult.movement_intensity} />
              <Row label="Fidget Events" value={String(bodyResult.fidget_events)} />
              <Row label="Posture Changes" value={String(bodyResult.posture_changes)} />
            </div>
          </div>
          <p className="text-xs text-bark-400 font-body mt-3 italic">
            Source: Classroom Movement Camera — {bodyResult.analysis_notes}
          </p>
          {bodyResult.timestamps?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-bark-500 font-body mb-2">Movement over time</p>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={bodyResult.timestamps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe0" />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#6B7F3A" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Eye tracking analysis section */}
      {eyeResult && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={18} className="text-bark-500" />
            <h3 className="font-display font-bold text-bark-900">Attention Score</h3>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            <RingScore score={eyeResult.attention_score} label="Eye Movement" size={100} />
            <div className="flex-1 space-y-2 min-w-[200px]">
              <Row label="Gaze Stability" value={eyeResult.gaze_stability} />
              <Row label="Focus Duration" value={`${eyeResult.focus_duration_seconds}s`} />
              <Row label="Fixation Count" value={String(eyeResult.fixation_count)} />
              <Row label="Saccade Count" value={String(eyeResult.saccade_count)} />
            </div>
          </div>
          <p className="text-xs text-bark-400 font-body mt-3 italic">
            Source: Eye Tracking Camera — {eyeResult.analysis_notes}
          </p>
        </div>
      )}

      {/* Speech analysis section */}
      {speechResult && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Mic size={18} className="text-bark-500" />
            <h3 className="font-display font-bold text-bark-900">Speech Pattern Score</h3>
          </div>
          <div className="flex items-center gap-8 flex-wrap">
            <RingScore score={speechResult.speech_clarity_score} label="Speech Clarity" size={100} />
            <div className="flex-1 space-y-2 min-w-[200px]">
              <Row label="Uncertain Words Detected" value={speechResult.uncertain_words_detected} />
              <Row label="Word Confidence" value={speechResult.word_confidence} />
              <Row label="Hesitation Count" value={String(speechResult.hesitation_count)} />
              <Row label="Speech Rate" value={`${speechResult.speech_rate_wpm} WPM`} />
            </div>
          </div>
          <p className="text-xs text-bark-400 font-body mt-3 italic">
            Source: Microphone — {speechResult.analysis_notes}
          </p>
          <div className="bg-cream-100 rounded-card p-3 mt-3">
            <p className="text-xs text-bark-400 font-body mb-2">Speech Waveform</p>
            <Waveform data={speechResult.waveform_data} />
          </div>
        </div>
      )}

      {/* Final disclaimer and report actions */}
      <div className="card bg-cream-100 border border-cream-300">
        <p className="text-bark-500 font-body text-sm text-center">
          ⚠️ This is an AI-generated analysis. It is NOT a medical diagnosis.
          Please consult a licensed healthcare professional.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 pb-8">
        <button className="btn-outline" onClick={() => window.print()}>
          <Download size={16} /> Download Report
        </button>
        <button className="btn-green" onClick={() => navigate('/assessment/new')}>
          New Assessment
        </button>
      </div>
    </div>
  )
}

// Reusable key-value row used inside each analysis result section
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-cream-100 last:border-0">
      <span className="text-sm text-bark-500 font-body">{label}</span>
      <span className="text-sm font-display font-semibold text-bark-800">{value}</span>
    </div>
  )
}
