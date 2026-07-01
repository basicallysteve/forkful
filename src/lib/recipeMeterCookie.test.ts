import { describe, it, expect } from 'vitest'
import { signMeter, readMeter } from '@/lib/recipeMeterCookie'
import { type MeterPayload } from '@/lib/recipeMeter'

const SECRET = 'test-secret-value'

describe('recipe meter cookie codec', () => {
  const payload: MeterPayload = { periodStart: 1_700_000_000_000, ids: ['aaaaaaaa', 'bbbbbbbb'] }

  it('round-trips a signed payload', async () => {
    const cookie = await signMeter(payload, SECRET)
    expect(await readMeter(cookie, SECRET)).toEqual(payload)
  })

  it('rejects a payload signed with a different secret', async () => {
    const cookie = await signMeter(payload, SECRET)
    expect(await readMeter(cookie, 'other-secret')).toBeNull()
  })

  it('rejects a tampered body', async () => {
    const cookie = await signMeter(payload, SECRET)
    const [body, sig] = cookie.split('.')
    const forgedBody = btoa(JSON.stringify({ periodStart: payload.periodStart, ids: ['xxxxxxxx', 'yyyyyyyy', 'zzzzzzzz'] }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await readMeter(`${forgedBody}.${sig}`, SECRET)).toBeNull()
    // sanity: the original still verifies
    expect(await readMeter(`${body}.${sig}`, SECRET)).toEqual(payload)
  })

  it('returns null for missing or malformed cookies', async () => {
    expect(await readMeter(undefined, SECRET)).toBeNull()
    expect(await readMeter('', SECRET)).toBeNull()
    expect(await readMeter('no-dot-separator', SECRET)).toBeNull()
  })
})
