// Framework-free quantity parsing/formatting (en-US only), kept free of React so the iOS port can reuse it.

import { getUnitCategory } from '@/utils/unitConversion'

const FRACTION_GLYPHS: Record<string, number> = {
  '⅛': 1 / 8,
  '¼': 1 / 4,
  '⅓': 1 / 3,
  '½': 1 / 2,
  '⅔': 2 / 3,
  '¾': 3 / 4,
}

const GLYPH_CLASS = Object.keys(FRACTION_GLYPHS).join('')
const DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)$/
const SLASH_FRACTION = /^(\d+)\/(\d+)$/
const MIXED_SLASH = /^(\d+)\s+(\d+)\/(\d+)$/
const GLYPH_ONLY = new RegExp(`^([${GLYPH_CLASS}])$`)
const MIXED_GLYPH = new RegExp(`^(\\d+)\\s*([${GLYPH_CLASS}])$`)

// Parses "2", "0.5", ".5", "1/2", "1 1/2", "½", "1½" into a number. Returns null for anything else
// (empty, text, zero denominators, negatives, thousands separators).
export function parseQuantity(input: string): number | null {
  const text = input.trim()
  if (!text) return null

  if (DECIMAL.test(text)) return Number(text)

  let m = GLYPH_ONLY.exec(text)
  if (m) return FRACTION_GLYPHS[m[1]]

  m = MIXED_GLYPH.exec(text)
  if (m) return Number(m[1]) + FRACTION_GLYPHS[m[2]]

  m = SLASH_FRACTION.exec(text)
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2])

  m = MIXED_SLASH.exec(text)
  if (m) return Number(m[3]) === 0 ? null : Number(m[1]) + Number(m[2]) / Number(m[3])

  return null
}

const FRACTION_TOLERANCE = 0.01

function decimalString(value: number): string {
  return String(Number(value.toFixed(2)))
}

// Count units (slice, piece, ...) render with fraction glyphs where one matches closely; mass and
// volume units (g, ml, ...) always render as decimals.
export function formatQuantity(value: number, unit: string): string {
  if (getUnitCategory(unit) !== 'custom') return decimalString(value)

  const whole = Math.floor(value)
  const frac = value - whole
  if (frac < FRACTION_TOLERANCE) return String(whole)
  for (const [glyph, amount] of Object.entries(FRACTION_GLYPHS)) {
    if (Math.abs(frac - amount) < FRACTION_TOLERANCE) {
      return whole > 0 ? `${whole}${glyph}` : glyph
    }
  }
  return decimalString(value)
}

const COUNT_STEP = 0.25 // every multiple is a representable fraction glyph (¼ ½ ¾)
const MEASURE_STEP = 1
const EPSILON = 1e-9

// Next value when the user presses ArrowUp (direction 1) or ArrowDown (-1). Snaps to the unit's step
// grid (so ⅓ steps to ½, not 0.58) and never returns 0 or below: returns null when there is no valid
// result, meaning the caller should leave the field as it is. null/empty starts from 0.
export function stepQuantity(value: number | null, direction: 1 | -1, unit: string): number | null {
  const step = getUnitCategory(unit) === 'custom' ? COUNT_STEP : MEASURE_STEP
  const current = value ?? 0
  const units = current / step
  const snapped = direction === 1 ? Math.floor(units + EPSILON) + 1 : Math.ceil(units - EPSILON) - 1
  const next = Number((snapped * step).toFixed(6))
  return next > 0 ? next : null
}
