import { absoluteUrl } from '@/lib/seo'

export function buildInviteLink(email: string, code: string): string {
  return absoluteUrl(`/create-account?${new URLSearchParams({ email, code })}`)
}
