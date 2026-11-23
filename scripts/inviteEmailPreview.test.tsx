import { describe, it, expect } from 'vitest'
import { renderInviteEmailPreview, PREVIEW_INVITE_URL } from './inviteEmailPreview'

describe('renderInviteEmailPreview', () => {
  it('renders the invite email HTML with the made-up link', async () => {
    const html = await renderInviteEmailPreview()
    expect(html).toContain('<html')
    expect(html).toContain(PREVIEW_INVITE_URL.replace(/&/g, '&amp;'))
  })
})
