import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { childrenApi, assessmentsApi, analysisApi } from '../api/endpoints'
import { Spinner } from '../components/ui'
import {
  ChevronLeft, ChevronRight, User, Camera, Eye,
  CheckCircle2, XCircle, Calendar, X,
} from 'lucide-react'
import clsx from 'clsx'

// Assessment flow steps used to control which screen is shown
type Step = 'child-info' | 'camera-setup' | 'movement-recording' | 'questionnaire' | 'processing' | 'diagnosis'

// Teacher-facing questionnaire prompts used during the speech analysis stage
const QUESTIONNAIRE = [
  'Can you tell me a story about something that happened at school this week?',
  'Can you remember these three things: an apple, a blue ball, and a dog? I will ask you again in a moment.',
  'What do you do when you have to wait for your turn in a game?',
  'How do you feel when you have to sit still for a long time, like during class or dinner?',
  'Can you tell me what you had for breakfast this morning and what you did after?',
  'What is your favourite subject in school?',
  'What were the three things I asked you to remember?'
]

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

// Shared page wrapper used across the different assessment screens
function Shell({ title, onBack, children }: {
  title: string; onBack?: () => void; children: React.ReactNode
}) {
  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <div className="section-header rounded-card mb-6 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="text-white/70 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
        )}
        <h2 className="font-display font-bold text-white text-xl flex-1">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// Custom calendar picker used for date of birth and assessment date selection
function CalendarPicker({ value, onChange, minDate, maxDate, placeholder = 'Select date' }: {
  value: string; onChange: (v: string) => void
  minDate?: Date; maxDate?: Date; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const today   = new Date()
  const initial = value ? new Date(value + 'T00:00:00') : (maxDate ?? today)
  const [viewYear, setViewYear]   = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const selected    = value ? new Date(value + 'T00:00:00') : null
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()

  const prevMonth = () => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y-1)) : setViewMonth(m => m-1)
  const nextMonth = () => viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y+1)) : setViewMonth(m => m+1)

  const selectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mm}-${dd}`)
    setOpen(false)
  }
  const isDisabled = (d: number) => {
    const dt = new Date(viewYear, viewMonth, d)
    const min = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : null
    const max = maxDate ? new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()) : null
    return !!(min && dt < min) || !!(max && dt > max)
  }
  const isSelected = (d: number) =>
    !!selected && selected.getFullYear()===viewYear && selected.getMonth()===viewMonth && selected.getDate()===d
  const isToday = (d: number) =>
    today.getFullYear()===viewYear && today.getMonth()===viewMonth && today.getDate()===d

  const display = selected
    ? selected.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : ''

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className={clsx('input flex items-center justify-between text-left w-full', !display && 'text-bark-400')}>
        <span>{display || placeholder}</span>
        <Calendar size={16} className="text-bark-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-white rounded-card shadow-2xl border border-cream-200 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth}
              className="w-7 h-7 rounded-full hover:bg-cream-100 flex items-center justify-center text-bark-500">
              <ChevronLeft size={16} />
            </button>
            <p className="font-display font-bold text-bark-900 text-sm">{MONTHS[viewMonth]} {viewYear}</p>
            <button type="button" onClick={nextMonth}
              className="w-7 h-7 rounded-full hover:bg-cream-100 flex items-center justify-center text-bark-500">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => <div key={d} className="text-center text-xs font-bold text-bark-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dis = isDisabled(day), sel = isSelected(day), tod = isToday(day)
              return (
                <button key={day} type="button" disabled={dis} onClick={() => selectDay(day)}
                  className={clsx(
                    'w-8 h-8 rounded-full text-xs font-body transition-colors mx-auto flex items-center justify-center',
                    sel && 'bg-primary-600 text-white font-bold',
                    !sel && tod && 'border-2 border-primary-400 text-primary-700 font-semibold',
                    !sel && !tod && !dis && 'hover:bg-cream-100 text-bark-700',
                    dis && 'text-bark-200 cursor-not-allowed',
                  )}>
                  {day}
                </button>
              )
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-cream-100 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setViewYear(y => y-1)} className="text-bark-400 hover:text-bark-700"><ChevronLeft size={14}/></button>
            <span className="font-display font-semibold text-bark-700 text-sm w-12 text-center">{viewYear}</span>
            <button type="button" onClick={() => setViewYear(y => y+1)} className="text-bark-400 hover:text-bark-700"><ChevronRight size={14}/></button>
          </div>
        </div>
      )}
    </div>
  )
}

// Calculate the child's age from the selected date of birth
function calcAge(dob: string): number | null {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00'), today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// Visual timer used during the 5-minute body tracking session
function WaveTimer({ seconds }: { seconds: number }) {
  const max = 300
  const safeSeconds = Math.max(0, Math.min(max, seconds))
  const elapsed = max - safeSeconds
  const progress = elapsed / max

  const mm = String(Math.floor(safeSeconds / 60)).padStart(2, '0')
  const ss = String(safeSeconds % 60).padStart(2, '0')

  const bars = Array.from({ length: 36 }, (_, i) => {
    const base = 18 + Math.abs(Math.sin(i * 0.55)) * 26
    const activeBars = Math.round(progress * 36)
    const isActive = i < activeBars
    return {
      height: base,
      isActive,
      delay: `${i * 0.04}s`,
    }
  })

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full max-w-xl rounded-2xl border border-cream-200 bg-gradient-to-b from-white via-cream-50 to-primary-50/30 px-6 py-7 shadow-sm">
        <div className="text-center mb-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-bark-400 font-semibold">
            Motion Tracking
          </p>
          <div className="mt-2 font-display font-bold text-bark-900 text-5xl leading-none">
            {mm}:{ss}
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 border border-primary-200">
            <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse" />
            Live Analysis Active
          </div>
        </div>

        {/* waveform */}
        <div className="relative h-28 rounded-xl border border-cream-200 bg-white/80 backdrop-blur-sm px-4 py-3 overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-bark-300" />
          </div>

          <div className="flex items-end justify-center gap-[4px] h-full">
            {bars.map((bar, i) => (
              <div
                key={i}
                className={`w-2 rounded-full transition-all duration-700 ${
                  bar.isActive ? 'bg-primary-600 shadow-[0_0_10px_rgba(107,127,58,0.35)]' : 'bg-cream-300'
                }`}
                style={{
                  height: `${bar.height}px`,
                  animation: bar.isActive ? `wavePulse 1.6s ease-in-out infinite` : 'none',
                  animationDelay: bar.delay,
                }}
              />
            ))}
          </div>
        </div>

        {/* info cards */}
        <div className="flex justify-center mt-5">
          <div className="w-full max-w-[180px] rounded-xl border border-primary-200 bg-primary-50 px-3 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-primary-700 font-semibold">Progress</p>
            <p className="text-base font-bold text-primary-800 mt-1">{Math.round(progress * 100)}%</p>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes wavePulse {
            0%, 100% { transform: scaleY(0.9); opacity: 0.85; }
            50% { transform: scaleY(1.15); opacity: 1; }
          }
        `}
      </style>
    </div>
  )
}

// Circular progress indicator shown during result processing
function ProcessingGauge({ progress }: { progress: number }) {
  const r = 70, circ = 2 * Math.PI * r
  const dash = (progress / 100) * circ
  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg width="192" height="192" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="96" cy="96" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle cx="96" cy="96" r={r} fill="none" stroke="#6B7F3A" strokeWidth="12"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display font-bold text-bark-900 text-4xl">{Math.round(progress)}%</span>
      </div>
    </div>
  )
}

// Confirmation modal shown when the user attempts to quit the assessment
function QuitModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-card shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-danger px-6 py-5 flex items-center justify-between">
          <h2 className="font-display font-bold text-white text-lg">Quit Assessment?</h2>
          <button onClick={onCancel} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">
          <p className="text-bark-600 font-body text-sm leading-relaxed">
            Are you sure you want to quit? All progress for this session will be lost.
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button type="button" className="flex-1 btn-outline" onClick={onCancel}>Cancel</button>
          <button type="button" className="flex-1 btn-danger" onClick={onConfirm}>
            <XCircle size={16} /> Quit Test
          </button>
        </div>
      </div>
    </div>
  )
}

// Fullscreen preview modal for camera streams
function FullscreenCamModal({ data, onClose }: {
  data: { stream: MediaStream; label: string } | null
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current && data?.stream) {
      videoRef.current.srcObject = data.stream
      videoRef.current.play()
    }
  }, [data])
  if (!data) return null
  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
        <span className="text-white font-display font-semibold">{data.label}</span>
        <button onClick={onClose} className="text-white/70 hover:text-white p-2">
          <X size={22} />
        </button>
      </div>
      <video ref={videoRef} autoPlay playsInline muted className="flex-1 w-full object-contain" />
    </div>
  )
}

// Live camera preview card used during camera setup
function CamPreview({ videoRef, stream, icon, onExpand }: {
  videoRef: React.RefObject<HTMLVideoElement>
  stream: MediaStream | null
  icon: React.ReactNode
  onExpand: () => void
}) {
  // Attach stream to video element whenever stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream, videoRef])

  return (
    <div
      className={clsx(
        'relative bg-bark-900 rounded-xl overflow-hidden',
        stream && 'cursor-pointer group'
      )}
      style={{ aspectRatio: '16/9' }}
      onClick={() => stream && onExpand()}
    >
      <video ref={videoRef} autoPlay playsInline muted
        className="absolute inset-0 w-full h-full object-cover" />
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="text-bark-500">{icon}</div>
          <span className="text-bark-500 text-xs font-body">Select a camera above to preview</span>
        </div>
      )}
      {stream && (
        <>
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white font-display font-bold drop-shadow">LIVE</span>
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-display font-semibold bg-black/50 px-3 py-1.5 rounded-pill">
              ⛶ Click to expand
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// Questionnaire step where eye tracking and speech recording are controlled
function QuestionnaireStep({ stream2, fullscreenCam, setFullscreenCam,
  showQuit, setShowQuit, handleQuit, handleStartProcessing, loading,
  assessmentId, cam2Label }: {
  stream2: MediaStream | null
  fullscreenCam: { stream: MediaStream; label: string } | null
  setFullscreenCam: (v: { stream: MediaStream; label: string } | null) => void
  showQuit: boolean
  setShowQuit: (v: boolean) => void
  handleQuit: () => void
  handleStartProcessing: () => void
  loading: boolean
  assessmentId: number | null
  cam2Label: string
}) {
  const eyeVideoRef = useRef<HTMLVideoElement>(null)

  // Eye tracking toggle — starts/stops Camera 2 preview
  const [eyeOn, setEyeOn]       = useState(false)
  const [speechOn, setSpeechOn] = useState(false)
  const [micStream, setMicStream]     = useState<MediaStream | null>(null)
  const [audioLevel, setAudioLevel]   = useState(0)
  const analyserRef    = useRef<AnalyserNode | null>(null)
  const animFrameRef   = useRef<number>(0)
  const mediaRecRef    = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [toggleError, setToggleError] = useState('')

  // Attach eye camera stream when toggled on
  useEffect(() => {
    if (eyeVideoRef.current && !eyeOn && stream2) {
      eyeVideoRef.current.srcObject = stream2
      eyeVideoRef.current.play().catch(() => {})
    }
  }, [eyeOn, stream2])

  // Audio level visualiser
  useEffect(() => {
    if (!micStream) { setAudioLevel(0); return }
    const ctx      = new AudioContext()
    const source   = ctx.createMediaStreamSource(micStream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyserRef.current = analyser
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      setAudioLevel(Math.min(100, (avg / 128) * 100))
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      ctx.close()
    }
  }, [micStream])

  const handleEyeToggle = async () => {
    setToggleError('')

    if (!eyeOn) {
      if (!stream2) {
        setToggleError('Eye tracking camera (Camera 2) is not connected.')
        return
      }
      if (!assessmentId) {
        setToggleError('No active assessment found.')
        return
      }

      try {
        // Release browser access to Camera 2 first
        stream2.getTracks().forEach(t => t.stop())
        if (eyeVideoRef.current) {
          eyeVideoRef.current.srcObject = null
        }

        await analysisApi.startEyeTracker(assessmentId, cam2Label)
        setEyeOn(true)
      } catch (e: any) {
        setToggleError(e.response?.data?.detail || 'Failed to start eye tracker.')
      }
    } else {
      if (assessmentId) {
        try { await analysisApi.stopEyeTracker(assessmentId) } catch {}
      }
      setEyeOn(false)
    }
  }

  const handleSpeechToggle = async () => {
    setToggleError('')
    if (!speechOn) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        setMicStream(s)
        // Start recording
        audioChunksRef.current = []
        const rec = new MediaRecorder(s)
        rec.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
        rec.start(1000)
        mediaRecRef.current = rec
        setSpeechOn(true)
      } catch {
        setToggleError('Microphone access denied. Please allow microphone access and try again.')
      }
    } else {
      mediaRecRef.current?.stop()
      mediaRecRef.current = null
      micStream?.getTracks().forEach(t => t.stop())
      setMicStream(null)
      setSpeechOn(false)
    }
  }

  const bothOn   = eyeOn && speechOn
  const canEnd   = bothOn

  const handleEndTest = async () => {
    if (!canEnd) {
      setToggleError('Please enable both Eye Tracking and Speech Recording before ending the test.')
      return
    }

    // Stop MediaRecorder and get audio blob
    let audioBlob: Blob | null = null
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      audioBlob = await new Promise<Blob>(resolve => {
        mediaRecRef.current!.onstop = () => {
          resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }))
        }
        mediaRecRef.current!.stop()
      })
    }
    mediaRecRef.current = null
    micStream?.getTracks().forEach(t => t.stop())

    // Stop eye tracker
    if (assessmentId && eyeOn) {
      try { await analysisApi.stopEyeTracker(assessmentId) } catch { /* non-fatal */ }
    }

    //Stop body tracker
    if (assessmentId) {
      try { await analysisApi.stopBodyTracker(assessmentId) } catch { /* non-fatal */ }
    }

    // Upload audio to real speech service
    if (assessmentId && audioBlob) {
      try {
        const audioFile = new File([audioBlob], 'speech.webm', { type: 'audio/webm' })
        await analysisApi.startSpeech(assessmentId, audioFile)
      } catch (e) {
        console.warn('Speech upload failed:', e)
      }
    }

    handleStartProcessing()
  }

  return (
    <>
      <FullscreenCamModal data={fullscreenCam} onClose={() => setFullscreenCam(null)} />
      {showQuit && <QuitModal onConfirm={handleQuit} onCancel={() => setShowQuit(false)} />}
      <Shell title="Questionnaire Panel">
        <div className="card space-y-5">

          {/* Questions */}
          <div>
            <p className="font-display font-semibold text-bark-700 text-sm mb-3">
              List of questions to be asked:
            </p>
            <div className="flex flex-wrap gap-2">
              {QUESTIONNAIRE.map((q, i) => (
                <span key={i}
                  className="bg-primary-600 text-white text-xs font-body px-3 py-1.5 rounded-pill">
                  {q}
                </span>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="border-t border-cream-200 pt-4 space-y-4">
            <p className="font-display font-semibold text-bark-700 text-sm">
              Recording Settings
              <span className="ml-2 text-xs text-bark-400 font-body font-normal">
                — both must be ON to end the test
              </span>
            </p>

            {/* Eye Tracking toggle + live feed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye size={16} className={eyeOn ? 'text-primary-600' : 'text-bark-400'} />
                  <span className="font-body text-sm text-bark-700">Eye Tracking Recording</span>
                  {eyeOn && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-green-600 font-body">Active</span>
                    </span>
                  )}
                </div>
                <button type="button" onClick={handleEyeToggle}
                  className={clsx('w-11 h-6 rounded-full transition-colors duration-200 relative',
                    eyeOn ? 'bg-primary-600' : 'bg-gray-200')}>
                  <span className={clsx(
                    'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                    eyeOn ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
              </div>


              {eyeOn && (
                <div className="bg-cream-100 border border-cream-200 rounded-xl px-4 py-6 text-center">
                  <p className="text-bark-700 font-display font-semibold mb-1">
                    Eye movement analysis in progress
                  </p>
                </div>
              )}
            </div>

            {/* Speech Recording toggle + audio level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={speechOn ? 'text-primary-600' : 'text-bark-400'}>🎙</span>
                  <span className="font-body text-sm text-bark-700">Speech Recording</span>
                  {speechOn && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-green-600 font-body">Mic active</span>
                    </span>
                  )}
                </div>
                <button type="button" onClick={handleSpeechToggle}
                  className={clsx('w-11 h-6 rounded-full transition-colors duration-200 relative',
                    speechOn ? 'bg-primary-600' : 'bg-gray-200')}>
                  <span className={clsx(
                    'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                    speechOn ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </button>
              </div>

              {/* Audio level bar — only shown when mic is on */}
              {speechOn && (
                <div className="bg-cream-100 rounded-btn px-3 py-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-bark-500 font-body">Microphone input level</span>
                    <span className="text-xs text-bark-400 font-body">{Math.round(audioLevel)}%</span>
                  </div>
                  <div className="h-2 bg-cream-300 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-75',
                        audioLevel > 70 ? 'bg-red-500' :
                        audioLevel > 40 ? 'bg-amber-500' : 'bg-primary-500'
                      )}
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                  <p className="text-xs text-bark-400 font-body">
                    {audioLevel < 5
                      ? '🔇 No audio detected — check your Bluetooth mic is connected'
                      : '🎙 Mic is picking up audio'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {toggleError && (
            <div className="bg-red-50 border border-red-200 rounded-btn px-4 py-3 flex items-start gap-2">
              <XCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm font-body">{toggleError}</p>
            </div>
          )}

          {/* Must-enable hint */}
          {!bothOn && (
            <div className="bg-amber-50 border border-amber-200 rounded-btn px-4 py-3 text-center">
              <p className="text-amber-700 text-sm font-body">
                Please enable <strong>both</strong> Eye Tracking and Speech Recording to proceed.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn-danger" onClick={() => setShowQuit(true)}>
              <XCircle size={16} /> Quit Test
            </button>
            <button type="button"
              className={clsx('btn-green', !canEnd && 'opacity-40 cursor-not-allowed')}
              disabled={!canEnd || loading}
              onClick={handleEndTest}>
              {loading
                ? <><Spinner size={16} className="text-white" /> Starting...</>
                : <><CheckCircle2 size={16} /> End Test</>
              }
            </button>
          </div>
        </div>
      </Shell>
    </>
  )
}

// ─── Movement Recording Step ──────────────────────────────────────────────────
function MovementRecordingStep({ stream1, timerSeconds, isRecording, fullscreenCam,
  setFullscreenCam, showQuit, setShowQuit, handleQuit, handleStopRecording }: {
  stream1: MediaStream | null
  timerSeconds: number
  isRecording: boolean
  fullscreenCam: { stream: MediaStream; label: string } | null
  setFullscreenCam: (v: { stream: MediaStream; label: string } | null) => void
  showQuit: boolean
  setShowQuit: (v: boolean) => void
  handleQuit: () => void
  handleStopRecording: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sessionDone = timerSeconds === 0
    //const sessionDone = true

  // Attach stream as soon as this component mounts
  useEffect(() => {
    if (videoRef.current && stream1) {
      videoRef.current.srcObject = stream1
      videoRef.current.play().catch(() => {})
    }
  }, [stream1])

  return (
    <>
      <FullscreenCamModal data={fullscreenCam} onClose={() => setFullscreenCam(null)} />
      {showQuit && <QuitModal onConfirm={handleQuit} onCancel={() => setShowQuit(false)} />}
      <Shell title="Movement Tracking Panel">
        <div className="card space-y-5">
          <div className="bg-cream-100 border border-cream-200 rounded-xl px-4 py-4 text-center">
            <p className="text-bark-700 font-display font-semibold mb-1">
              Body tracking is active
            </p>
          </div>

          {/* Timer */}
          <div className="relative overflow-hidden rounded-2xl border border-cream-200 bg-gradient-to-b from-white via-cream-50 to-primary-50/40 px-5 py-7 shadow-sm">
            <div className="absolute inset-0 opacity-30 pointer-events-none">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary-100 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-lime-100 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
              <WaveTimer seconds={timerSeconds} />
            </div>
          </div>

          {/* "Next" only unlocks when timer hits 0 */}
          {!sessionDone && (
            <div className="bg-amber-50 border border-amber-200 rounded-btn px-4 py-3 text-center">
              <p className="text-amber-700 text-sm font-body">
                ⏳ Please wait for the full 5-minute session to complete before proceeding.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="btn-danger" onClick={() => setShowQuit(true)}>
              <XCircle size={16} /> Quit Test
            </button>
            <button
              type="button"
              className={clsx('btn-green', !sessionDone && 'opacity-40 cursor-not-allowed')}
              disabled={!sessionDone}
              onClick={handleStopRecording}
            >
              <ChevronRight size={16} /> Next — Questionnaire
            </button>
          </div>
        </div>
      </Shell>
    </>
  )
}

// Main assessment workflow page that guides the user through child information,
// camera setup, body tracking, questionnaire, processing, and final diagnosis.
export default function NewAssessmentPage() {
  const navigate = useNavigate()

  // Current workflow step and modal state
  const [step, setStep] = useState<Step>('child-info')
  const [showQuit, setShowQuit] = useState(false)
  const [fullscreenCam, setFullscreenCam] = useState<{ stream: MediaStream; label: string } | null>(null)

  // Child information collected before starting the assessment
  const [fullName, setFullName]             = useState('') 
  const [dob, setDob]                       = useState('')
  const [className, setClassName]           = useState('')
  const [teacherName, setTeacherName]       = useState('')
  const [assessmentDate, setAssessmentDate] = useState('')

  // Camera selection and preview state
  const [cameras, setCameras]         = useState<MediaDeviceInfo[]>([])
  const [cam1Id, setCam1Id]           = useState<string>('')
  const [cam2Id, setCam2Id]           = useState<string>('')
  const [stream1, setStream1]         = useState<MediaStream | null>(null)
  const [stream2, setStream2]         = useState<MediaStream | null>(null)
  const [camError, setCamError]       = useState<string>('')
  const [camsReady, setCamsReady]     = useState(false)
  const [loadingCams, setLoadingCams] = useState(false)
  const video1Ref = useRef<HTMLVideoElement>(null)
  const video2Ref = useRef<HTMLVideoElement>(null)

  // Assessment session state, including timer and questionnaire data
  const [assessmentId, setAssessmentId]       = useState<number | null>(null)
  const [answers, setAnswers]                 = useState<Record<string, string>>({})
  const [eyeRecording, setEyeRecording]       = useState(true)
  const [speechRecording, setSpeechRecording] = useState(true)
  const [timerSeconds, setTimerSeconds]       = useState(300)
  const [isRecording, setIsRecording]         = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Processing and diagnosis state shown after the assessment ends
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingSteps, setProcessingSteps]       = useState([false, false, false])
  const [mockResult, setMockResult]                 = useState<any>(null)

  // General loading and error state for the page
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // DOB constraints
  const today      = new Date()
  const minDobDate = new Date(); minDobDate.setFullYear(today.getFullYear() - 15); minDobDate.setDate(minDobDate.getDate() + 1)
  const maxDobDate = new Date(); maxDobDate.setFullYear(today.getFullYear() - 4)
  const ageFromDob = calcAge(dob)
  const dobError = dob
    ? ageFromDob === null ? 'Invalid date'
    : ageFromDob < 4     ? 'Child must be at least 4 years old'
    : ageFromDob > 14    ? 'Child must be 14 years old or younger'
    : null
    : null

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  // Start the 5-minute body tracking timer
  const startTimer = () => {
    setTimerSeconds(300); setIsRecording(true)
    timerRef.current = setInterval(() => {
      setTimerSeconds(s => { if (s <= 1) { stopTimer(); return 0 } return s - 1 })
    }, 1000)
  }
  // Stop the body tracking timer
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setIsRecording(false)
  }

  // Quit the assessment and stop all active media streams
  const handleQuit = () => {
    stopTimer()
    stream1?.getTracks().forEach(t => t.stop())
    stream2?.getTracks().forEach(t => t.stop())
    navigate('/dashboard')
  }

  // Request camera permissions and detect available video input devices
  const requestCameras = async () => {
    setLoadingCams(true); setCamError('')
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      const devices = await navigator.mediaDevices.enumerateDevices()
      const vids = devices.filter(d => d.kind === 'videoinput')
      if (vids.length < 2) {
        setCamError(
          `Only ${vids.length} camera${vids.length === 1 ? '' : 's'} detected. ` +
          'Both cameras must be connected before continuing. ' +
          'Make sure both devices are connected and try again.'
        )
        setCameras(vids); return
      }
      setCameras(vids)
      setCam1Id(vids[0].deviceId)
      setCam2Id(vids[1].deviceId)
    } catch {
      setCamError('Camera permission denied. Please allow camera access in your browser settings.')
    } finally { setLoadingCams(false) }
  }

  // Open a selected camera and attach its stream to the preview video element
  const previewCamera = async (
    deviceId: string,
    videoEl: HTMLVideoElement | null,
    setStream: (s: MediaStream | null) => void,
    existingStream: MediaStream | null,
  ) => {
    existingStream?.getTracks().forEach(t => t.stop())
    if (!deviceId || !videoEl) { setStream(null); return }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }, audio: false,
      })
      videoEl.srcObject = s; videoEl.play(); setStream(s)
    } catch {
      setCamError('Could not open camera. Make sure it is not in use by another app.')
    }
  }

  const handleCam1Change = async (id: string) => {
    setCam1Id(id)
    await previewCamera(id, video1Ref.current, setStream1, stream1)
    setCamsReady(!!id && !!cam2Id && id !== cam2Id)
  }

  const handleCam2Change = async (id: string) => {
    setCam2Id(id)
    await previewCamera(id, video2Ref.current, setStream2, stream2)
    setCamsReady(!!cam1Id && !!id && cam1Id !== id)
  }

  const handlePreviewBoth = async () => {
    if (!cam1Id || !cam2Id) return
    await previewCamera(cam1Id, video1Ref.current, setStream1, stream1)
    await previewCamera(cam2Id, video2Ref.current, setStream2, stream2)
    setCamsReady(true)
  }

  // Validate child information, create the child record, and create a new assessment
  const handleChildInfoNext = async () => {
    setError('')
    if (!fullName.trim())    { setError("Please enter the child's full name."); return }
    if (!dob)                { setError("Please enter the child's date of birth."); return }
    if (dobError)            { setError(dobError); return }
    if (!className.trim())   { setError("Please enter the child's class."); return }
    if (!teacherName.trim()) { setError("Please enter the teacher's name."); return }
    if (!assessmentDate)     { setError("Please select the assessment date."); return }
    setLoading(true)
    try {
      const child = await childrenApi.create({
        full_name: fullName.trim(), age: calcAge(dob) ?? 0,
        class_name: className.trim(), teacher_name: teacherName.trim(),
        assessment_date: assessmentDate,
      })
      const assessment = await assessmentsApi.create({ child_id: child.id })
      setAssessmentId(assessment.id)
      setStep('camera-setup')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error creating record. Please try again.')
    } finally { setLoading(false) }
  }

  // Hand over the selected body-tracking camera to the backend and begin the timed session
  const handleStartRecording = async () => {
    if (assessmentId) {
      const cam1Label = `${cameras.find(c => c.deviceId === cam1Id)?.label ?? 'Camera 1'}::${cameras.findIndex(c => c.deviceId === cam1Id)}`

      try {
        // Hand Camera 1 over to backend, just like eye tracking does
        stream1?.getTracks().forEach(t => t.stop())
        if (video1Ref.current) {
          video1Ref.current.srcObject = null
        }

        await analysisApi.startBodyTracker(assessmentId, cam1Label)
      } catch {
        /* non-fatal */
      }
    }

  startTimer()
  setStep('movement-recording')
}

// End the body tracking stage and move to the questionnaire step
const handleStopRecording = async () => {
  stopTimer()
  setStep('questionnaire')
}

  // Save questionnaire responses, simulate progress, and complete the assessment
  const handleStartProcessing = async () => {
    if (!assessmentId) return
    setLoading(true); setError('')
    try { await assessmentsApi.saveQuestionnaire(assessmentId, answers) } catch { /* non-fatal */ }
    finally { setLoading(false) }

    setStep('processing')
    setProcessingProgress(0)
    setProcessingSteps([false, false, false])
    setTimeout(() => setProcessingSteps([true, false, false]),  800)
    setTimeout(() => setProcessingSteps([true, true,  false]), 2200)
    setTimeout(() => setProcessingSteps([true, true,  true]),  3600)

    const interval = setInterval(() => setProcessingProgress(p => Math.min(p + 10, 90)), 400)
    try {
      //await analysisApi.mockStartAll(assessmentId)
      await new Promise(r => setTimeout(r, 4000))
      clearInterval(interval)
      setProcessingProgress(100)
      const result = await assessmentsApi.complete(assessmentId)
      setMockResult(result)
      await new Promise(r => setTimeout(r, 600))
      setStep('diagnosis')
    } catch {
      clearInterval(interval)
      setError('Processing failed. Please try again.')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Child Info
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'child-info') return (
    <>
      <FullscreenCamModal data={fullscreenCam} onClose={() => setFullscreenCam(null)} />
      {showQuit && <QuitModal onConfirm={handleQuit} onCancel={() => setShowQuit(false)} />}
      <Shell title="Child Information" onBack={() => navigate('/dashboard')}>
        <div className="card space-y-5">
          <div className="flex justify-center mb-2">
            <div className="w-20 h-20 rounded-full bg-cream-200 flex items-center justify-center">
              <User size={36} className="text-bark-400" />
            </div>
          </div>
          <div>
            <label className="label">Full Name</label>
            <input type="text" className="input" placeholder="Enter child's full name"
              value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label">Age (Date of Birth)</label>
            <CalendarPicker value={dob} onChange={setDob} maxDate={maxDobDate} minDate={minDobDate}
              placeholder="Select child's date of birth" />
            {dob && !dobError && ageFromDob !== null && (
              <p className="text-xs text-primary-600 font-body mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} /> Age: {ageFromDob} year{ageFromDob !== 1 ? 's' : ''} old
              </p>
            )}
            {dobError && <p className="text-xs text-red-500 font-body mt-1">⚠ {dobError}</p>}
          </div>
          <div>
            <label className="label">Class</label>
            <input type="text" className="input" placeholder="e.g. 5A, Grade 3"
              value={className} onChange={e => setClassName(e.target.value)} />
          </div>
          <div>
            <label className="label">Teacher</label>
            <input type="text" className="input" placeholder="Enter teacher's name"
              value={teacherName} onChange={e => setTeacherName(e.target.value)} />
          </div>
          <div>
            <label className="label">Assessment Date</label>
            <CalendarPicker value={assessmentDate} onChange={setAssessmentDate}
              minDate={today} placeholder="Select assessment date" />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-btn px-4 py-3 flex items-start gap-2">
              <XCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm font-body">{error}</p>
            </div>
          )}
          <button type="button" className="btn-primary w-full" disabled={loading} onClick={handleChildInfoNext}>
            {loading && <Spinner size={18} className="text-white" />}
            Start Assessment <ChevronRight size={18} />
          </button>
        </div>
      </Shell>
    </>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — Camera Setup
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'camera-setup') return (
    <>
      <FullscreenCamModal data={fullscreenCam} onClose={() => setFullscreenCam(null)} />
      {showQuit && <QuitModal onConfirm={handleQuit} onCancel={() => setShowQuit(false)} />}
      <Shell title="Camera Setup" onBack={() => setStep('child-info')}>
        <div className="card space-y-5">

          {cameras.length === 0 ? (
            /* ── No cameras detected yet ── */
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-cream-100 rounded-full flex items-center justify-center mx-auto">
                <Camera size={28} className="text-bark-400" />
              </div>
              <div>
                <p className="font-display font-semibold text-bark-800 mb-1">Connect Both Cameras</p>
                <p className="text-bark-400 text-sm font-body leading-relaxed">
                  Make sure both cameras are connected before continuing.
                  The browser will ask for permission when you click Detect.
                </p>
              </div>
              <div className="bg-cream-100 rounded-card p-4 text-left space-y-2 text-sm font-body text-bark-600">
                <p className="font-display font-semibold text-bark-800 text-sm mb-2">Setup guide:</p>
                <p>📱 <strong>Mac:</strong> Use Continuity Camera (phone near Mac) + built-in FaceTime camera.</p>
                <p>📱 <strong>Windows:</strong> Install <strong>Iriun Webcam</strong> and <strong>Camo Studio</strong> on both your PC and phone. Both appear as webcams once connected.</p>
              </div>
              {camError && (
                <div className="bg-red-50 border border-red-200 rounded-btn px-4 py-3 text-red-700 text-sm font-body text-left">
                  ⚠ {camError}
                </div>
              )}
              <button type="button" className="btn-primary w-full" disabled={loadingCams} onClick={requestCameras}>
                {loadingCams && <Spinner size={18} className="text-white" />}
                {loadingCams ? 'Detecting...' : 'Detect Cameras'}
              </button>
            </div>

          ) : cameras.length < 2 ? (
            /* ── Only 1 camera — block ── */
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-card p-4 text-sm font-body text-red-700">
                <p className="font-display font-semibold mb-1">⚠ Only 1 Camera Detected</p>
                <p>Both cameras are required. Please connect the second camera and try again.</p>
              </div>
              <button type="button" className="btn-outline w-full" onClick={requestCameras}>
                🔄 Retry Detection
              </button>
            </div>

          ) : (
            /* ── 2+ cameras — assign & preview ── */
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="font-display font-semibold text-bark-700 text-sm">
                  {cameras.length} camera{cameras.length > 1 ? 's' : ''} detected ✓
                </p>
                <button type="button" className="text-xs text-primary-600 font-semibold hover:underline"
                  onClick={requestCameras}>
                  🔄 Refresh
                </button>
              </div>

              {/* Camera 1 */}
              <div className="bg-cream-100 rounded-card p-4 space-y-3">
                <p className="font-display font-semibold text-bark-700 text-sm">Camera 1 — Classroom / Body View</p>
                <p className="text-bark-400 text-xs font-body">Detects movement, posture, and hyperactivity levels</p>
                <select className="input text-sm" value={cam1Id}
                  onChange={e => handleCam1Change(e.target.value)}>
                  <option value="">Select camera...</option>
                  {cameras.map((c, i) => (
                    <option key={c.deviceId} value={c.deviceId} disabled={c.deviceId === cam2Id}>
                      {c.label || `Camera ${i + 1}`}{c.deviceId === cam2Id ? ' (in use by Camera 2)' : ''}
                    </option>
                  ))}
                </select>
                <CamPreview
                  videoRef={video1Ref} stream={stream1}
                  icon={<Camera size={28} />}
                  onExpand={() => setFullscreenCam({ stream: stream1!, label: 'Camera 1 — Classroom / Body View' })}
                />
              </div>

              {/* Camera 2 */}
              <div className="bg-cream-100 rounded-card p-4 space-y-3">
                <p className="font-display font-semibold text-bark-700 text-sm">Camera 2 — Face / Eye Tracking</p>
                <p className="text-bark-400 text-xs font-body">Tracks eye movement and attention span</p>
                <select className="input text-sm" value={cam2Id}
                  onChange={e => handleCam2Change(e.target.value)}>
                  <option value="">Select camera...</option>
                  {cameras.map((c, i) => (
                    <option key={c.deviceId} value={c.deviceId} disabled={c.deviceId === cam1Id}>
                      {c.label || `Camera ${i + 1}`}{c.deviceId === cam1Id ? ' (in use by Camera 1)' : ''}
                    </option>
                  ))}
                </select>
                <CamPreview
                  videoRef={video2Ref} stream={stream2}
                  icon={<Eye size={28} />}
                  onExpand={() => setFullscreenCam({ stream: stream2!, label: 'Camera 2 — Face / Eye Tracking' })}
                />
              </div>

              {cam1Id && cam2Id && !camsReady && (
                <button type="button" className="btn-outline w-full" onClick={handlePreviewBoth}>
                  <Camera size={16} /> Preview Both Cameras
                </button>
              )}

              {camError && (
                <div className="bg-red-50 border border-red-200 rounded-btn px-4 py-3 text-red-700 text-sm font-body">
                  ⚠ {camError}
                </div>
              )}

              {cam1Id && cam2Id && cam1Id === cam2Id && (
                <p className="text-amber-600 text-sm font-body text-center">
                  ⚠ Please select a different camera for each slot.
                </p>
              )}

              <button type="button" className="btn-green w-full"
                disabled={!camsReady || cam1Id === cam2Id}
                onClick={handleStartRecording}>
                Start Recording <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </Shell>
    </>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3 — Movement Recording
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'movement-recording') return (
    <MovementRecordingStep
      stream1={stream1}
      timerSeconds={timerSeconds}
      isRecording={isRecording}
      fullscreenCam={fullscreenCam}
      setFullscreenCam={setFullscreenCam}
      showQuit={showQuit}
      setShowQuit={setShowQuit}
      handleQuit={handleQuit}
      handleStopRecording={handleStopRecording}
    />
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4 — Questionnaire
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'questionnaire') return (
    <QuestionnaireStep
      stream2={stream2}
      fullscreenCam={fullscreenCam}
      setFullscreenCam={setFullscreenCam}
      showQuit={showQuit}
      setShowQuit={setShowQuit}
      handleQuit={handleQuit}
      handleStartProcessing={handleStartProcessing}
      loading={loading}
      assessmentId={assessmentId}
      cam2Label={`${cameras.find(c => c.deviceId === cam2Id)?.label ?? 'Camera 2'}::${cameras.findIndex(c => c.deviceId === cam2Id)}`}
    />
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5 — Processing
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'processing') return (
    <div className="max-w-md mx-auto animate-fade-in">
      <div className="section-header rounded-card mb-6">
        <h2 className="font-display font-bold text-white text-xl">Processing Screen</h2>
      </div>
      <div className="card py-8 space-y-6">
        <div className="space-y-2">
          {['Analyzing motion data...', 'Analyzing eye gaze...', 'Processing speech patterns...'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              {processingSteps[i]
                ? <CheckCircle2 size={16} className="text-primary-600 flex-shrink-0" />
                : <div className="w-4 h-4 rounded-full border-2 border-bark-200 flex-shrink-0" />
              }
              <span className={clsx('font-body text-sm transition-colors',
                processingSteps[i] ? 'text-bark-900 font-medium' : 'text-bark-400')}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <ProcessingGauge progress={processingProgress} />
        <div className="bg-cream-100 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-primary-600 rounded-full transition-all duration-500"
            style={{ width: `${processingProgress}%` }} />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-btn px-4 py-3 text-red-700 text-sm font-body">
            {error}
          </div>
        )}
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6 — Diagnosis
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'diagnosis') return (
    <div className="max-w-md mx-auto animate-fade-in">
      <div className="section-header rounded-card mb-6">
        <h2 className="font-display font-bold text-white text-xl">Final Diagnosis Suggestion</h2>
      </div>
      <div className="card space-y-5">
        <div className={clsx('rounded-card px-5 py-4 text-center',
          mockResult?.adhd_likelihood === 'High'   && 'bg-red-50 border border-red-200',
          mockResult?.adhd_likelihood === 'Medium' && 'bg-amber-50 border border-amber-200',
          mockResult?.adhd_likelihood === 'Low'    && 'bg-primary-50 border border-primary-200',
        )}>
          <p className="font-body text-sm text-bark-500 mb-1">ADHD Likelihood</p>
          <p className={clsx('font-display font-bold text-3xl',
            mockResult?.adhd_likelihood === 'High'   && 'text-red-600',
            mockResult?.adhd_likelihood === 'Medium' && 'text-amber-600',
            mockResult?.adhd_likelihood === 'Low'    && 'text-primary-600',
          )}>
            {mockResult?.adhd_likelihood ?? '—'}
          </p>
        </div>
        <div className="bg-cream-100 rounded-card p-4 space-y-1 text-sm font-body text-bark-500">
          <p>This is an AI-assisted analysis.</p>
          <p>It is <strong>not</strong> a medical diagnosis.</p>
          <p>Please consult a licensed healthcare professional.</p>
        </div>
        <div className="space-y-3">
          <button type="button" className="btn-green w-full"
            onClick={() => navigate(`/reports/${assessmentId}`)}>
            View Report <ChevronRight size={16} />
          </button>
          <button type="button" className="btn-outline w-full" onClick={() => window.print()}>
            Download Report
          </button>
          <button type="button" className="btn-primary w-full" onClick={() => navigate('/reports')}>
            Save Assessment
          </button>
        </div>
      </div>
    </div>
  )

  return null
}