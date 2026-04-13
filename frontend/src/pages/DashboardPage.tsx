import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { assessmentsApi } from '../api/endpoints'
import type { Assessment } from '../types'
import { LikelihoodBadge, Spinner } from '../components/ui'
import { Plus, Sparkles, ClipboardList, ChevronRight } from 'lucide-react'

// Dashboard page showing the main entry points for assessments and reports,
// along with a summary of recently completed assessment results.
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)

// Load all assessments when the dashboard opens
  useEffect(() => {
    assessmentsApi.list()
      .then(setAssessments)
      .finally(() => setLoading(false))
  }, [])

  // Select the most recent completed assessments to display as quick report shortcuts
  const recentCompleted = assessments
    .filter((a) => a.status === 'completed')
    .slice(0, 3)

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Greeting section showing the logged-in user's first name */}
      <div>
        <p className="text-bark-400 font-body text-sm mb-1">Good day,</p>
        <h1 className="font-display font-bold text-bark-900 text-3xl">
          {user?.full_name?.split(' ')[0]} 👋
        </h1>
      </div>

      {/* Main action card with shortcuts to start a new assessment or view reports */}
      <div className="rounded-card overflow-hidden shadow-card">
        <div className="section-header flex items-center gap-3">
          <Sparkles size={20} className="text-white/80" />
          <div>
            <h2 className="font-display font-bold text-white text-xl">ADHD Analyzer</h2>
            <p className="text-primary-200 text-sm font-body">
              AI-based behavioral and cognitive screening
            </p>
          </div>
        </div>

        {/* Quick action buttons for starting a new assessment or opening past reports */}
        <div className="bg-white p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/assessment/new')}
            className="group relative border-2 border-dashed border-bark-200 rounded-card p-6
                       hover:border-primary-500 hover:bg-primary-50 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-bark-800 rounded-lg flex items-center justify-center group-hover:bg-primary-600 transition-colors">
                <Plus size={18} className="text-cream-100" />
              </div>
              <span className="font-display font-semibold text-bark-800">Start New Assessment</span>
            </div>
            <p className="text-bark-400 text-sm font-body">
              Begin a full eye, body & speech analysis session for a child.
            </p>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="group border-2 border-dashed border-bark-200 rounded-card p-6
                       hover:border-primary-500 hover:bg-primary-50 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-bark-800 rounded-lg flex items-center justify-center group-hover:bg-primary-600 transition-colors">
                <ClipboardList size={18} className="text-cream-100" />
              </div>
              <span className="font-display font-semibold text-bark-800">View Past Reports</span>
            </div>
            <p className="text-bark-400 text-sm font-body">
              Review completed assessments and download reports.
            </p>
          </button>
        </div>
      </div>

      {/* Recent completed assessments shown as quick-access report cards */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size={28} className="text-primary-600" />
        </div>
      ) : recentCompleted.length > 0 ? (
        <div>
          <h3 className="font-display font-semibold text-bark-700 mb-3 text-lg">
            Recent Reports
          </h3>
          <div className="space-y-3">
            {recentCompleted.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/reports/${a.id}`)}
                className="w-full card-hover flex items-center gap-4 text-left"
              >
                <div className="w-10 h-10 bg-cream-200 rounded-full flex items-center justify-center font-display font-bold text-bark-700 flex-shrink-0">
                  {a.child?.full_name?.[0]?.toUpperCase() ?? 'C'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-bark-900 truncate">
                    {a.child?.full_name}
                  </p>
                  <p className="text-xs text-bark-400 font-body">
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                {a.adhd_likelihood && (
                  <LikelihoodBadge level={a.adhd_likelihood} />
                )}
                <ChevronRight size={16} className="text-bark-300" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-10">
          <ClipboardList size={40} className="text-bark-200 mx-auto mb-3" />
          <p className="font-display font-semibold text-bark-500">No assessments yet</p>
          <p className="text-bark-400 text-sm font-body mt-1">
            Start your first assessment to see results here.
          </p>
        </div>
      )}
    </div>
  )
}
