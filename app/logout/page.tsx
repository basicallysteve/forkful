'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiLogout } from '@/lib/api/users'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    apiLogout().then(() => {
      router.push('/')
      router.refresh()
    })
  }, [router])

  return null
}
