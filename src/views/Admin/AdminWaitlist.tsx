'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Toast } from 'primereact/toast'
import { Skeleton } from 'primereact/skeleton'
import {
  apiDeleteWaitlistEntry,
  apiInvite,
  apiListWaitlist,
  apiRevokeInvite,
  apiSendWaitlistNotice,
  type WaitlistAdminRow,
} from '@/lib/api/waitlistAdmin'
import '@/views/Admin/admin.scss'
import '@/views/Admin/adminWaitlist.scss'

interface Props {
  /** True only in production, where invite emails are really sent. */
  emailsEnabled: boolean
  /** The invite-only flag (ADR-0032). Notices are for the waitlist, so they are off when it is off. */
  inviteOnly: boolean
}

type Confirm = 'revoke' | 'delete'
type RowState = { confirm?: Confirm; busy?: boolean; error?: string; note?: string }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FALLBACK = 'Something went wrong. Please try again.'

const rowKey = (r: WaitlistAdminRow) => (r.entryId !== null ? `e${r.entryId}` : `i${r.inviteId}`)
const focusRow = (key: string, sel = 'button') => () => document.querySelector<HTMLElement>(`[data-row="${key}"] ${sel}`)
const errorText = (e: unknown) => (e instanceof Error ? e.message : FALLBACK)

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminWaitlist({ emailsEnabled, inviteOnly }: Props) {
  const toast = useRef<Toast>(null)
  // Set by a handler to say where focus should land once the next render is committed.
  const focusNext = useRef<(() => HTMLElement | null) | null>(null)
  const [rows, setRows] = useState<WaitlistAdminRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [states, setStates] = useState<Record<string, RowState>>({})
  const [email, setEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ kind: 'error' | 'note'; text: string } | null>(null)
  const [noticeBusy, setNoticeBusy] = useState(false)
  const [noticeMessage, setNoticeMessage] = useState<{ kind: 'error' | 'note'; text: string } | null>(null)

  useEffect(() => {
    const find = focusNext.current
    focusNext.current = null
    find?.()?.focus()
  })

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
  const openConfirm = (key: string, action: Confirm) => {
    focusNext.current = focusRow(key, '[data-action="cancel"]') // Cancel is the safe default for a destructive step
    patch(key, { confirm: action })
  }
  const closeConfirm = (key: string, action: Confirm) => {
    focusNext.current = focusRow(key, `[data-action="${action}"]`)
    patch(key, {})
  }

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
        focusNext.current = focusRow(key, '[data-action="invite"]')
        patch(key, { note: 'Already invited' })
        void load()
        return
      }
      focusNext.current = focusRow(key, '[data-action="revoke"]')
      setRows((prev) =>
        prev?.map((r) => (rowKey(r) === key ? { ...r, invited: true, inviteId: result.inviteId } : r)) ?? prev,
      )
      patch(key, {})
      announceInvite(result.email, result.emailSent)
    } catch (e) {
      focusNext.current = focusRow(key, '[data-action="invite"]')
      patch(key, { error: errorText(e) })
    }
  }

  async function confirmAction(row: WaitlistAdminRow, action: Confirm) {
    const key = rowKey(row)
    const index = rows?.findIndex((r) => rowKey(r) === key) ?? 0
    let nextKey = key
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
        // The Invite outlives its Entry, so an invited row stays as an invite-only row.
        nextKey = `i${row.inviteId}`
        setRows((prev) =>
          row.inviteId === null
            ? (prev?.filter((r) => rowKey(r) !== key) ?? prev)
            : (prev?.map((r) => (rowKey(r) === key ? { ...r, entryId: null, name: null, marketingEmailOptIn: false } : r)) ?? prev),
        )
      }
      patch(key, {})
    } catch (e) {
      patch(key, { error: errorText(e) })
    }
    // Never leave focus on a button that just went away: stay in the row, else go to its neighbour.
    focusNext.current = () => {
      const items = document.querySelectorAll('.admin-waitlist-row')
      return focusRow(nextKey)() ?? (items[index] ?? items[index - 1])?.querySelector<HTMLElement>('button') ?? null
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

  async function sendNotice() {
    if (noticeBusy || !inviteOnly) return
    setNoticeMessage(null)
    setNoticeBusy(true)
    try {
      const { sent, failed } = await apiSendWaitlistNotice()
      const accounts = `${sent} ${sent === 1 ? 'account' : 'accounts'}`
      if (failed > 0) {
        setNoticeMessage({ kind: 'error', text: `Notice sent to ${accounts}, ${failed} failed. Click again to retry.` })
      } else if (sent === 0) {
        setNoticeMessage({ kind: 'note', text: 'Already sent to everyone' })
      } else if (!emailsEnabled) {
        setNoticeMessage({ kind: 'note', text: `Notice recorded for ${accounts} (email not sent in this environment)` })
      } else {
        setNoticeMessage({ kind: 'note', text: `Notice sent to ${accounts}` })
      }
    } catch (err) {
      setNoticeMessage({ kind: 'error', text: errorText(err) })
    } finally {
      setNoticeBusy(false)
    }
  }

  return (
    <div className="admin-reports">
      <Toast ref={toast} />
      <header className="admin-reports-header">
        <h1 className="admin-reports-title">Waitlist</h1>
      </header>

      <section className="admin-waitlist-invite" aria-labelledby="waitlist-notice-heading">
        <h2 id="waitlist-notice-heading" className="admin-waitlist-label">
          One-time notice to existing accounts
        </h2>
        <div className="admin-waitlist-invite-row">
          <button type="button" className="ghost-button" disabled={noticeBusy || !inviteOnly} onClick={() => void sendNotice()}>
            Send waitlist notice
          </button>
        </div>
        <p
          className={`admin-waitlist-message ${noticeMessage?.kind === 'error' ? 'is-error' : 'is-note'}`}
          role={noticeMessage?.kind === 'error' ? 'alert' : 'status'}
        >
          {!inviteOnly ? 'Invite-only is off, so there is no waitlist to notify.' : noticeMessage?.text}
        </p>
      </section>

      <form className="admin-waitlist-invite" onSubmit={inviteEmail} noValidate>
        <label htmlFor="invite-email" className="admin-waitlist-label">
          Invite an email
        </label>
        <div className="admin-waitlist-invite-row">
          <input
            id="invite-email"
            aria-describedby="invite-email-message"
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
          id="invite-email-message"
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
              <Skeleton width="35%" height="0.8rem" className="admin-waitlist-skeleton-sub" />
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
            return (
              <li key={key} className="admin-waitlist-row" data-row={key}>
                <div>
                  <span className="admin-waitlist-email">{row.email}</span>
                  <span className="admin-waitlist-meta">
                    {formatDate(row.dateAdded)}
                    {row.marketingEmailOptIn && <span className="admin-waitlist-tag">Marketing opt-in</span>}
                    {row.invited && <span className="admin-waitlist-tag is-invited">Invited</span>}
                    {row.hasAccount && <span className="admin-waitlist-tag">Has account</span>}
                  </span>
                </div>
                <div
                  className="admin-waitlist-actions"
                  onKeyDown={(e) => e.key === 'Escape' && state.confirm && !state.busy && closeConfirm(key, state.confirm)}
                >
                  {state.confirm ? (
                    <>
                      <button type="button" className="danger-button" aria-label={`Confirm ${state.confirm} for ${row.email}`} disabled={state.busy} onClick={() => confirmAction(row, state.confirm!)}>
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        aria-label={`Cancel ${state.confirm} for ${row.email}`}
                        disabled={state.busy}
                        data-action="cancel"
                        onClick={() => closeConfirm(key, state.confirm!)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {!row.invited && row.entryId !== null && (
                        <button type="button" className="ghost-button" data-action="invite" disabled={state.busy} onClick={() => invite(row)}>
                          Invite
                        </button>
                      )}
                      {row.invited && row.inviteId !== null && (
                        <button type="button" className="ghost-button" data-action="revoke" disabled={state.busy} onClick={() => openConfirm(key, 'revoke')}>
                          Revoke
                        </button>
                      )}
                      {row.entryId !== null && (
                        <button type="button" className="danger-button" data-action="delete" disabled={state.busy} onClick={() => openConfirm(key, 'delete')}>
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
                <p
                  className={`admin-waitlist-message ${state.error ? 'is-error' : 'is-note'}`}
                  role={state.error ? 'alert' : undefined}
                >
                  {state.error ?? state.note}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
