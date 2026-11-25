import type { AdminEventKind, AdminSignalEvent } from '@/lib/adminEventKinds'

export interface ClaimedAdminEvents {
  ids: number[]
  events: AdminSignalEvent[]
  /** When the previous admin email went out (before this claim), or null if none ever did. */
  previousSentAt: Date | null
}

export async function addAdminEvent(_kind: AdminEventKind): Promise<void> {
  throw new Error('not implemented')
}

export async function claimDueAdminEvents(_windowStart: Date): Promise<ClaimedAdminEvents> {
  throw new Error('not implemented')
}

export async function releaseAdminEvents(_ids: number[]): Promise<void> {
  throw new Error('not implemented')
}
