import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WaitlistNoticeEmail } from '@/emails/WaitlistNoticeEmail'

const leaveUrl = 'https://app.example.com/waitlist/leave?token=abc.def'

function render() {
  return renderToStaticMarkup(<WaitlistNoticeEmail username="pat" leaveUrl={leaveUrl} />)
}
function text() {
  return render().replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')
}

describe('WaitlistNoticeEmail', () => {
  it('uses the approved wording with the username filled in', () => {
    expect(text()).toContain(
      'Hi pat, EatForkful is invite-only for now. Your account is on the waitlist and your recipes, pantry and food log are safe. ' +
        "We'll email you when your invite is ready. If you'd rather not wait, you can leave the waitlist and deactivate your account:",
    )
  })

  it('shows a "Leave the waitlist" link whose href is the signed URL, not the raw URL as text', () => {
    const html = render()
    expect(html).toContain(`<a href="${leaveUrl}"`)
    expect(html).toContain('>Leave the waitlist</a>')
    expect(text()).not.toContain(leaveUrl)
  })

  it('escapes a username that contains markup', () => {
    const html = renderToStaticMarkup(<WaitlistNoticeEmail username="<b>x</b>" leaveUrl={leaveUrl} />)
    expect(html).not.toContain('<b>x</b>')
  })
})
