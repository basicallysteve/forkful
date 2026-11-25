import { apiFetch, ensureOk } from './errors'
import type { Review, ReviewReportReason, ReviewReport } from '@/types/Review'

export async function apiFetchReviews(recipeShortId: string): Promise<Review[]> {
  const res = await apiFetch(`/api/recipes/${recipeShortId}/reviews`)
  await ensureOk(res, 'Failed to fetch reviews')
  return res.json()
}

export async function apiCreateReview(recipeShortId: string, data: { rating: number; body?: string }): Promise<Review> {
  const res = await apiFetch(`/api/recipes/${recipeShortId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  await ensureOk(res, 'Failed to create review')
  return res.json()
}

export async function apiUpdateReview(reviewId: number, data: { rating?: number; body?: string | null }): Promise<Review> {
  const res = await apiFetch(`/api/reviews/${reviewId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  await ensureOk(res, 'Failed to update review')
  return res.json()
}

export async function apiDeleteReview(reviewId: number): Promise<void> {
  const res = await apiFetch(`/api/reviews/${reviewId}`, { method: 'DELETE' })
  await ensureOk(res, 'Failed to delete review', [204])
}

export async function apiToggleReviewLike(reviewId: number): Promise<{ liked: boolean }> {
  const res = await apiFetch(`/api/reviews/${reviewId}/like`, { method: 'POST' })
  await ensureOk(res, 'Failed to toggle like')
  return res.json()
}

export async function apiReportReview(reviewId: number, data: { reason: ReviewReportReason; comment?: string }): Promise<void> {
  const res = await apiFetch(`/api/reviews/${reviewId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  await ensureOk(res, 'Failed to submit report')
}

export async function apiFetchAdminReports(): Promise<ReviewReport[]> {
  const res = await apiFetch('/api/admin/reports')
  await ensureOk(res, 'Failed to fetch reports')
  return res.json()
}

export async function apiDismissReport(reportId: number): Promise<void> {
  const res = await apiFetch(`/api/admin/reports/${reportId}`, { method: 'DELETE' })
  await ensureOk(res, 'Failed to dismiss report', [204])
}

export async function apiAdminDeleteReview(reportId: number): Promise<void> {
  const res = await apiFetch(`/api/admin/reports/${reportId}/review`, { method: 'DELETE' })
  await ensureOk(res, 'Failed to delete review', [204])
}
