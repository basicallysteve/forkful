'use client'

import { useEffect, useRef } from 'react'
import type { VideoHTMLAttributes } from 'react'

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'autoPlay' | 'loop' | 'muted' | 'playsInline' | 'controls'>

/**
 * A muted, inline video with controls that plays while at least half of it is
 * visible and pauses when it scrolls away. Does not loop. Skips autoplay when
 * the user prefers reduced motion (they can still press play), and ignores a
 * blocked play() call.
 */
export function AutoPlayVideo({ preload = 'metadata', children, ...rest }: Props) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video || typeof IntersectionObserver === 'undefined') return
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[entries.length - 1]
        if (!entry) return
        if (entry.isIntersecting) {
          video.play()?.catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <video ref={ref} controls muted playsInline preload={preload} {...rest}>
      {children}
    </video>
  )
}
