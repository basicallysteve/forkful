'use client'

import { useState } from 'react'
import { Rating } from 'primereact/rating'
import type { ReviewReport } from '@/types/Review'
import { apiDismissReport, apiAdminDeleteReview } from '@/lib/api/reviews'
import '@/views/Admin/admin.scss'

interface Props {
  initialReports: ReviewReport[]
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  offensive_language: 'Offensive language',
  harassment: 'Harassment',
  off_topic: 'Off-topic',
}

const CHEF_ON = <span style={{ fontSize: '16px' }}>👨🏽‍🍳</span>
const CHEF_OFF = <span style={{ fontSize: '16px', opacity: 0.25 }}>👨🏽‍🍳</span>

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminReports({ initialReports }: Props) {
  const [reports, setReports] = useState<ReviewReport[]>(initialReports)
  const [pending, setPending] = useState<number | null>(null)

  async function handleDismiss(reportId: number) {
    setPending(reportId)
    try {
      await apiDismissReport(reportId)
      setReports((prev) => prev.filter((r) => r.id !== reportId))
    } catch {
      // silent — report stays in list
    } finally {
      setPending(null)
    }
  }

  async function handleDeleteReview(reportId: number, reviewId: number) {
    setPending(reportId)
    try {
      await apiAdminDeleteReview(reportId)
      setReports((prev) => prev.filter((r) => r.reviewId !== reviewId))
    } catch {
      // silent
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="admin-reports">
      <header className="admin-reports-header">
        <h1 className="admin-reports-title">Reported Reviews</h1>
        <span className="admin-reports-count">{reports.length} open</span>
      </header>

      {reports.length === 0 && (
        <p className="admin-reports-empty">No open reports. All clear.</p>
      )}

      <div className="admin-report-list">
        {reports.map((report) => (
          <div key={report.id} className="admin-report-card">
            <div className="admin-report-meta">
              <span className="admin-report-reason">{REASON_LABELS[report.reason] ?? report.reason}</span>
              <span className="admin-report-date">Reported {formatDate(report.dateAdded)}</span>
              {report.reporterUsername && (
                <span className="admin-report-reporter">by {report.reporterUsername}</span>
              )}
            </div>

            {report.comment && (
              <p className="admin-report-comment">"{report.comment}"</p>
            )}

            <div className="admin-review-card">
              <div className="admin-review-header">
                <span className="admin-review-author">{report.review.authorUsername ?? 'Anonymous'}</span>
                <span className="admin-review-date">{formatDate(report.review.dateAdded)}</span>
              </div>
              <Rating
                value={report.review.rating}
                readOnly
                onIcon={CHEF_ON}
                offIcon={CHEF_OFF}
                cancel={false}
              />
              {report.review.body && (
                <p className="admin-review-body">{report.review.body}</p>
              )}
              <p className="admin-review-likes">
                ♥ Liked by {report.review.likeCount} chef{report.review.likeCount !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="admin-report-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={pending === report.id}
                onClick={() => handleDismiss(report.id)}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={pending === report.id}
                onClick={() => handleDeleteReview(report.id, report.reviewId)}
              >
                Delete review
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
