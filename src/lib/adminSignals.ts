import type { AdminEventKind } from '@/lib/adminEventKinds'

export const ADMIN_EMAIL_WINDOW_MS = 15 * 60 * 1000

export async function recordAdminEvent(_kind: AdminEventKind): Promise<void> {
  // not implemented
}

export async function flushAdminEvents(): Promise<{ sent: number }> {
  return { sent: 0 }
}
