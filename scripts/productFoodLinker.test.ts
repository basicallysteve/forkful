import { AIBudgetExhaustedError, Models } from '@/lib/ai'
import { describe, it, expect, vi } from 'vitest'
import {
  preprocessName, escapeLike, candidateSearchTerms, selectCandidates, buildUserMessage,
  parseChoice, pickBestFood, resolveLinkModel, DEFAULT_LINK_MODEL, MAX_CANDIDATES,
  parseIntFlag, settleBatch, type CompleteFn,
} from './productFoodLinker'

const cands = [{ id: 42, name: 'Chicken Breast' }, { id: 7, name: 'Chicken Thigh' }]

describe('preprocessName', () => {
  it('strips brand prefix and weight suffix', () => {
    expect(preprocessName('TYSON, BONELESS CHICKEN BREAST, 3 LB')).toBe('BONELESS CHICKEN BREAST')
    expect(preprocessName('Olive Oil 500ml')).toBe('Olive Oil')
  })
  it('keeps initials and mixed-case names', () => {
    expect(preprocessName('A, Thing')).toBe('A, Thing')
  })
})

describe('escapeLike', () => {
  it('escapes wildcards', () => expect(escapeLike('100%_a\\')).toBe('100\\%\\_a\\\\'))
})

describe('selectCandidates', () => {
  it('falls back to first two words', async () => {
    expect(candidateSearchTerms('Boneless Chicken Breast')).toEqual(['Boneless Chicken Breast', 'Boneless Chicken'])
    const search = vi.fn(async (term: string) => (term === 'Boneless Chicken' ? cands : []))
    expect(await selectCandidates('Boneless Chicken Breast', search)).toEqual(cands)
  })
  it('returns [] when nothing matches and caps results', async () => {
    expect(await selectCandidates('Zzz', async () => [])).toEqual([])
    const many = Array.from({ length: 9 }, (_, i) => ({ id: i, name: `f${i}` }))
    expect(await selectCandidates('Zzz', async () => many)).toHaveLength(MAX_CANDIDATES)
  })
})

describe('parseChoice', () => {
  it('accepts only listed IDs', () => {
    expect(parseChoice(' 42 ', cands)).toBe(42)
    expect(parseChoice('99', cands)).toBeNull()
    expect(parseChoice('none', cands)).toBeNull()
    expect(parseChoice('42 because it is chicken', cands)).toBeNull()
  })
})

describe('pickBestFood', () => {
  it('does not call the model without candidates', async () => {
    const completeFn = vi.fn()
    expect(await pickBestFood('x', [], completeFn)).toBeNull()
    expect(completeFn).not.toHaveBeenCalled()
  })
  it('sends tagged prompt and parses the reply', async () => {
    const completeFn = vi.fn<CompleteFn>(async () => '7')
    expect(await pickBestFood('Chicken', cands, completeFn)).toBe(7)
    expect(completeFn.mock.calls[0][0].userMessage).toBe(buildUserMessage('Chicken', cands))
  })
})

describe('resolveLinkModel', () => {
  it('defaults and honours the env override', () => {
    expect(resolveLinkModel({})).toBe(DEFAULT_LINK_MODEL)
    expect(DEFAULT_LINK_MODEL).toBe(Models.anthropicHaiku.model)
    expect(resolveLinkModel({ LINK_PRODUCT_FOODS_MODEL: 'claude-x' })).toBe('claude-x')
  })
})

describe('parseIntFlag', () => {
  it('validates integers against a minimum', () => {
    expect(parseIntFlag('10', 1)).toBe(10)
    expect(parseIntFlag('0', 0)).toBe(0)
    expect(parseIntFlag('0', 1)).toBeNull()
    expect(parseIntFlag('-3', 0)).toBeNull()
    expect(parseIntFlag('1.5', 1)).toBeNull()
    expect(parseIntFlag('abc', 0)).toBeNull()
  })
})

describe('settleBatch', () => {
  const ok = (v: string): PromiseFulfilledResult<string> => ({ status: 'fulfilled', value: v })
  const fail = (reason: unknown): PromiseRejectedResult => ({ status: 'rejected', reason })

  it('keeps all results when nothing failed', () => {
    expect(settleBatch([ok('a'), ok('b')])).toEqual({ results: ['a', 'b'], prefix: 2, budgetExhausted: false, otherError: undefined })
  })
  it('keeps completed siblings of a budget failure and reports the contiguous prefix', () => {
    const r = settleBatch([ok('a'), fail(new AIBudgetExhaustedError()), ok('c')])
    expect(r.results).toEqual(['a', 'c'])
    expect(r.prefix).toBe(1)
    expect(r.budgetExhausted).toBe(true)
    expect(r.otherError).toBeUndefined()
  })
  it('surfaces other errors', () => {
    const boom = new Error('boom')
    const r = settleBatch([fail(boom), ok('b')])
    expect(r.budgetExhausted).toBe(false)
    expect(r.otherError).toBe(boom)
  })
})
