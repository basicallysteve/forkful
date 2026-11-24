'use client'

import { createContext, useContext } from 'react'

/** Skeleton (#374): always waitlist mode until the provider carries the flag value. */
const InviteOnlyContext = createContext<boolean>(true)

export function InviteOnlyProvider({ children }: { value: boolean; children: React.ReactNode }) {
  return <>{children}</>
}

export function useInviteOnly(): boolean {
  return useContext(InviteOnlyContext)
}
