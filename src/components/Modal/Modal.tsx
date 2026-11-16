'use client'

import { Dialog } from 'primereact/dialog'
import './modal.scss'

interface ModalProps {
  visible: boolean
  onHide: () => void
  header: React.ReactNode
  footer?: React.ReactNode
  style?: React.CSSProperties
  children: React.ReactNode
  className?: string
  // Class on the dimmed backdrop that frames the dialog (e.g. to keep it clear of the sticky header).
  maskClassName?: string
  // Fires once the dialog is open and visible; used to move focus to the right field.
  onShow?: () => void
  // Modals are focused overlays, so they are non-draggable by default; a consumer can opt back in.
  draggable?: boolean
}

export default function Modal({ children, className, draggable = false, ...props }: ModalProps) {
  return (
    <Dialog
      {...props}
      className={`app-modal${className ? ` ${className}` : ''}`}
      closeIcon="pi pi-times"
      dismissableMask
      draggable={draggable}
      modal
    >
      {children}
    </Dialog>
  )
}
