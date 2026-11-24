import CreateAccount from '@/views/CreateAccount/CreateAccount'

type SearchParams = Promise<{ email?: string | string[]; code?: string | string[] }>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

/** The Invite Email link is /create-account?email=…&code=… (buildInviteLink in src/lib/inviteLink.ts). */
export default async function CreateAccountPage({ searchParams }: { searchParams: SearchParams }) {
  const { email, code } = await searchParams
  return <CreateAccount email={first(email)} code={first(code)} />
}
