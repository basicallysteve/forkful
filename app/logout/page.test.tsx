import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import LogoutPage from './page'
import * as usersApi from '@/lib/api/users'

vi.mock('@/lib/api/users', () => ({
  apiLogout: vi.fn().mockResolvedValue(undefined),
}))

describe('LogoutPage', () => {
  it('calls apiLogout then navigates to home and refreshes', async () => {
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
      expect(usersApi.apiLogout).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('renders nothing', () => {
    const { container } = render(<LogoutPage />)
    expect(container).toBeEmptyDOMElement()
  })
})
