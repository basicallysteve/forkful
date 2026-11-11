import { describe, it, expect } from 'vitest'
import { decideMeter, RECIPE_VIEW_LIMIT, METER_WINDOW_MS, type MeterPayload } from '@/lib/recipeMeter'

const NOW = 1_700_000_000_000

function payloadWith(ids: string[], periodStart = NOW): MeterPayload {
  return { periodStart, ids }
}

describe('decideMeter', () => {
  it('allows and records the first view for a fresh visitor (null cookie)', () => {
    const { gated, nextPayload } = decideMeter(null, 'aaaaaaaa', NOW)
    expect(gated).toBe(false)
    expect(nextPayload).toEqual({ periodStart: NOW, ids: ['aaaaaaaa'] })
  })

  it('allows up to the limit of distinct recipes', () => {
    const ids = ['a1', 'b2', 'c3', 'd4'] // 4 already seen
    const { gated, nextPayload } = decideMeter(payloadWith(ids), 'e5', NOW)
    expect(gated).toBe(false)
    expect(nextPayload.ids).toHaveLength(RECIPE_VIEW_LIMIT)
    expect(nextPayload.ids).toContain('e5')
  })

  it('gates the (limit + 1)th distinct recipe and does not record it', () => {
    const ids = ['a1', 'b2', 'c3', 'd4', 'e5'] // exactly at the limit
    const { gated, nextPayload } = decideMeter(payloadWith(ids), 'f6', NOW)
    expect(gated).toBe(true)
    expect(nextPayload.ids).toEqual(ids)
    expect(nextPayload.ids).not.toContain('f6')
  })

  it('never gates or re-charges an already-seen recipe, even at the limit', () => {
    const ids = ['a1', 'b2', 'c3', 'd4', 'e5']
    const { gated, nextPayload } = decideMeter(payloadWith(ids), 'c3', NOW)
    expect(gated).toBe(false)
    expect(nextPayload.ids).toEqual(ids)
  })

  it('resets the window once it has expired, allowing a new recipe', () => {
    const ids = ['a1', 'b2', 'c3', 'd4', 'e5']
    const stale = payloadWith(ids, NOW - METER_WINDOW_MS - 1)
    const { gated, nextPayload } = decideMeter(stale, 'f6', NOW)
    expect(gated).toBe(false)
    expect(nextPayload).toEqual({ periodStart: NOW, ids: ['f6'] })
  })

  it('keeps the window open at exactly the boundary (not yet expired)', () => {
    const ids = ['a1', 'b2', 'c3', 'd4', 'e5']
    const boundary = payloadWith(ids, NOW - METER_WINDOW_MS)
    const { gated } = decideMeter(boundary, 'f6', NOW)
    expect(gated).toBe(true)
  })
})
