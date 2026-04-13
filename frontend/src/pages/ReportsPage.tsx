import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assessmentsApi } from '../api/endpoints'
import type { Assessment } from '../types'
import { LikelihoodBadge, Spinner, EmptyState } from '../components/ui'
import { ClipboardList, ChevronRight, Plus, Folder, FolderOpen, Users } from 'lucide-react'
import clsx from 'clsx'

// Reports page that groups assessment reports by classroom
// and allows the user to expand each class to view student results.
export default function ReportsPage() {
  const navigate = useNavigate()
  const [assessments, setAssessments]   = useState<Assessment[]>([])
  const [loading, setLoading]           = useState(true)
  const [openFolders, setOpenFolders]   = useState<Set<string>>(new Set())

  // Load all assessments when the reports page opens
  useEffect(() => {
    assessmentsApi.list()
      .then(setAssessments)
      .finally(() => setLoading(false))
  }, [])

  // Group assessments by classroom and sort both classrooms and reports by date
  const classrooms = React.useMemo(() => {
    const map = new Map<string, Assessment[]>()
    for (const a of assessments) {
      const cls = a.child?.class_name?.trim() || 'Unassigned'
      if (!map.has(cls)) map.set(cls, [])
      map.get(cls)!.push(a)
    }
    // Sort each classroom by date descending
    for (const [, list] of map) {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    // Sort classrooms alphabetically
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [assessments])

  // Expand or collapse a classroom folder
  const toggleFolder = (cls: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev)
      next.has(cls) ? next.delete(cls) : next.add(cls)
      return next
    })
  }

  // Count how many High, Medium, and Low results exist in one classroom
  const likelihoodCounts = (list: Assessment[]) => {
    const counts = { High: 0, Medium: 0, Low: 0 }
    for (const a of list) {
      if (a.adhd_likelihood === 'High')   counts.High++
      if (a.adhd_likelihood === 'Medium') counts.Medium++
      if (a.adhd_likelihood === 'Low')    counts.Low++
    }
    return counts
  }

  return (
    <div className="animate-fade-in">
      {/* Page header with classroom summary and new assessment action */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-bold text-bark-900 text-3xl">Classrooms</h1>
          <p className="text-bark-400 font-body text-sm mt-1">
            {classrooms.length} classroom{classrooms.length !== 1 ? 's' : ''} · {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => navigate('/assessment/new')} className="btn-primary">
          <Plus size={18} /> New Assessment
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} className="text-primary-600" />
        </div>
      ) : assessments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ClipboardList size={48} />}
            title="No reports yet"
            description="Start your first ADHD assessment to see reports here."
            action={
              <button onClick={() => navigate('/assessment/new')} className="btn-primary">
                <Plus size={18} /> Start Assessment
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {classrooms.map(([cls, list]) => {
            const isOpen  = openFolders.has(cls)
            const counts  = likelihoodCounts(list)
            const hasHigh = counts.High > 0

            return (
              <div key={cls} className="card p-0 overflow-hidden">

                {/* Expandable classroom folder header */}
                <button
                  onClick={() => toggleFolder(cls)}
                  className={clsx(
                    'w-full flex items-center gap-4 px-6 py-4 transition-colors text-left',
                    isOpen ? 'bg-primary-50' : 'hover:bg-cream-50'
                  )}
                >
                  {/* Folder icon showing open or closed classroom state */}
                  <div className={clsx(
                    'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                    isOpen ? 'bg-primary-600' : 'bg-bark-800'
                  )}>
                    {isOpen
                      ? <FolderOpen size={22} className="text-white" />
                      : <Folder size={22} className="text-cream-100" />
                    }
                  </div>

                  {/* Classroom name and summary badges */}
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-bark-900 text-base">{cls}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Users size={12} className="text-bark-400" />
                      <span className="text-xs text-bark-400 font-body">
                        {list.length} student{list.length !== 1 ? 's' : ''}
                      </span>
                      {counts.High > 0 && (
                        <span className="text-xs font-body px-2 py-0.5 rounded-pill bg-red-100 text-red-600 font-semibold">
                          {counts.High} High
                        </span>
                      )}
                      {counts.Medium > 0 && (
                        <span className="text-xs font-body px-2 py-0.5 rounded-pill bg-amber-100 text-amber-600 font-semibold">
                          {counts.Medium} Medium
                        </span>
                      )}
                      {counts.Low > 0 && (
                        <span className="text-xs font-body px-2 py-0.5 rounded-pill bg-primary-100 text-primary-700 font-semibold">
                          {counts.Low} Low
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight
                    size={18}
                    className={clsx(
                      'text-bark-300 transition-transform duration-200 flex-shrink-0',
                      isOpen && 'rotate-90'
                    )}
                  />
                </button>

                {/* Student reports inside the selected classroom */}
                {isOpen && (
                  <div className="divide-y divide-cream-100 border-t border-cream-200">
                    {list.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-4 px-6 py-4 hover:bg-cream-50 transition-colors cursor-pointer group pl-10"
                        onClick={() => navigate(`/reports/${a.id}`)}
                      >
                        {/* Student avatar using the first letter of the child's name */}
                        <div className="w-10 h-10 rounded-full bg-cream-200 flex items-center justify-center font-display font-bold text-bark-700 flex-shrink-0">
                          {a.child?.full_name?.[0]?.toUpperCase() ?? '?'}
                        </div>

                        {/* Student name, date, and assessment status */}
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-semibold text-bark-900">
                            {a.child?.full_name ?? 'Unknown'}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-bark-400 font-body">
                              {new Date(a.created_at).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </span>
                            <span className={clsx(
                              'text-xs font-body capitalize px-2 py-0.5 rounded-pill',
                              a.status === 'completed'  ? 'bg-primary-50 text-primary-700' :
                              a.status === 'processing' ? 'bg-amber-50 text-amber-600' :
                              'bg-gray-100 text-gray-500'
                            )}>
                              {a.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        {/* Final ADHD likelihood badge if available */}
                        <div className="flex-shrink-0">
                          {a.adhd_likelihood
                            ? <LikelihoodBadge level={a.adhd_likelihood} />
                            : <span className="text-xs text-bark-300 font-body italic">—</span>
                          }
                        </div>

                        <ChevronRight size={16} className="text-bark-300 group-hover:text-bark-600 transition-colors flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}