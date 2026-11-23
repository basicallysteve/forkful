import { render } from '@react-email/render'
import { InviteEmail } from '../src/emails/InviteEmail'

export const PREVIEW_INVITE_URL =
  'https://eatforkful.com/create-account?email=chef%40example.com&code=EXAMPLE-CODE'

export function renderInviteEmailPreview(): Promise<string> {
  return render(<InviteEmail inviteUrl={PREVIEW_INVITE_URL} />)
}
