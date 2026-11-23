import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AutoPlayVideo } from '@/components/AutoPlayVideo/AutoPlayVideo'

type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void

let ioCallback: IOCallback | null = null
let ioOptions: IntersectionObserverInit | undefined
const disconnect = vi.fn()
const playSpy = vi.fn()
const pauseSpy = vi.fn()

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

function intersect(isIntersecting: boolean) {
  act(() => {
    ioCallback?.([{ isIntersecting }])
  })
}

beforeEach(() => {
  ioCallback = null
  ioOptions = undefined
  playSpy.mockReset().mockResolvedValue(undefined)
  pauseSpy.mockReset()
  disconnect.mockReset()
  HTMLMediaElement.prototype.play = playSpy as unknown as typeof HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.pause = pauseSpy
  class MockIO {
    constructor(cb: IOCallback, options?: IntersectionObserverInit) {
      ioCallback = cb
      ioOptions = options
    }
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = disconnect
    takeRecords = vi.fn()
  }
  vi.stubGlobal('IntersectionObserver', MockIO)
  setReducedMotion(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderVideo() {
  return render(
    <AutoPlayVideo aria-label="A clip">
      <source src="/blog/clip.webm" type="video/webm" />
    </AutoPlayVideo>,
  )
}

describe('AutoPlayVideo', () => {
  it('plays when it scrolls into view and pauses when it leaves', () => {
    renderVideo()
    intersect(true)
    expect(playSpy).toHaveBeenCalledTimes(1)
    intersect(false)
    expect(pauseSpy).toHaveBeenCalledTimes(1)
  })

  it('waits until about half the video is visible', () => {
    renderVideo()
    expect(ioOptions?.threshold).toBe(0.5)
  })

  it('does not play before it is visible', () => {
    renderVideo()
    expect(playSpy).not.toHaveBeenCalled()
  })

  it('does not autoplay when the user prefers reduced motion', () => {
    setReducedMotion(true)
    renderVideo()
    intersect(true)
    expect(playSpy).not.toHaveBeenCalled()
  })

  it('swallows a rejected play() (autoplay blocked)', async () => {
    playSpy.mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    renderVideo()
    intersect(true)
    await Promise.resolve()
    expect(playSpy).toHaveBeenCalled()
  })

  it('stays muted, inline, with controls and metadata preload', () => {
    const { container } = renderVideo()
    const video = container.querySelector('video') as HTMLVideoElement
    expect(video.muted).toBe(true)
    expect(video.hasAttribute('playsinline')).toBe(true)
    expect(video.hasAttribute('controls')).toBe(true)
    expect(video.getAttribute('preload')).toBe('metadata')
    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(video.hasAttribute('loop')).toBe(false)
    expect(screen.getByLabelText('A clip')).toBe(video)
  })

  it('disconnects the observer on unmount', () => {
    const { unmount } = renderVideo()
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})
