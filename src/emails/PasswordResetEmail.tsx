interface Props {
  resetUrl: string
}

export function PasswordResetEmail({ resetUrl }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset your Forkful password</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f4f4f5', fontFamily: 'sans-serif' }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#f4f4f5', padding: '40px 16px' }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 560, backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' }}>
                  <tbody>
                    {/* Header */}
                    <tr>
                      <td style={{ padding: '32px 40px 24px', borderBottom: '1px solid #e4e4e7' }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Account Security
                        </p>
                        <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 700, color: '#09090b' }}>
                          Reset your password
                        </h1>
                      </td>
                    </tr>

                    {/* Body */}
                    <tr>
                      <td style={{ padding: '28px 40px' }}>
                        <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.6, color: '#3f3f46' }}>
                          We received a request to reset the password for your Forkful account.
                          Click the button below to choose a new password.
                          This link expires in <strong>1 hour</strong>.
                        </p>

                        <table cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td style={{ borderRadius: 8, backgroundColor: '#4f8ef7' }}>
                                <a
                                  href={resetUrl}
                                  style={{
                                    display: 'inline-block',
                                    padding: '12px 28px',
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: '#ffffff',
                                    textDecoration: 'none',
                                    borderRadius: 8,
                                  }}
                                >
                                  Reset Password
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <p style={{ margin: '24px 0 0', fontSize: 13, color: '#71717a', lineHeight: 1.6 }}>
                          Or copy and paste this link into your browser:
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4f8ef7', wordBreak: 'break-all' }}>
                          {resetUrl}
                        </p>
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={{ padding: '20px 40px 32px', borderTop: '1px solid #e4e4e7' }}>
                        <p style={{ margin: 0, fontSize: 12, color: '#a1a1aa', lineHeight: 1.6 }}>
                          If you didn&apos;t request a password reset you can safely ignore this email.
                          Your password won&apos;t change until you click the link above and set a new one.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}
