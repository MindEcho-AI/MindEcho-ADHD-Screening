// Reusable UI display components used across the MindEcho frontend
// for status, scores, progress, waveform visuals, and empty states.
import React from 'react'
import clsx from 'clsx'

// ADHD likelihood badge
type Level = 'Low' | 'Medium' | 'High' | string

// Display a colored badge for Low, Medium, or High ADHD likelihood
export function LikelihoodBadge({ level }: { level: Level }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-semibold',
        level === 'Low'    && 'bg-primary-100 text-primary-700',
        level === 'Medium' && 'bg-amber-100 text-amber-700',
        level === 'High'   && 'bg-red-100 text-red-700',
        !['Low','Medium','High'].includes(level) && 'bg-gray-100 text-gray-600',
      )}
    >
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full',
          level === 'Low'    && 'bg-primary-500',
          level === 'Medium' && 'bg-amber-500',
          level === 'High'   && 'bg-red-500',
        )}
      />
      likelihood: {level}
    </span>
  )
}

// Semicircle score gauge
// Show a semicircle gauge for score values from 0 to 100
export function ScoreGauge({ score, label }: { score: number; label?: string }) {
  const clipped = Math.min(100, Math.max(0, score))
  const color =
    clipped < 35 ? '#6B7F3A' :
    clipped < 65 ? '#D97706' : '#DC2626'

  // SVG arc math
  const r = 48, cx = 60, cy = 60
  const startAngle = 180, endAngle = 0
  const angle = startAngle + (clipped / 100) * 180
  const rad = (a: number) => (a * Math.PI) / 180
  const x = cx + r * Math.cos(rad(180 - angle))
  const y = cy - r * Math.sin(rad(180 - angle))

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round"
        />
        {/* Colored arc */}
        {clipped > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${x} ${y}`}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          />
        )}
        {/* Needle dot */}
        <circle cx={x} cy={y} r="5" fill={color} />
        {/* Score text */}
        <text x={cx} y={cy - 4} textAnchor="middle" className="font-display font-bold" fontSize="16" fill="#2C1810">
          {Math.round(clipped)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#9ca3af">/ 100</text>
      </svg>
      {label && <p className="text-xs text-bark-500 font-body mt-0.5">{label}</p>}
    </div>
  )
}

// Circular score display
// Show a circular progress ring for a percentage score
export function RingScore({ score, label, size = 80 }: { score: number; label?: string; size?: number }) {
  const clipped = Math.min(100, Math.max(0, score))
  const r = (size / 2) - 8
  const circumference = 2 * Math.PI * r
  const dash = (clipped / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={clipped >= 65 ? '#6B7F3A' : clipped >= 35 ? '#D97706' : '#DC2626'}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display font-bold text-bark-900 text-sm">{Math.round(clipped)}</span>
        </div>
      </div>
      {label && <p className="text-xs text-bark-500 font-body text-center">{label}</p>}
    </div>
  )
}

// Loading spinner
// Show a simple animated loading spinner
export function Spinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={clsx('animate-spin', className)}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// Speech waveform visual
// Render simplified waveform bars for speech analysis output
export function Waveform({ data }: { data: number[] }) {
  if (!data?.length) return null
  const h = 60, w = 300
  const step = w / data.length

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
      {data.map((v, i) => {
        const barH = Math.abs(v) * (h / 2)
        const y = h / 2 - (v > 0 ? barH : 0)
        return (
          <rect
            key={i}
            x={i * step}
            y={y}
            width={Math.max(1, step - 0.5)}
            height={barH || 1}
            fill={v > 0 ? '#6B7F3A' : '#3D2314'}
            opacity="0.85"
            rx="0.5"
          />
        )
      })}
    </svg>
  )
}

// Status indicator dot
// Show a colored dot representing job or process status
export function StatusDot({ status }: { status: string }) {
  return (
    <span className={clsx(
      'w-2 h-2 rounded-full inline-block',
      status === 'completed'  && 'bg-green-500',
      status === 'processing' && 'bg-amber-400 animate-pulse',
      status === 'pending'    && 'bg-gray-400',
      status === 'failed'     && 'bg-red-500',
    )} />
  )
}

// Empty state placeholder
// Display an empty state message when no data is available
export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-bark-300">{icon}</div>}
      <h3 className="font-display font-semibold text-bark-700 text-lg">{title}</h3>
      {description && <p className="mt-1 text-bark-400 font-body text-sm max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
