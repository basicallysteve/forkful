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

  it('rejects decimal/hex encodings of loopback (URL normalises them to dotted-quad)', () => {
    expect(() => assertFetchableUrl('http://2130706433/x')).toThrow() // 127.0.0.1
    expect(() => assertFetchableUrl('http://0x7f000001/x')).toThrow() // 127.0.0.1
  })

  it('rejects IPv4-mapped / -compatible IPv6 forms of internal targets', () => {
    expect(() => assertFetchableUrl('http://[::ffff:169.254.169.254]/x')).toThrow() // metadata
    expect(() => assertFetchableUrl('http://[::ffff:127.0.0.1]/x')).toThrow() // loopback
    expect(() => assertFetchableUrl('http://[::ffff:a9fe:a9fe]/x')).toThrow() // metadata, hextet form
    expect(() => assertFetchableUrl('http://[::10.0.0.1]/x')).toThrow() // deprecated compatible form
  })

  it('rejects IPv6 unspecified, unique-local and link-local ranges', () => {
    expect(() => assertFetchableUrl('http://[::]/x')).toThrow() // unspecified
    expect(() => assertFetchableUrl('http://[fc00::1]/x')).toThrow() // ULA
    expect(() => assertFetchableUrl('http://[fd12:3456::1]/x')).toThrow() // ULA
    expect(() => assertFetchableUrl('http://[fe80::1]/x')).toThrow() // link-local
  })

  it('still allows a public IPv6 address', () => {
    expect(assertFetchableUrl('http://[2606:4700:4700::1111]/x').hostname).toBe('[2606:4700:4700::1111]')
  })
})
