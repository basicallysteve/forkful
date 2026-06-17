import type { Review, ReviewReportReason, ReviewReport } from '@/types/Review'

export async function apiFetchReviews(recipeShortId: string): Promise<Review[]> {
  const res = await fetch(`/api/recipes/${recipeShortId}/reviews`)
  if (!res.ok) throw new Error('Failed to fetch reviews')
  return res.json()
}

export async function apiCreateReview(recipeShortId: string, data: { rating: number; body?: string }): Promise<Review> {
  const res = await fetch(`/api/recipes/${recipeShortId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create review')
  return res.json()
}

export async function apiUpdateReview(reviewId: number, data: { rating?: number; body?: string | null }): Promise<Review> {
  const res = await fetch(`/api/reviews/${reviewId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update review')
  return res.json()
}

export async function apiDeleteReview(reviewId: number): Promise<void> {
  const res = await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete review')
}

export async function apiToggleReviewLike(reviewId: number): Promise<{ liked: boolean }> {
  const res = await fetch(`/api/reviews/${reviewId}/like`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to toggle like')
  return res.json()
}

export async function apiReportReview(reviewId: number, data: { reason: ReviewReportReason; comment?: string }): Promise<void> {
  const res = await fetch(`/api/reviews/${reviewId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to submit report')
}

export async function apiFetchAdminReports(): Promise<ReviewReport[]> {
  const res = await fetch('/api/admin/reports')
  if (!res.ok) throw new Error('Failed to fetch reports')
  return res.json()
}

export async function apiDismissReport(reportId: number): Promise<void> {
  const res = await fetch(`/api/admin/reports/${reportId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to dismiss report')
}

export async function apiAdminDeleteReview(reportId: number): Promise<void> {
  const res = await fetch(`/api/admin/reports/${reportId}/review`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete review')
}
