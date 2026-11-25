import type { AdminSignalEvent } from '@/lib/adminEventKinds'

export function adminSignalSubject(_events: AdminSignalEvent[]): string {
  return ''
}

export function adminSignalCountLines(_events: AdminSignalEvent[]): string[] {
  return []
}

export function adminSignalText(_events: AdminSignalEvent[], _previousSentAt: Date | null, _adminUrl: string): string {
  return ''
}
