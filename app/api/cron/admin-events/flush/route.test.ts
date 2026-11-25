import { describe, it, expect, vi, beforeEach } from 'vitest'

const flush = vi.fn()
vi.mock('@/lib/adminSignals', () => ({ flushAdminEvents: (...a: unknown[]) => flush(...a) }))

import { GET } from './route'

function req(auth?: string) {
  return new Request('http://localhost/api/cron/admin-events/flush', { headers: auth ? { authorization: auth } : {} })
}

beforeEach(() => {
  flush.mockReset().mockResolvedValue({ sent: 2 })
  vi.stubEnv('CRON_SECRET', 'shh')
})

describe('GET /api/cron/admin-events/flush', () => {
  it('rejects a request without the cron secret', async () => {
    expect((await GET(req())).status).toBe(401)
    expect((await GET(req('Bearer wrong'))).status).toBe(401)
    expect(flush).not.toHaveBeenCalled()
  })

  it('fails closed when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await GET(req('Bearer '))).status).toBe(500)
    expect(flush).not.toHaveBeenCalled()
  })

  it('flushes and reports how many events went out', async () => {
    const res = await GET(req('Bearer shh'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, sent: 2 })
    expect(flush).toHaveBeenCalledTimes(1)
  })
})
