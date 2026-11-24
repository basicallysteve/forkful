'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Toast } from 'primereact/toast'
import { Skeleton } from 'primereact/skeleton'
import {
  apiDeleteWaitlistEntry,
  apiInvite,
  apiListWaitlist,
  apiRevokeInvite,
  type WaitlistAdminRow,
} from '@/lib/api/waitlistAdmin'
import '@/views/Admin/admin.scss'
import '@/views/Admin/adminWaitlist.scss'

interface Props {
  /** True only in production, where invite emails are really sent. */
  emailsEnabled: boolean
}

type Confirm = 'revoke' | 'delete'
type RowState = { confirm?: Confirm; busy?: boolean; error?: string }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FALLBACK = 'Something went wrong. Please try again.'

const rowKey = (r: WaitlistAdminRow) => (r.entryId !== null ? `e${r.entryId}` : `i${r.inviteId}`)
const errorText = (e: unknown) => (e instanceof Error ? e.message : FALLBACK)

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminWaitlist({ emailsEnabled }: Props) {
  const toast = useRef<Toast>(null)
  const [rows, setRows] = useState<WaitlistAdminRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [states, setStates] = useState<Record<string, RowState>>({})
  const [email, setEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ kind: 'error' | 'note'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setRows(await apiListWaitlist())
    } catch (e) {
      setLoadError(errorText(e))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patch = (key: string, next: RowState) => setStates((s) => ({ ...s, [key]: next }))

  function announceInvite(address: string, emailSent: boolean | undefined) {
    if (!emailsEnabled) {
      toast.current?.show({ severity: 'info', summary: 'Invite created (email not sent in this environment)', life: 4000 })
    } else if (emailSent === false) {
      toast.current?.show({ severity: 'warn', summary: `Invite created for ${address}, but the email did not send`, life: 6000 })
    } else {
      toast.current?.show({ severity: 'success', summary: `Invite sent to ${address}`, life: 4000 })
    }
  }

  async function invite(row: WaitlistAdminRow) {
    if (row.entryId === null) return
    const key = rowKey(row)
    patch(key, { busy: true })
    try {
      const result = await apiInvite({ entryId: row.entryId })
      if (result.status === 'already-invited') {
        patch(key, { error: 'Already invited' })
        void load()
        return
      }
      setRows((prev) =>
        prev?.map((r) => (rowKey(r) === key ? { ...r, invited: true, inviteId: result.inviteId } : r)) ?? prev,
      )
      patch(key, {})
      announceInvite(result.email, result.emailSent)
    } catch (e) {
      patch(key, { error: errorText(e) })
    }
  }

  async function confirmAction(row: WaitlistAdminRow, action: Confirm) {
    const key = rowKey(row)
    patch(key, { busy: true, confirm: action })
    try {
      if (action === 'revoke' && row.inviteId !== null) {
        await apiRevokeInvite(row.inviteId)
        // An Invite with no Waitlist Entry has nothing left to show once revoked.
        setRows((prev) =>
          row.entryId === null
            ? (prev?.filter((r) => rowKey(r) !== key) ?? prev)
            : (prev?.map((r) => (rowKey(r) === key ? { ...r, invited: false, inviteId: null } : r)) ?? prev),
        )
      } else if (action === 'delete' && row.entryId !== null) {
        await apiDeleteWaitlistEntry(row.entryId)
        setRows((prev) => prev?.filter((r) => rowKey(r) !== key) ?? prev)
      }
      patch(key, {})
    } catch (e) {
      patch(key, { error: errorText(e) })
    }
  }

  async function inviteEmail(e: React.FormEvent) {
    e.preventDefault()
    if (emailBusy) return
    const value = email.trim()
    if (!EMAIL_REGEX.test(value)) {
      setEmailMessage({ kind: 'error', text: 'Enter a valid email like pat@example.com' })
      return
    }
    setEmailMessage(null)
    setEmailBusy(true)
    try {
      const result = await apiInvite({ email: value })
      if (result.status === 'already-invited') {
        setEmailMessage({ kind: 'note', text: 'Already invited' })
      } else {
        setEmail('')
        announceInvite(result.email, result.emailSent)
        void load()
      }
    } catch (err) {
      setEmailMessage({ kind: 'error', text: errorText(err) })
    } finally {
      setEmailBusy(false)
    }
  }

  return (
    <div className="admin-reports">
      <Toast ref={toast} />
      <header className="admin-reports-header">
        <h1 className="admin-reports-title">Waitlist</h1>
        {rows && <span className="admin-reports-count">{rows.length}</span>}
      </header>

      <form className="admin-waitlist-invite" onSubmit={inviteEmail} noValidate>
        <label htmlFor="invite-email" className="admin-waitlist-label">
          Invite an email
        </label>
        <div className="admin-waitlist-invite-row">
          <input
            id="invite-email"
            className="text-input"
            type="email"
            value={email}
            placeholder="pat@example.com"
            onChange={(ev) => setEmail(ev.target.value)}
            aria-invalid={emailMessage?.kind === 'error'}
          />
          <button type="submit" className="ghost-button" disabled={emailBusy}>
            Send invite
          </button>
        </div>
        <p
          className={`admin-waitlist-message ${emailMessage?.kind === 'note' ? 'is-note' : 'is-error'}`}
          role={emailMessage?.kind === 'error' ? 'alert' : undefined}
        >
          {emailMessage?.text}
        </p>
      </form>

      {loadError && (
        <div className="admin-waitlist-banner" role="alert">
          <span>{loadError}</span>
          <button type="button" className="ghost-button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {!rows && !loadError && (
        <ul className="admin-waitlist-list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="admin-waitlist-row" data-testid="waitlist-skeleton">
              <Skeleton width="60%" height="1rem" />
              <Skeleton width="35%" height="0.8rem" style={{ marginTop: 8 }} />
            </li>
          ))}
        </ul>
      )}

      {rows && rows.length === 0 && <p className="admin-reports-empty">No one is on the waitlist yet.</p>}

      {rows && rows.length > 0 && (
        <ul className="admin-waitlist-list">
          {rows.map((row) => {
            const key = rowKey(row)
            const state = states[key] ?? {}
            const note = state.error === 'Already invited'
            return (
              <li key={key} className="admin-waitlist-row">
                <div className="admin-waitlist-info">
                  <span className="admin-waitlist-email">{row.email}</span>
                  <span className="admin-waitlist-meta">
                    {formatDate(row.dateAdded)}
                    {row.marketingEmailOptIn && <span className="admin-waitlist-tag">Marketing opt-in</span>}
                    {row.invited && <span className="admin-waitlist-tag is-invited">Invited</span>}
                    {row.hasAccount && <span className="admin-waitlist-tag">Has account</span>}
                  </span>
                </div>
                <div className="admin-waitlist-actions">
                  {state.confirm ? (
                    <>
                      <span className="admin-waitlist-confirm-text">
                        {state.confirm === 'revoke'
                          ? `Revoke the invite for ${row.email}.`
                          : `Delete ${row.email} from the waitlist? Their account, if any, is kept.`}
                      </span>
                      <button type="button" className="danger-button" disabled={state.busy} onClick={() => confirmAction(row, state.confirm!)}>
                        Confirm
                      </button>
                      <button type="button" className="ghost-button" disabled={state.busy} onClick={() => patch(key, {})}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {!row.invited && row.entryId !== null && (
                        <button type="button" className="ghost-button" disabled={state.busy} onClick={() => invite(row)}>
                          Invite
                        </button>
                      )}
                      {row.invited && row.inviteId !== null && (
                        <button type="button" className="ghost-button" disabled={state.busy} onClick={() => patch(key, { confirm: 'revoke' })}>
                          Revoke
                        </button>
                      )}
                      {row.entryId !== null && (
                        <button type="button" className="danger-button" disabled={state.busy} onClick={() => patch(key, { confirm: 'delete' })}>
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
                <p
                  className={`admin-waitlist-message ${note ? 'is-note' : 'is-error'}`}
                  role={state.error && !note ? 'alert' : undefined}
                >
                  {state.error}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
