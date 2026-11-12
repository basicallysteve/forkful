'use client'

interface UndoToast {
  key: number
  message: string
}

interface UndoToastsProps {
  toasts: UndoToast[]
  onUndo: (key: number) => void
}

// Polite live region so screen readers announce each deletion; Undo is a real button, so it is keyboard operable.
export default function UndoToasts({ toasts, onUndo }: UndoToastsProps) {
  return (
    <div className="undo-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.key} className="undo-toast">
          <span className="undo-toast-message">{toast.message}</span>
          <button type="button" className="undo-toast-button" onClick={() => onUndo(toast.key)}>
            Undo
          </button>
        </div>
      ))}
    </div>
  )
}
