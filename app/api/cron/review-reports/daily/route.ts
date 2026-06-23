import { NextResponse } from 'next/server'
import { getReportsSince } from '@/lib/reviews'
import { sendReviewReportSummaryEmail } from '@/lib/email'
import { getUser } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminId = process.env.ADMIN_USER_ID
  if (!adminId) {
    return NextResponse.json({ error: 'ADMIN_USER_ID not configured' }, { status: 500 })
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const reports = await getReportsSince(since)

    if (reports.length === 0) {
      return NextResponse.json({ ok: true, sent: false, reason: 'no reports in last 24h' })
    }

    const admin = await getUser(Number(adminId))
    if (!admin) {
      return NextResponse.json({ error: 'Admin user not found' }, { status: 500 })
    }

    const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'https://eatforkful.com'
    const adminUrl = `${baseUrl}/admin/reports`

    await sendReviewReportSummaryEmail({
      to: admin.email,
      reportCount: reports.length,
      reports: reports.map((r) => ({
        reason: r.reason,
        reviewAuthor: r.review.authorUsername,
        reviewRating: r.review.rating,
        reviewBody: r.review.body,
        reportedAt: new Date(r.dateAdded).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        reporterUsername: r.reporterUsername,
        reportComment: r.comment,
      })),
      adminUrl,
    })

    return NextResponse.json({ ok: true, sent: true, count: reports.length })
  } catch (err) {
    console.error('[cron/review-reports/daily]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
