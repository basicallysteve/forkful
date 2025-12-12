import { describe, it, expect } from 'vitest'
import {
  calculateIngredientAvailability,
  calculateRecipeReadiness,
  calculateRecipesReadiness,
} from './recipeReadiness'
import type { Recipe } from '@/types/Recipe'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

// Mock food items
const mockChicken: Food = {
  id: 1,
  name: 'Chicken',
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: 0,
  servingSize: 100,
  servingUnit: 'g',
}

const mockRice: Food = {
  id: 2,
  name: 'Rice',
  calories: 130,
  protein: 2.7,
  carbs: 28,
  fat: 0.3,
  fiber: 0.4,
  servingSize: 100,
  servingUnit: 'g',
}

const mockTomato: Food = {
  id: 3,
  name: 'Tomato',
  calories: 18,
  protein: 0.9,
  carbs: 3.9,
  fat: 0.2,
  fiber: 1.2,
  servingSize: 100,
  servingUnit: 'g',
}

describe('recipeReadiness', () => {
  describe('calculateIngredientAvailability', () => {
    it('should return zero availability when no pantry items match', () => {
      const ingredient = {
        food: mockChicken,
        quantity: 200,
        calories: 330,
        servingUnit: 'g',
      }
      const pantryItems: PantryItem[] = []

      const result = calculateIngredientAvailability(ingredient, pantryItems)

      expect(result.available).toBe(0)
      expect(result.needed).toBe(200)
      expect(result.isSufficient).toBe(false)
      expect(result.shortage).toBe(200)
    })

    it('should calculate availability when pantry has sufficient quantity', () => {
      const ingredient = {
        food: mockChicken,
        quantity: 200,
        calories: 330,
        servingUnit: 'g',
      }
      const pantryItems: PantryItem[] = [
        {
          id: 1,
          food: mockChicken,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 500, unit: 'g' },
          currentSize: { size: 500, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
      ]

      const result = calculateIngredientAvailability(ingredient, pantryItems)

      expect(result.available).toBe(500)
      expect(result.needed).toBe(200)
      expect(result.isSufficient).toBe(true)
      expect(result.shortage).toBe(0)
    })

    it('should calculate shortage when pantry has insufficient quantity', () => {
      const ingredient = {
        food: mockChicken,
        quantity: 200,
        calories: 330,
        servingUnit: 'g',
      }
      const pantryItems: PantryItem[] = [
        {
          id: 1,
          food: mockChicken,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 100, unit: 'g' },
          currentSize: { size: 100, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
      ]

      const result = calculateIngredientAvailability(ingredient, pantryItems)

      expect(result.available).toBe(100)
      expect(result.needed).toBe(200)
      expect(result.isSufficient).toBe(false)
      expect(result.shortage).toBe(100)
    })

    it('should ignore expired pantry items', () => {
      const ingredient = {
        food: mockChicken,
        quantity: 200,
        calories: 330,
        servingUnit: 'g',
      }
      const pantryItems: PantryItem[] = [
        {
          id: 1,
          food: mockChicken,
          expirationDate: new Date('2024-01-01'),
          originalSize: { size: 500, unit: 'g' },
          currentSize: { size: 500, unit: 'g' },
          addedDate: new Date('2024-01-01'),
          status: 'expired',
          frozenDate: null,
        },
      ]

      const result = calculateIngredientAvailability(ingredient, pantryItems)

      expect(result.available).toBe(0)
      expect(result.isSufficient).toBe(false)
    })

    it('should sum quantities from multiple pantry items of same food', () => {
      const ingredient = {
        food: mockChicken,
        quantity: 300,
        calories: 495,
        servingUnit: 'g',
      }
      const pantryItems: PantryItem[] = [
        {
          id: 1,
          food: mockChicken,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 200, unit: 'g' },
          currentSize: { size: 200, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
        {
          id: 2,
          food: mockChicken,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 150, unit: 'g' },
          currentSize: { size: 150, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
      ]

      const result = calculateIngredientAvailability(ingredient, pantryItems)

      expect(result.available).toBe(350)
      expect(result.needed).toBe(300)
      expect(result.isSufficient).toBe(true)
    })

    it('should convert units when pantry and ingredient use compatible units', () => {
      const ingredient = {
        food: mockChicken,
        quantity: 1,
        calories: 1650,
        servingUnit: 'kg',
      }
      const pantryItems: PantryItem[] = [
        {
          id: 1,
          food: mockChicken,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 500, unit: 'g' },
          currentSize: { size: 500, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
      ]

      const result = calculateIngredientAvailability(ingredient, pantryItems)

      expect(result.available).toBe(0.5) // 500g = 0.5kg
      expect(result.needed).toBe(1)
      expect(result.isSufficient).toBe(false)
      expect(result.unit).toBe('kg')
    })
  })

  describe('calculateRecipeReadiness', () => {
    it('should calculate readiness for a recipe with all ingredients available', () => {
      const recipe: Recipe = {
        id: 1,
        name: 'Chicken and Rice',
        description: 'A simple dish',
        ingredients: [
          {
            food: mockChicken,
            quantity: 200,
            calories: 330,
            servingUnit: 'g',
          },
          {
            food: mockRice,
            quantity: 150,
            calories: 195,
            servingUnit: 'g',
          },
        ],
      }

      const pantryItems: PantryItem[] = [
        {
          id: 1,
          food: mockChicken,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 500, unit: 'g' },
          currentSize: { size: 500, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
        {
          id: 2,
          food: mockRice,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 1000, unit: 'g' },
          currentSize: { size: 1000, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
      ]

      const result = calculateRecipeReadiness(recipe, pantryItems)

      expect(result.totalIngredients).toBe(2)
      expect(result.availableIngredients).toBe(2)
      expect(result.partialIngredients).toBe(0)
      expect(result.missingIngredients).toBe(0)
      expect(result.readinessScore).toBe(100)
    })

    it('should calculate readiness for a recipe with no ingredients available', () => {
      const recipe: Recipe = {
        id: 1,
        name: 'Chicken and Rice',
        description: 'A simple dish',
        ingredients: [
          {
            food: mockChicken,
            quantity: 200,
            calories: 330,
            servingUnit: 'g',
          },
          {
            food: mockRice,
            quantity: 150,
            calories: 195,
            servingUnit: 'g',
          },
        ],
      }

      const pantryItems: PantryItem[] = []

      const result = calculateRecipeReadiness(recipe, pantryItems)

      expect(result.totalIngredients).toBe(2)
      expect(result.availableIngredients).toBe(0)
      expect(result.partialIngredients).toBe(0)
      expect(result.missingIngredients).toBe(2)
      expect(result.readinessScore).toBe(0)
    })

    it('should calculate readiness for a recipe with partial availability', () => {
      const recipe: Recipe = {
        id: 1,
        name: 'Chicken and Rice',
        description: 'A simple dish',
        ingredients: [
          {
            food: mockChicken,
            quantity: 200,
            calories: 330,
            servingUnit: 'g',
          },
          {
            food: mockRice,
            quantity: 150,
            calories: 195,
            servingUnit: 'g',
          },
          {
            food: mockTomato,
            quantity: 100,
            calories: 18,
            servingUnit: 'g',
          },
        ],
      }

      const pantryItems: PantryItem[] = [
        {
          id: 1,
          food: mockChicken,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 100, unit: 'g' },
          currentSize: { size: 100, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
        {
          id: 2,
          food: mockRice,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 1000, unit: 'g' },
          currentSize: { size: 1000, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
      ]

      const result = calculateRecipeReadiness(recipe, pantryItems)

      expect(result.totalIngredients).toBe(3)
      expect(result.availableIngredients).toBe(1) // Only rice has enough
      expect(result.partialIngredients).toBe(1) // Chicken has some but not enough
      expect(result.missingIngredients).toBe(1) // No tomato
      expect(result.readinessScore).toBe(50) // 1 full + 1 half = 1.5/3 = 50%
    })
  })

  describe('calculateRecipesReadiness', () => {
    it('should calculate readiness for multiple recipes', () => {
      const recipes: Recipe[] = [
        {
          id: 1,
          name: 'Chicken and Rice',
          description: 'A simple dish',
          ingredients: [
            {
              food: mockChicken,
              quantity: 200,
              calories: 330,
              servingUnit: 'g',
            },
          ],
        },
        {
          id: 2,
          name: 'Rice Bowl',
          description: 'Just rice',
          ingredients: [
            {
              food: mockRice,
              quantity: 150,
              calories: 195,
              servingUnit: 'g',
            },
          ],
        },
      ]

      const pantryItems: PantryItem[] = [
        {
          id: 1,
          food: mockChicken,
          expirationDate: new Date('2025-12-31'),
          originalSize: { size: 500, unit: 'g' },
          currentSize: { size: 500, unit: 'g' },
          addedDate: new Date('2025-01-01'),
          status: 'good',
          frozenDate: null,
        },
      ]

      const result = calculateRecipesReadiness(recipes, pantryItems)

      expect(result.size).toBe(2)
      expect(result.get(1)?.readinessScore).toBe(100)
      expect(result.get(2)?.readinessScore).toBe(0)
    })
  })
})
