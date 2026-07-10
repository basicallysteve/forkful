import { describe, it, expect } from 'vitest'
import { assertFetchableUrl } from './urlFetchGuard'

describe('assertFetchableUrl', () => {
  it('accepts a normal public http(s) URL', () => {
    expect(assertFetchableUrl('https://www.example.com/recipes/1').hostname).toBe('www.example.com')
    expect(assertFetchableUrl('http://cooking.nytimes.com/x').hostname).toBe('cooking.nytimes.com')
  })

  it('rejects non-http schemes', () => {
    expect(() => assertFetchableUrl('ftp://example.com/x')).toThrow()
    expect(() => assertFetchableUrl('file:///etc/passwd')).toThrow()
    expect(() => assertFetchableUrl('data:text/html,hi')).toThrow()
  })

  it('rejects a malformed URL', () => {
    expect(() => assertFetchableUrl('not a url')).toThrow('Invalid URL')
  })

  it('rejects loopback and localhost', () => {
    expect(() => assertFetchableUrl('http://localhost:3000/x')).toThrow()
    expect(() => assertFetchableUrl('http://127.0.0.1/x')).toThrow()
    expect(() => assertFetchableUrl('http://127.9.9.9/x')).toThrow()
    expect(() => assertFetchableUrl('http://[::1]/x')).toThrow()
  })

  it('rejects private ranges', () => {
    expect(() => assertFetchableUrl('http://10.0.0.5/x')).toThrow()
    expect(() => assertFetchableUrl('http://192.168.1.1/x')).toThrow()
    expect(() => assertFetchableUrl('http://172.16.0.1/x')).toThrow()
    expect(() => assertFetchableUrl('http://172.31.255.255/x')).toThrow()
  })

  it('allows public IPs just outside the private 172.16/12 block', () => {
    expect(assertFetchableUrl('http://172.15.0.1/x').hostname).toBe('172.15.0.1')
    expect(assertFetchableUrl('http://172.32.0.1/x').hostname).toBe('172.32.0.1')
  })

  it('rejects the cloud metadata link-local address', () => {
    expect(() => assertFetchableUrl('http://169.254.169.254/latest/meta-data/')).toThrow()
  })
})
