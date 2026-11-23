import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InviteEmail } from '@/emails/InviteEmail'

const link = 'https://app.example.com/create-account?email=pat%40example.com&code=RAW_CODE'

function text() {
  return renderToStaticMarkup(<InviteEmail inviteUrl={link} />).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
}

describe('InviteEmail', () => {
  it('links to the create-account URL carrying the code', () => {
    const html = renderToStaticMarkup(<InviteEmail inviteUrl={link} />)
    expect(html).toContain(`href="${link.replace(/&/g, '&amp;')}"`)
  })

  it('says Google sign-in with the invited email needs no code', () => {
    expect(text()).toMatch(/Prefer Google\? Sign in with Google using this email address/)
    expect(text()).not.toMatch(/Apple/)
    expect(text()).toMatch(/no code/i)
  })

  it('says the link never expires', () => {
    expect(text()).toMatch(/never expires/i)
  })
})
