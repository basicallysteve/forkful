import { describe, it, expect } from 'vitest'
import { resolveServing } from './usdaBranded'

describe('resolveServing (count units anchored in grams, #191)', () => {
  const slice = { unit: 'slice', gramsPerUnit: 28 }

  it('count unit with a matching portion: size x weight in grams, calibrated', () => {
    const r = resolveServing(2, 'slice', undefined, [slice])
    expect(r.servingSize).toBe(56)
    expect(r.servingUnit).toBe('g')
    expect(r.scale).toBeCloseTo(0.56)
    expect(r.measurements).toEqual([{ unit: 'g' }, slice])
  })

  it('matches the portion unit case-insensitively and keeps other portions', () => {
    const cup = { unit: 'cup', gramsPerUnit: 100 }
    const r = resolveServing(1, ' Slice ', undefined, [cup, slice])
    expect(r.servingSize).toBe(28)
    expect(r.measurements).toEqual([{ unit: 'g' }, cup, slice])
  })

  it('count unit with no portion: 100 g, per-100 g scale, unit kept uncalibrated', () => {
    const r = resolveServing(2, 'slice', undefined, [])
    expect(r.servingSize).toBe(100)
    expect(r.servingUnit).toBe('g')
    expect(r.scale).toBe(1)
    expect(r.measurements).toEqual([{ unit: 'g' }, { unit: 'slice' }])
  })

  it('count unit whose portions do not match it falls back to 100 g and keeps portions', () => {
    const r = resolveServing(1, 'scoop', undefined, [slice])
    expect(r.servingSize).toBe(100)
    expect(r.scale).toBe(1)
    expect(r.measurements).toEqual([{ unit: 'g' }, { unit: 'scoop' }, slice])
  })

  it('count unit with an unusable size or weight falls back to 100 g', () => {
    expect(resolveServing(0, 'slice', undefined, [slice]).servingSize).toBe(100)
    expect(resolveServing(2, 'slice', undefined, [{ unit: 'slice', gramsPerUnit: 0 }]).servingSize).toBe(100)
  })

  it('mass and volume behave as before', () => {
    const g = resolveServing(30, 'g', undefined, [slice])
    expect(g).toMatchObject({ servingSize: 30, servingUnit: 'g' })
    expect(g.scale).toBeCloseTo(0.3)
    expect(g.measurements).toEqual([{ unit: 'g' }, slice])
    const ml = resolveServing(240, 'ml', 1.03, [])
    expect(ml).toMatchObject({ servingSize: 240, servingUnit: 'ml' })
    expect(ml.scale).toBeCloseTo(2.472)
    expect(ml.measurements).toEqual([{ unit: 'ml' }])
  })
})
