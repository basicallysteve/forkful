import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
)
const getSessionUser = vi.hoisted(() => vi.fn())
const isAdmin = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/auth', () => ({ getSessionUser, isAdmin }))
const isInviteOnly = vi.hoisted(() => vi.fn())
vi.mock('@/lib/inviteOnly', () => ({ isInviteOnly }))
vi.mock('@/views/Admin/AdminWaitlist', () => ({ default: () => null }))

import AdminWaitlistPage from './page'

beforeEach(() => {
  redirect.mockClear()
  getSessionUser.mockReset()
  isAdmin.mockReset()
  isInviteOnly.mockReset().mockResolvedValue(true)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('/admin/waitlist page', () => {
  it('redirects an anonymous visitor to /login', async () => {
    getSessionUser.mockResolvedValue(null)
    await expect(AdminWaitlistPage()).rejects.toThrow('REDIRECT:/login')
  })

  it('redirects a non-admin to /', async () => {
    getSessionUser.mockResolvedValue({ userId: 2 })
    isAdmin.mockReturnValue(false)
    await expect(AdminWaitlistPage()).rejects.toThrow('REDIRECT:/')
  })

  it('renders for the admin, with emails enabled only in production', async () => {
    getSessionUser.mockResolvedValue({ userId: 1 })
    isAdmin.mockReturnValue(true)
    vi.stubEnv('VERCEL_ENV', 'production')
    const el = await AdminWaitlistPage()
    expect(el.props.emailsEnabled).toBe(true)
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect((await AdminWaitlistPage()).props.emailsEnabled).toBe(false)
  })

  it('passes the invite-only mode to the view', async () => {
    getSessionUser.mockResolvedValue({ userId: 1 })
    isAdmin.mockReturnValue(true)
    expect((await AdminWaitlistPage()).props.inviteOnly).toBe(true)
    isInviteOnly.mockResolvedValue(false)
    expect((await AdminWaitlistPage()).props.inviteOnly).toBe(false)
  })
})
