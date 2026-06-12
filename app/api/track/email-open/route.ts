/**
 * Email open tracking pixel.
 *
 * Each outgoing email embeds a unique URL pointing here. When a recipient's
 * email client loads the image, this handler fires, letting you record the open.
 *
 * The route always returns a 1×1 transparent GIF regardless of errors so that
 * broken tracking never surfaces visible artefacts to the reader.
 *
 * Usage: GET /api/track/email-open?id=<uuid>
 */

// 1×1 transparent GIF (base-64 encoded)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

const HEADERS = {
  'Content-Type': 'image/gif',
  // Instruct clients not to cache so every genuine open fires a real request.
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    // TODO: persist the open event to a DB table (e.g. email_opens) so you can
    // query open rates per campaign. For now we log to the server console which
    // is visible in Vercel's function logs.
    console.log('[email-open] tracked:', id)
  }

  return new Response(TRANSPARENT_GIF, { headers: HEADERS })
}
