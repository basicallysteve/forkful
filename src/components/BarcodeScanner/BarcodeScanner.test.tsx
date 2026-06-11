import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BarcodeScanner from './BarcodeScanner'

// barcode-detector installs BarcodeDetector on globalThis when the module loads.
// Tests that need to simulate camera failure still have it in window; we only
// delete it for specific isolation tests (see below).

const mockTrackStop = vi.fn()
const mockStream = { getTracks: () => [{ stop: mockTrackStop }] }
const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream)

beforeEach(() => {
  mockTrackStop.mockClear()
  mockGetUserMedia.mockClear()
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true,
  })
  HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined)
})

describe('BarcodeScanner', () => {
  describe('camera view', () => {
    it('renders the camera view and hint text', () => {
      render(<BarcodeScanner onDetected={vi.fn()} />)
      expect(screen.getByText('Point camera at a food barcode')).toBeInTheDocument()
    })

    it('requests the environment-facing camera', async () => {
      render(<BarcodeScanner onDetected={vi.fn()} />)
      await waitFor(() => expect(mockGetUserMedia).toHaveBeenCalled())
      expect(mockGetUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' } })
    })

    it('stops all tracks when unmounted', async () => {
      const { unmount } = render(<BarcodeScanner onDetected={vi.fn()} />)
      await waitFor(() => expect(mockGetUserMedia).toHaveBeenCalled())
      unmount()
      expect(mockTrackStop).toHaveBeenCalled()
    })
  })

  describe('when camera access is denied', () => {
    beforeEach(() => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'))
    })

    it('shows the camera error message', async () => {
      render(<BarcodeScanner onDetected={vi.fn()} />)
      await waitFor(() =>
        expect(screen.getByText(/could not access camera/i)).toBeInTheDocument()
      )
    })

    it('shows the manual entry form as fallback', async () => {
      render(<BarcodeScanner onDetected={vi.fn()} />)
      await waitFor(() =>
        expect(screen.getByLabelText('Barcode number')).toBeInTheDocument()
      )
    })
  })

  // The iOS code path (lazy polyfill import) cannot be isolated in jsdom because
  // barcode-detector installs itself on globalThis as a side effect when the module
  // first loads, so 'BarcodeDetector' in window is always true in the test environment.
  // The lazy-import branch is exercised in production Safari where the native API is absent.
  describe('when BarcodeDetector is not in window (simulated)', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).BarcodeDetector
    })

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).BarcodeDetector
    })

    it('still renders the camera view', () => {
      render(<BarcodeScanner onDetected={vi.fn()} />)
      expect(screen.getByText('Point camera at a food barcode')).toBeInTheDocument()
    })
  })

  describe('manual barcode entry', () => {
    it('calls onDetected with the entered barcode on submit', async () => {
      const user = userEvent.setup()
      const onDetected = vi.fn()
      render(<BarcodeScanner onDetected={onDetected} />)

      await user.type(screen.getByLabelText('Barcode number'), '1234567890128')
      await user.click(screen.getByRole('button', { name: /look up/i }))

      expect(onDetected).toHaveBeenCalledWith('1234567890128')
    })

    it('clears the input after submit', async () => {
      const user = userEvent.setup()
      render(<BarcodeScanner onDetected={vi.fn()} />)
      const input = screen.getByLabelText('Barcode number')

      await user.type(input, '1234567890128')
      await user.click(screen.getByRole('button', { name: /look up/i }))

      expect(input).toHaveValue('')
    })

    it('disables the submit button when input is empty', () => {
      render(<BarcodeScanner onDetected={vi.fn()} />)
      expect(screen.getByRole('button', { name: /look up/i })).toBeDisabled()
    })
  })
})
