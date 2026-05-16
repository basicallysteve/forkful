'use client'

import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerProps {
  onDetected: (code: string) => void
}

// BarcodeDetector is not in lib.dom.d.ts yet so we declare it minimally
declare class BarcodeDetector {
  constructor(options?: { formats: string[] })
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}

export default function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastDetectedRef = useRef<string | null>(null)
  // Lazy initializer avoids calling setState synchronously inside an effect
  const [isSupported] = useState<boolean>(() => typeof window !== 'undefined' && 'BarcodeDetector' in window)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    if (!isSupported || !videoRef.current) return

    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        const detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
        })

        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || cancelled) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue
              // Stop after first unique detection to prevent overlapping lookups
              if (code !== lastDetectedRef.current) {
                lastDetectedRef.current = code
                if (intervalRef.current) clearInterval(intervalRef.current)
                onDetected(code)
              }
            }
          } catch {
            // detection errors are expected on empty frames
          }
        }, 300)
      } catch {
        if (!cancelled) {
          setCameraError('Could not access camera. Please enter the barcode manually.')
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [isSupported, onDetected])

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = manualCode.trim()
    if (code) {
      onDetected(code)
      setManualCode('')
    }
  }

  if (isSupported === null) return null

  return (
    <div className="barcode-scanner">
      {isSupported && !cameraError ? (
        <div className="barcode-camera-view">
          <video ref={videoRef} className="barcode-video" playsInline muted />
          <div className="barcode-scan-overlay">
            <div className="barcode-scan-target" />
          </div>
          <p className="barcode-hint">Point camera at a food barcode</p>
        </div>
      ) : (
        <p className="barcode-unsupported">
          {cameraError ?? "Barcode scanning isn't supported in this browser."}
        </p>
      )}

      <form className="barcode-manual-form" onSubmit={handleManualSubmit}>
        <label className="barcode-manual-label" htmlFor="barcode-manual-input">
          {isSupported && !cameraError ? 'Or enter barcode manually:' : 'Enter barcode:'}
        </label>
        <div className="barcode-manual-row">
          <input
            id="barcode-manual-input"
            type="text"
            className="text-input barcode-manual-input"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="e.g. 7622210100283"
          />
          <button type="submit" className="primary-button" disabled={!manualCode.trim()}>
            Look up
          </button>
        </div>
      </form>
    </div>
  )
}
