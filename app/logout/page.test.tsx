import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import LogoutPage from './page'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}))

import { signOut } from 'next-auth/react'

describe('LogoutPage', () => {
  it('calls signOut with callbackUrl "/"', async () => {
    render(<LogoutPage />)

    await vi.waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' })
    })
  })

  it('renders nothing', () => {
    const { container } = render(<LogoutPage />)
    expect(container).toBeEmptyDOMElement()
  })
})
