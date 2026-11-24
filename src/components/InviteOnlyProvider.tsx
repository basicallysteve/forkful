'use client'

import { createContext, useContext } from 'react'

/**
 * Carries the `invite-only-access` flag (decided on the server in the root layout) to client
 * components, so none of them fetches a flag. Defaults to waitlist mode (the safe side).
 */
const InviteOnlyContext = createContext<boolean>(true)

export function InviteOnlyProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <InviteOnlyContext.Provider value={value}>{children}</InviteOnlyContext.Provider>
}

export function useInviteOnly(): boolean {
  return useContext(InviteOnlyContext)
}
