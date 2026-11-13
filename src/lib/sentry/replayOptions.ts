// Session Replay privacy settings. Food logs and pantry contents are personal,
// so mask all text and inputs and block media. These match the Sentry SDK
// defaults; they are set explicitly so a default change can't silently unmask.
export const replayOptions = {
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
} as const
