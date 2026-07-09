'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

// global-error.tsx replaces the root layout when an unhandled error bubbles all
// the way up, so it must supply its own <html> and <body> tags.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  function openFeedback() {
    const feedback = Sentry.getFeedback()
    if (feedback) {
      feedback.openDialog()
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(_){}`,
          }}
        />
        <style>{`
          *,*::before,*::after{box-sizing:border-box}
          body{
            margin:0;min-height:100vh;
            display:flex;align-items:center;justify-content:center;
            font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            background:#f8fafc;color:#0f172a;
          }
          @media(prefers-color-scheme:dark){
            body{background:#061812;color:#ecfdf5;}
            .error-card{background:#0c2b20!important;border-color:#1c4d38!important;}
          }
          html[data-theme='dark'] body{background:#061812;color:#ecfdf5;}
          html[data-theme='dark'] .error-card{background:#0c2b20!important;border-color:#1c4d38!important;}
          .error-card{
            background:#fff;border:1px solid #e2e8f0;border-radius:12px;
            padding:40px 48px;max-width:480px;width:100%;text-align:center;
            box-shadow:0 4px 24px rgba(0,0,0,0.06);
          }
          h1{margin:0 0 12px;font-size:1.5rem;font-weight:700;}
          p{margin:0 0 28px;color:#64748b;line-height:1.6;}
          .btn-group{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
          .btn{
            border-radius:8px;border:1px solid transparent;
            padding:10px 20px;font-size:0.95rem;font-weight:500;
            font-family:inherit;cursor:pointer;transition:background 150ms,border-color 150ms;
          }
          .btn-primary{background:#10b981;color:#fff;border-color:#10b981;}
          .btn-primary:hover{background:#059669;border-color:#059669;}
          .btn-secondary{background:transparent;color:#64748b;border-color:#e2e8f0;}
          .btn-secondary:hover{border-color:#10b981;color:#0f172a;}
          @media(prefers-color-scheme:dark){
            .btn-secondary{color:#5ab88d;border-color:#1c4d38;}
            .btn-secondary:hover{border-color:#34d399;color:#ecfdf5;}
            p{color:#5ab88d;}
          }
          html[data-theme='dark'] .btn-secondary{color:#5ab88d;border-color:#1c4d38;}
          html[data-theme='dark'] .btn-secondary:hover{border-color:#34d399;color:#ecfdf5;}
          html[data-theme='dark'] p{color:#5ab88d;}
        `}</style>
      </head>
      <body>
        <div className="error-card">
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. You can try again or let us know what happened.</p>
          <div className="btn-group">
            <button className="btn btn-primary" onClick={reset}>
              Try again
            </button>
            <button className="btn btn-secondary" onClick={openFeedback}>
              Report issue
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
