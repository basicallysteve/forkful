'use client'

import { useTheme } from '@/hooks/useTheme'
export default function ThemedLogo({ size = 34 }: { size?: number }) {
    const { theme } = useTheme()
    const src = theme === 'dark' ? '/forkful-icon-inverse.svg' : '/forkful-icon-primary.svg'
    return (
        <img
            src={src}
            alt="EatForkful logo"
            width={size}
            height={size}
            style={{ display: 'block' }}
        />
    )
}
