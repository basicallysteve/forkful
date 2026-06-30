import { getUnitCategory, convertUnit } from '@/utils/unitConversion'
import type { NutritionFields } from './types'

export function parseNutritionLabel(text: string): NutritionFields {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  function extract(patterns: RegExp[]): string {
    for (const line of lines) {
      for (const pat of patterns) {
        const m = line.match(pat)
        if (m) return m[1].trim()
      }
    }
    return ''
  }

  const servingRaw = extract([/serving size[:\s]+(.+)/i])
  const servingMatch = servingRaw.match(/^([\d.]+)\s*([a-zA-Z]+)/)
  const parsedServingSize = servingMatch ? servingMatch[1] : ''
  const parsedServingUnit = servingMatch ? servingMatch[2] : servingRaw

  // Extract parenthetical mass weight e.g. "1 cup (240g)", "2 Donuts (2 oz)"
  const gramMatch = servingRaw.match(/\(([\d.]+)\s*(g|kg|oz|lb|mg)\)/i)
  let parsedDensity = ''
  let parsedServingGramWeight = ''
  if (gramMatch && servingMatch) {
    const rawGrams = convertUnit({ value: Number(gramMatch[1]), fromUnit: gramMatch[2].toLowerCase(), toUnit: 'g' })
    const gramsInParens = rawGrams ?? Number(gramMatch[1])
    const servingQty = Number(parsedServingSize)
    const unitCategory = getUnitCategory(parsedServingUnit)
    if (unitCategory === 'volume' && servingQty > 0) {
      const ml = convertUnit({ value: servingQty, fromUnit: parsedServingUnit, toUnit: 'ml' })
      if (ml && ml > 0) parsedDensity = String(gramsInParens / ml)
    } else if (unitCategory === 'custom' && servingQty > 0) {
      parsedServingGramWeight = String(gramsInParens / servingQty)
    }
  }

  return {
    calories: extract([/calories[:\s]+([\d.]+)/i, /energy[:\s]+([\d.]+)\s*kcal/i]),
    protein: extract([/protein[:\s]+([\d.]+)\s*g/i]),
    carbs: extract([/total carbohydrate[s]?[:\s]+([\d.]+)\s*g/i, /carbohydrate[s]?[:\s]+([\d.]+)\s*g/i, /carbs?[:\s]+([\d.]+)\s*g/i]),
    fat: extract([/total fat[:\s]+([\d.]+)\s*g/i, /(?<!saturated\s)fat[:\s]+([\d.]+)\s*g/i]),
    fiber: extract([/dietary fiber[:\s]+([\d.]+)\s*g/i, /fibre[:\s]+([\d.]+)\s*g/i, /fiber[:\s]+([\d.]+)\s*g/i]),
    saturatedFat: extract([/saturated fat[:\s]+([\d.]+)\s*g/i, /saturates[:\s]+([\d.]+)\s*g/i]),
    sugar: extract([/total sugars?[:\s]+([\d.]+)\s*g/i, /sugars?[:\s]+([\d.]+)\s*g/i]),
    sodium: extract([/sodium[:\s]+([\d.]+)\s*mg/i]),
    servingSize: parsedServingSize,
    servingUnit: parsedServingUnit,
    density: parsedDensity,
    servingGramWeight: parsedServingGramWeight,
  }
}
