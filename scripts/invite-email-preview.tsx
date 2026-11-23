// Renders the Invite email to an HTML file. Sends nothing; touches no env or DB.
// Usage: bun email:preview:invite [output-path]
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderInviteEmailPreview } from './inviteEmailPreview'

const out = process.argv[2] ?? join(tmpdir(), 'invite-email-preview.html')
writeFileSync(out, await renderInviteEmailPreview())
console.log(out)
