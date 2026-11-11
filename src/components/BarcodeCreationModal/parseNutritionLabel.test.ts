import { describe, it, expect } from 'vitest'
import { parseNutritionLabel } from './parseNutritionLabel'

const BASE_LABEL = `
Calories 150
Protein 5g
Total Fat 3g
Saturated Fat 1g
Total Carbohydrates 27g
Dietary Fiber 3g
Sugars 2g
Sodium 120mg
`

describe('parseNutritionLabel', () => {
  describe('basic macro extraction', () => {
    it('parses calories, macros, and micronutrients', () => {
      const result = parseNutritionLabel(BASE_LABEL)
      expect(result.calories).toBe('150')
      expect(result.protein).toBe('5')
      expect(result.fat).toBe('3')
      expect(result.saturatedFat).toBe('1')
      expect(result.carbs).toBe('27')
      expect(result.fiber).toBe('3')
      expect(result.sugar).toBe('2')
      expect(result.sodium).toBe('120')
    })

    it('does not match saturated fat as total fat', () => {
      const label = 'Total Fat 8g\nSaturated Fat 3g'
      const result = parseNutritionLabel(label)
      expect(result.fat).toBe('8')
      expect(result.saturatedFat).toBe('3')
    })
  })

  describe('serving size without parenthetical', () => {
    it('parses a plain gram serving', () => {
      const result = parseNutritionLabel('Serving Size 40g\n' + BASE_LABEL)
      expect(result.servingSize).toBe('40')
      expect(result.servingUnit).toBe('g')
      expect(result.density).toBe('')
      expect(result.servingGramWeight).toBe('')
    })
  })

  describe('serving size with parenthetical gram weight', () => {
    it('derives density from a volume serving — 1 cup (240g)', () => {
      const result = parseNutritionLabel('Serving Size 1 cup (240g)\n' + BASE_LABEL)
      expect(result.servingSize).toBe('1')
      expect(result.servingUnit).toBe('cup')
      // 1 cup ≈ 236.588ml; density ≈ 240 / 236.588 ≈ 1.0144
      expect(Number(result.density)).toBeCloseTo(240 / 236.588, 3)
      expect(result.servingGramWeight).toBe('')
    })

    it('derives density from a volume serving — 2 Tbs (30g)', () => {
      const result = parseNutritionLabel('Serving Size 2 Tbs (30g)\n' + BASE_LABEL)
      expect(result.servingUnit).toBe('Tbs')
      // 2 Tbs ≈ 29.574ml; density ≈ 30 / 29.574
      expect(Number(result.density)).toBeCloseTo(30 / 29.574, 3)
      expect(result.servingGramWeight).toBe('')
    })

    it('sets gramsPerUnit from a custom unit serving — 2 Donuts (63g)', () => {
      const result = parseNutritionLabel('Serving Size 2 Donuts (63g)\n' + BASE_LABEL)
      expect(result.servingSize).toBe('2')
      expect(result.servingUnit).toBe('Donuts')
      expect(result.servingGramWeight).toBe('31.5')
      expect(result.density).toBe('')
    })

    it('sets gramsPerUnit for a single custom unit — 1 Packet (28g)', () => {
      const result = parseNutritionLabel('Serving Size 1 Packet (28g)\n' + BASE_LABEL)
      expect(result.servingGramWeight).toBe('28')
    })
  })

  describe('parenthetical with non-gram mass units', () => {
    it('converts oz to grams for density — 1 cup (8 oz)', () => {
      const result = parseNutritionLabel('Serving Size 1 cup (8 oz)\n' + BASE_LABEL)
      // 8 oz ≈ 226.796g; 1 cup ≈ 236.588ml
      expect(Number(result.density)).toBeCloseTo(226.796 / 236.588, 3)
    })

    it('converts oz to grams for custom unit — 1 Slice (2 oz)', () => {
      const result = parseNutritionLabel('Serving Size 1 Slice (2 oz)\n' + BASE_LABEL)
      // 2 oz ≈ 56.699g
      expect(Number(result.servingGramWeight)).toBeCloseTo(56.699, 1)
    })

    it('converts kg to grams for custom unit — 1 Bar (0.05 kg)', () => {
      const result = parseNutritionLabel('Serving Size 1 Bar (0.05 kg)\n' + BASE_LABEL)
      // 0.05 kg = 50g
      expect(Number(result.servingGramWeight)).toBeCloseTo(50, 3)
    })
  })

  describe('parenthetical edge cases', () => {
    it('ignores a volume unit in parens — 1 serving (8 fl-oz)', () => {
      const result = parseNutritionLabel('Serving Size 1 serving (8 fl-oz)\n' + BASE_LABEL)
      expect(result.density).toBe('')
      expect(result.servingGramWeight).toBe('')
    })

    it('produces no density or gramWeight when there is no parenthetical', () => {
      const result = parseNutritionLabel('Serving Size 1 cup\n' + BASE_LABEL)
      expect(result.density).toBe('')
      expect(result.servingGramWeight).toBe('')
    })
  })
})
