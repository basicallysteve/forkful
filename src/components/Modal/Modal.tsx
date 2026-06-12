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
}

export default function Modal({ children, className, ...props }: ModalProps) {
  return (
    <Dialog
      {...props}
      className={`app-modal${className ? ` ${className}` : ''}`}
      closeIcon="pi pi-times"
      dismissableMask
      modal
    >
      {children}
    </Dialog>
  )
}
