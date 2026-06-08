import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import LogoutPage from './page'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}))

import { signOut } from 'next-auth/react'

describe('LogoutPage', () => {
  it('calls signOut then navigates to home and refreshes', async () => {
    const mockPush = vi.fn()
    const mockRefresh = vi.fn()
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    })

    render(<LogoutPage />)

    await vi.waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ redirect: false })
      expect(mockPush).toHaveBeenCalledWith('/')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('renders nothing', () => {
    const { container } = render(<LogoutPage />)
    expect(container).toBeEmptyDOMElement()
  })
})
