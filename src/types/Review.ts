export type Review = {
  id: number
  userId: number | null
  recipeId: number
  rating: number
  body: string | null
  likeCount: number
  dateAdded: Date
  dateUpdated: Date | null
  authorUsername: string | null
  likedByCurrentUser: boolean
}

export type ReviewAggregate = {
  averageRating: number
  reviewCount: number
}

export type ReviewReportReason = 'spam' | 'offensive_language' | 'harassment' | 'off_topic'

export type CreateReviewInput = {
  userId: number
  recipeId: number
  rating: number
  body?: string
}

export type UpdateReviewInput = {
  rating?: number
  body?: string | null
}

export type CreateReviewReportInput = {
  userId: number
  reviewId: number
  reason: ReviewReportReason
  comment?: string
}

export type ReviewReport = {
  id: number
  userId: number | null
  reviewId: number
  reason: ReviewReportReason
  comment: string | null
  dateAdded: Date
  review: Review
  reporterUsername: string | null
}
