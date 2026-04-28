import React from 'react'

interface LinkProps {
  href: string
  children: React.ReactNode
  className?: string
  [key: string]: unknown
}

export default function Link({ href, children, className, ...rest }: LinkProps) {
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  )
}
