import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

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
