import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// Components read the session via useSession, which throws without a SessionProvider.
// Default to a signed-in user; tests that care mock 'next-auth/react' themselves.
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'testuser' } }, status: 'authenticated', update: vi.fn() }),
  signOut: vi.fn(),
  signIn: vi.fn(),
  SessionProvider: ({ children }: { children: unknown }) => children,
}))

// Global fetch mock for unit tests – mutations return the request body so Zustand
// stores are updated with the same data sent to the API.
const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
  const method = init?.method?.toUpperCase() ?? 'GET'
  const bodyStr = init?.body as string | undefined
  const body = bodyStr ? JSON.parse(bodyStr) : null
  const status = method === 'DELETE' ? 204 : 200
  const responseBody = method === 'DELETE' ? null : JSON.stringify(body ?? [])
  return Promise.resolve(
    new Response(responseBody, {
      status,
      headers: method !== 'DELETE' ? { 'Content-Type': 'application/json' } : {},
    })
  )
})

global.fetch = fetchMock

beforeEach(() => {
  fetchMock.mockClear()
})
