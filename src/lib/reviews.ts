import { eq, and, isNull, desc, count, avg, gte, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db'
import { reviews, reviewLikes, reviewReports, recipes, users } from '@/db/schema'
import type { Review, ReviewAggregate, CreateReviewInput, UpdateReviewInput, CreateReviewReportInput, ReviewReport } from '@/types/Review'

function mapReview(
  row: typeof reviews.$inferSelect,
  likeCount: number,
  authorUsername: string | null,
  likedByCurrentUser: boolean,
): Review {
  return {
    id: row.id,
    userId: row.userId,
    recipeId: row.recipeId,
    rating: row.rating,
    body: row.body,
    likeCount,
    dateAdded: row.dateAdded,
    dateUpdated: row.dateUpdated,
    authorUsername,
    likedByCurrentUser,
  }
}

export async function getReviewsForRecipe(recipeId: number, viewerUserId?: number): Promise<Review[]> {
  const rows = await db
    .select({
      review: reviews,
      likeCount: count(reviewLikes.id),
      authorUsername: users.username,
    })
    .from(reviews)
    .leftJoin(reviewLikes, eq(reviewLikes.reviewId, reviews.id))
    .leftJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.recipeId, recipeId))
    .groupBy(reviews.id, users.username)
    .orderBy(desc(reviews.dateAdded))

  if (rows.length === 0) return []

  let likedReviewIds = new Set<number>()
  if (viewerUserId !== undefined) {
    const reviewIds = rows.map((r) => r.review.id)
    const likes = await db
      .select({ reviewId: reviewLikes.reviewId })
      .from(reviewLikes)
      .where(and(eq(reviewLikes.userId, viewerUserId), inArray(reviewLikes.reviewId, reviewIds)))
    likedReviewIds = new Set(likes.map((l) => l.reviewId))
  }

  return rows.map((row) =>
    mapReview(
      row.review,
      Number(row.likeCount),
      row.authorUsername ?? null,
      likedReviewIds.has(row.review.id),
    )
  )
}

export async function getReviewAggregate(recipeId: number): Promise<ReviewAggregate> {
  const [row] = await db
    .select({
      averageRating: avg(reviews.rating),
      reviewCount: count(reviews.id),
    })
    .from(reviews)
    .where(eq(reviews.recipeId, recipeId))

  return {
    averageRating: row ? Number(row.averageRating ?? 0) : 0,
    reviewCount: row ? Number(row.reviewCount) : 0,
  }
}

export async function getReviewByUser(userId: number, recipeId: number): Promise<Review | null> {
  const [row] = await db
    .select({
      review: reviews,
      likeCount: count(reviewLikes.id),
      authorUsername: users.username,
    })
    .from(reviews)
    .leftJoin(reviewLikes, eq(reviewLikes.reviewId, reviews.id))
    .leftJoin(users, eq(users.id, reviews.userId))
    .where(and(eq(reviews.userId, userId), eq(reviews.recipeId, recipeId)))
    .groupBy(reviews.id, users.username)

  if (!row) return null
  return mapReview(row.review, Number(row.likeCount), row.authorUsername ?? null, false)
}

export async function createReview(input: CreateReviewInput): Promise<Review> {
  const [recipe] = await db
    .select({ isPublic: recipes.isPublic, userId: recipes.userId })
    .from(recipes)
    .where(and(eq(recipes.id, input.recipeId), isNull(recipes.dateDeleted)))

  if (!recipe || recipe.isPublic !== 1) {
    throw new Error('Reviews can only be submitted on public recipes')
  }
  if (recipe.userId === input.userId) {
    throw new Error('Users cannot review their own recipes')
  }

  const [row] = await db.insert(reviews).values({
    userId: input.userId,
    recipeId: input.recipeId,
    rating: input.rating,
    body: input.body ?? null,
  }).returning()

  const [author] = await db.select({ username: users.username }).from(users).where(eq(users.id, input.userId))
  return mapReview(row, 0, author?.username ?? null, false)
}

export async function updateReview(reviewId: number, userId: number, input: UpdateReviewInput): Promise<Review | null> {
  const updates: Partial<typeof reviews.$inferInsert> = { dateUpdated: new Date() }
  if (input.rating !== undefined) updates.rating = input.rating
  if (input.body !== undefined) updates.body = input.body

  const [row] = await db
    .update(reviews)
    .set(updates)
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
    .returning()

  if (!row) return null

  const [likeRow] = await db.select({ likeCount: count() }).from(reviewLikes).where(eq(reviewLikes.reviewId, reviewId))
  const [author] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId))
  return mapReview(row, Number(likeRow?.likeCount ?? 0), author?.username ?? null, false)
}

export async function deleteReview(reviewId: number): Promise<boolean> {
  const deleted = await db.delete(reviews).where(eq(reviews.id, reviewId)).returning()
  return deleted.length > 0
}

export async function deleteReviewByOwner(reviewId: number, userId: number): Promise<'deleted' | 'not_found' | 'forbidden'> {
  const [existing] = await db.select({ userId: reviews.userId }).from(reviews).where(eq(reviews.id, reviewId))
  if (!existing) return 'not_found'
  if (existing.userId !== userId) return 'forbidden'
  await db.delete(reviews).where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)))
  return 'deleted'
}

export async function toggleReviewLike(userId: number, reviewId: number): Promise<{ liked: boolean }> {
  const [review] = await db.select({ userId: reviews.userId }).from(reviews).where(eq(reviews.id, reviewId))
  if (!review) throw new Error('Review not found')
  if (review.userId === userId) throw new Error('Users cannot like their own reviews')

  const [existing] = await db
    .select()
    .from(reviewLikes)
    .where(and(eq(reviewLikes.userId, userId), eq(reviewLikes.reviewId, reviewId)))

  if (existing) {
    await db.delete(reviewLikes).where(eq(reviewLikes.id, existing.id))
    return { liked: false }
  }

  await db.insert(reviewLikes).values({ userId, reviewId }).onConflictDoNothing()
  return { liked: true }
}

export async function createReviewReport(input: CreateReviewReportInput): Promise<void> {
  await db.insert(reviewReports).values({
    userId: input.userId,
    reviewId: input.reviewId,
    reason: input.reason,
    comment: input.comment ?? null,
  })
}

export async function getReportById(reportId: number): Promise<ReviewReport | null> {
  const author = alias(users, 'author')
  const reporter = alias(users, 'reporter')

  const [row] = await db
    .select({
      report: reviewReports,
      review: reviews,
      likeCount: count(reviewLikes.id),
      reviewAuthorUsername: author.username,
      reporterUsername: reporter.username,
    })
    .from(reviewReports)
    .innerJoin(reviews, eq(reviews.id, reviewReports.reviewId))
    .leftJoin(reviewLikes, eq(reviewLikes.reviewId, reviews.id))
    .leftJoin(author, eq(author.id, reviews.userId))
    .leftJoin(reporter, eq(reporter.id, reviewReports.userId))
    .where(eq(reviewReports.id, reportId))
    .groupBy(reviewReports.id, reviews.id, author.username, reporter.username)

  if (!row) return null
  return {
    id: row.report.id,
    userId: row.report.userId,
    reviewId: row.report.reviewId,
    reason: row.report.reason,
    comment: row.report.comment,
    dateAdded: row.report.dateAdded,
    reporterUsername: row.reporterUsername ?? null,
    review: mapReview(row.review, Number(row.likeCount), row.reviewAuthorUsername ?? null, false),
  }
}

export async function getOpenReports(): Promise<ReviewReport[]> {
  const author = alias(users, 'author')
  const reporter = alias(users, 'reporter')

  const rows = await db
    .select({
      report: reviewReports,
      review: reviews,
      likeCount: count(reviewLikes.id),
      reviewAuthorUsername: author.username,
      reporterUsername: reporter.username,
    })
    .from(reviewReports)
    .innerJoin(reviews, eq(reviews.id, reviewReports.reviewId))
    .leftJoin(reviewLikes, eq(reviewLikes.reviewId, reviews.id))
    .leftJoin(author, eq(author.id, reviews.userId))
    .leftJoin(reporter, eq(reporter.id, reviewReports.userId))
    .groupBy(reviewReports.id, reviews.id, author.username, reporter.username)
    .orderBy(desc(reviewReports.dateAdded))

  return rows.map((row) => ({
    id: row.report.id,
    userId: row.report.userId,
    reviewId: row.report.reviewId,
    reason: row.report.reason,
    comment: row.report.comment,
    dateAdded: row.report.dateAdded,
    reporterUsername: row.reporterUsername ?? null,
    review: mapReview(row.review, Number(row.likeCount), row.reviewAuthorUsername ?? null, false),
  }))
}

export async function dismissReport(reportId: number): Promise<boolean> {
  const deleted = await db.delete(reviewReports).where(eq(reviewReports.id, reportId)).returning()
  return deleted.length > 0
}

export async function getReportsSince(since: Date): Promise<ReviewReport[]> {
  const author = alias(users, 'author')
  const reporter = alias(users, 'reporter')

  const rows = await db
    .select({
      report: reviewReports,
      review: reviews,
      likeCount: count(reviewLikes.id),
      reviewAuthorUsername: author.username,
      reporterUsername: reporter.username,
    })
    .from(reviewReports)
    .innerJoin(reviews, eq(reviews.id, reviewReports.reviewId))
    .leftJoin(reviewLikes, eq(reviewLikes.reviewId, reviews.id))
    .leftJoin(author, eq(author.id, reviews.userId))
    .leftJoin(reporter, eq(reporter.id, reviewReports.userId))
    .where(gte(reviewReports.dateAdded, since))
    .groupBy(reviewReports.id, reviews.id, author.username, reporter.username)
    .orderBy(desc(reviewReports.dateAdded))

  return rows.map((row) => ({
    id: row.report.id,
    userId: row.report.userId,
    reviewId: row.report.reviewId,
    reason: row.report.reason,
    comment: row.report.comment,
    dateAdded: row.report.dateAdded,
    reporterUsername: row.reporterUsername ?? null,
    review: mapReview(row.review, Number(row.likeCount), row.reviewAuthorUsername ?? null, false),
  }))
}
