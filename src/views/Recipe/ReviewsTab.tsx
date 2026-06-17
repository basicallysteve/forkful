'use client'

import { useState, useEffect, useCallback } from 'react'
import { Rating } from 'primereact/rating'
import Modal from '@/components/Modal/Modal'
import type { Review, ReviewReportReason } from '@/types/Review'
import {
  apiFetchReviews,
  apiCreateReview,
  apiUpdateReview,
  apiDeleteReview,
  apiToggleReviewLike,
  apiReportReview,
} from '@/lib/api/reviews'

interface Props {
  recipeShortId: string
  isLoggedIn: boolean
  isOwner: boolean
}

const REPORT_REASONS: { value: ReviewReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'offensive_language', label: 'Offensive language' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'off_topic', label: 'Off-topic' },
]

const REVIEW_BODY_MAX = 2000
const REPORT_COMMENT_MAX = 500

const CHEF_ON = <span style={{ fontSize: '20px' }}>👨🏽‍🍳</span>
const CHEF_OFF = <span style={{ fontSize: '20px', opacity: 0.25 }}>👨🏽‍🍳</span>

function CharCount({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length
  return (
    <span className={`char-count${remaining < 0 ? ' char-count--over' : remaining <= max * 0.1 ? ' char-count--warn' : ''}`}>
      {remaining < 0 ? `${Math.abs(remaining)} over limit` : `${remaining} remaining`}
    </span>
  )
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function getMostHelpful(reviews: Review[]): Review | null {
  const withLikes = reviews.filter((r) => r.likeCount > 0)
  if (withLikes.length === 0) return null
  return withLikes.reduce((best, r) =>
    r.likeCount > best.likeCount || (r.likeCount === best.likeCount && new Date(r.dateAdded) < new Date(best.dateAdded))
      ? r
      : best
  )
}

export default function ReviewsTab({ recipeShortId, isLoggedIn, isOwner }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const [newRating, setNewRating] = useState<number>(0)
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRating, setEditRating] = useState<number>(0)
  const [editBody, setEditBody] = useState('')

  const [reportingId, setReportingId] = useState<number | null>(null)
  const [reportReason, setReportReason] = useState<ReviewReportReason>('spam')
  const [reportComment, setReportComment] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)

  const fetchReviews = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    try {
      const data = await apiFetchReviews(recipeShortId)
      if (!signal.aborted) setReviews(data)
    } catch {
      // silent — empty state handles it
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [recipeShortId])

  useEffect(() => {
    const controller = new AbortController()
    fetchReviews(controller.signal)
    return () => controller.abort()
  }, [fetchReviews])

  const myReview = reviews.find((r) => r.isOwnReview) ?? null
  const mostHelpful = getMostHelpful(reviews)
  const otherReviews = mostHelpful ? reviews.filter((r) => r.id !== mostHelpful.id) : reviews

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newRating === 0) return
    setSubmitting(true)
    try {
      const review = await apiCreateReview(recipeShortId, { rating: newRating, body: newBody || undefined })
      setReviews((prev) => [review, ...prev])
      setNewRating(0)
      setNewBody('')
    } catch {
      // leave form intact
    } finally {
      setSubmitting(false)
    }
  }

  function startEditing(review: Review) {
    setEditingId(review.id)
    setEditRating(review.rating)
    setEditBody(review.body ?? '')
  }

  async function handleEditSave(reviewId: number) {
    try {
      const updated = await apiUpdateReview(reviewId, { rating: editRating, body: editBody || null })
      setReviews((prev) => prev.map((r) => r.id === reviewId ? updated : r))
      setEditingId(null)
    } catch {
      // silent
    }
  }

  async function handleDelete(reviewId: number) {
    try {
      await apiDeleteReview(reviewId)
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    } catch {
      // silent
    }
  }

  async function handleLike(reviewId: number) {
    try {
      const { liked } = await apiToggleReviewLike(reviewId)
      setReviews((prev) => prev.map((r) =>
        r.id === reviewId
          ? { ...r, likeCount: liked ? r.likeCount + 1 : r.likeCount - 1, likedByCurrentUser: liked }
          : r
      ))
    } catch {
      // silent
    }
  }

  async function handleReportSubmit() {
    if (!reportingId) return
    setReportSubmitting(true)
    try {
      await apiReportReview(reportingId, { reason: reportReason, comment: reportComment || undefined })
      setReportingId(null)
      setReportComment('')
    } catch {
      // silent
    } finally {
      setReportSubmitting(false)
    }
  }

  function renderReview(review: Review, highlight = false) {
    const isMyReview = review.isOwnReview
    const isEditing = editingId === review.id

    return (
      <div key={review.id} className={`review-card${highlight ? ' review-card--highlight' : ''}`}>
        {highlight && <p className="review-most-helpful-label">Most helpful</p>}
        <div className="review-header">
          <span className="review-author">{review.authorUsername ?? 'Anonymous'}</span>
          <span className="review-date">{formatDate(review.dateAdded)}</span>
          {review.dateUpdated && <span className="review-edited">(edited)</span>}
        </div>

        {isEditing ? (
          <div className="review-edit-form">
            <Rating
              value={editRating}
              onChange={(e) => setEditRating(e.value ?? 0)}
              onIcon={CHEF_ON}
              offIcon={CHEF_OFF}
              cancel={false}
            />
            <textarea
              className="review-body-input"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              placeholder="Update your review…"
            />
            <CharCount value={editBody} max={REVIEW_BODY_MAX} />
            <div className="review-edit-actions">
              <button type="button" className="ghost-button" onClick={() => setEditingId(null)}>Cancel</button>
              <button type="button" className="primary-button" onClick={() => handleEditSave(review.id)} disabled={editBody.length > REVIEW_BODY_MAX}>Save</button>
            </div>
          </div>
        ) : (
          <>
            <Rating
              value={review.rating}
              readOnly
              onIcon={CHEF_ON}
              offIcon={CHEF_OFF}
              cancel={false}
            />
            {review.body && <p className="review-body">{review.body}</p>}
          </>
        )}

        <div className="review-footer">
          <div className="review-footer-left">
            {isLoggedIn && !isMyReview && (
              <button
                type="button"
                className={`review-like-btn${review.likedByCurrentUser ? ' is-liked' : ''}`}
                onClick={() => handleLike(review.id)}
              >
                {review.likedByCurrentUser ? '♥' : '♡'} Liked by {review.likeCount} chef{review.likeCount !== 1 ? 's' : ''}
              </button>
            )}
            {!isLoggedIn && review.likeCount > 0 && (
              <span className="review-like-count">♥ Liked by {review.likeCount} chef{review.likeCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="review-footer-right">
            {isMyReview && !isEditing && (
              <>
                <button type="button" className="ghost-button review-action-btn" onClick={() => startEditing(review)}>Edit</button>
                <button type="button" className="danger-button review-action-btn" onClick={() => handleDelete(review.id)}>Delete</button>
              </>
            )}
            {isLoggedIn && !isMyReview && (
              <button type="button" className="ghost-button review-action-btn" onClick={() => setReportingId(review.id)}>Report</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="reviews-loading">Loading reviews…</div>
  }

  return (
    <div className="reviews-tab">
      {reviews.length > 0 && (
        <div className="reviews-aggregate">
          <span className="reviews-avg-rating">
            {averageRating.toFixed(1)} <span className="reviews-avg-emoji">👨🏽‍🍳</span>
          </span>
          <span className="reviews-count">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {mostHelpful && renderReview(mostHelpful, true)}

      {otherReviews.map((r) => renderReview(r))}

      {reviews.length === 0 && (
        <p className="reviews-empty">No reviews yet. Be the first!</p>
      )}

      {isLoggedIn && !isOwner && !myReview && (
        <form className="review-form" onSubmit={handleSubmit}>
          <h4 className="review-form-heading">Leave a review</h4>
          <Rating
            value={newRating}
            onChange={(e) => setNewRating(e.value ?? 0)}
            onIcon={CHEF_ON}
            offIcon={CHEF_OFF}
            cancel={false}
          />
          <textarea
            className="review-body-input"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
            placeholder="Share your thoughts… (optional)"
          />
          <CharCount value={newBody} max={REVIEW_BODY_MAX} />
          <button
            type="submit"
            className="primary-button"
            disabled={newRating === 0 || submitting || newBody.length > REVIEW_BODY_MAX}
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </button>
        </form>
      )}

      {!isLoggedIn && (
        <p className="reviews-login-prompt">Sign in to leave a review.</p>
      )}

      <Modal
        header="Report this review"
        visible={reportingId !== null}
        onHide={() => { setReportingId(null); setReportComment('') }}
        style={{ width: '420px' }}
      >
        <div className="report-dialog">
          <label className="report-label" htmlFor="report-reason">Reason</label>
          <select
            id="report-reason"
            className="meta-select report-reason-select"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value as ReviewReportReason)}
          >
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <label className="report-label" htmlFor="report-comment">Additional details (optional)</label>
          <textarea
            id="report-comment"
            className="review-body-input"
            value={reportComment}
            onChange={(e) => setReportComment(e.target.value)}
            rows={3}
            placeholder="Describe the issue…"
          />
          <CharCount value={reportComment} max={REPORT_COMMENT_MAX} />
          <div className="report-dialog-actions">
            <button type="button" className="ghost-button" onClick={() => { setReportingId(null); setReportComment('') }}>
              Cancel
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={handleReportSubmit}
              disabled={reportSubmitting || reportComment.length > REPORT_COMMENT_MAX}
            >
              {reportSubmitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
