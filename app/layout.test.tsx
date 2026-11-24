import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSessionUser = vi.fn()
const clientLayoutProps = vi.fn()
vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: '7', name: 'sam', image: null } }) }))
vi.mock('@/lib/auth', () => ({ getSessionUser: () => mockSessionUser() }))
vi.mock('./ClientLayout', () => ({
  default: (props: unknown) => {
    clientLayoutProps(props)
    return null
  },
}))

import RootLayout, { metadata } from './layout'

beforeEach(() => {
  mockSessionUser.mockReset()
  clientLayoutProps.mockReset()
})

async function renderedProps() {
  const element = await RootLayout({ children: null })
  // Walk the element tree to the ClientLayout element and read its props.
  const body = (element.props.children as unknown[]).find(
    (c) => (c as { type?: string })?.type === 'body',
  ) as { props: { children: { props: Record<string, unknown> } } }
  return body.props.children.props
}

describe('root layout metadata', () => {
  it('sets a title template with a default', () => {
    expect(metadata.title).toEqual({ template: '%s | EatForkful', default: 'EatForkful' })
  })

  it('sets metadataBase from the site URL', () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL)
  })
})

describe('root layout nav state (invite-only lock)', () => {
  it('shows the signed-out (marketing) nav when the user has no access', async () => {
    // Signed in with Auth.js, but getSessionUser returns null because there is no Invite.
    mockSessionUser.mockResolvedValue(null)
    expect(await renderedProps()).toMatchObject({ isLoggedIn: false, username: null })
  })

  it('shows the app nav for an allowed user', async () => {
    mockSessionUser.mockResolvedValue({ userId: 1, username: 'sam', avatarUrl: null })
    expect(await renderedProps()).toMatchObject({ isLoggedIn: true, username: 'sam' })
  })
})
