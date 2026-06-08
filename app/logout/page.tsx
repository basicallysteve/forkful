'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    signOut({ redirect: false }).then(() => {
      router.push('/')
      router.refresh()
    })
  }, [router])

  return null
}
