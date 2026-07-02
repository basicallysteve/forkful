import { describe, it, expect, afterEach } from 'vitest'
import { getCallbackUrl } from '@/utils/callbackUrl'

function setSearch(url: string) {
  window.history.pushState({}, '', url)
}

describe('getCallbackUrl', () => {
  afterEach(() => setSearch('/'))

  it('returns a same-site relative callbackUrl', () => {
    setSearch('/login?callbackUrl=%2Frecipes%2Fabc123%2Fkorean-beef-bowls')
    expect(getCallbackUrl()).toBe('/recipes/abc123/korean-beef-bowls')
  })

  it('rejects protocol-relative URLs (open-redirect guard)', () => {
    setSearch('/login?callbackUrl=%2F%2Fevil.com')
    expect(getCallbackUrl()).toBe('/')
  })

  it('rejects absolute external URLs', () => {
    setSearch('/login?callbackUrl=https%3A%2F%2Fevil.com')
    expect(getCallbackUrl()).toBe('/')
  })

  it('rejects backslash protocol-relative bypass (browser normalises \\ to /)', () => {
    setSearch('/login?callbackUrl=%2F%5Cevil.com')
    expect(getCallbackUrl()).toBe('/')
  })

  it('defaults to / when the param is absent', () => {
    setSearch('/login')
    expect(getCallbackUrl()).toBe('/')
  })
})
