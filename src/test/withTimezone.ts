import { afterAll, beforeAll } from 'vitest'

// Run a describe block in a fixed IANA timezone (e.g. 'America/New_York', behind UTC). Node re-reads
// process.env.TZ at runtime, so Date/moment local-time behavior follows it for the block's tests.
export function useTimezone(tz: string) {
  let original: string | undefined
  beforeAll(() => {
    original = process.env.TZ
    process.env.TZ = tz
  })
  afterAll(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })
}
