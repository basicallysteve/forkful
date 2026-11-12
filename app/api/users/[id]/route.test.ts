import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { PATCH } from './route'
import { getSessionUser } from '@/lib/auth'
import {
  updateUserPreferences,
  updateMealSlots,
  updateUserEmail,
  updateUserPassword,
  updateUsername,
  updateEmailPreferences,
  updateShoppingPreferences,
  updateNutritionGoal,
  deactivateAccount,
  deleteAccount,
} from '@/lib/users'

vi.mock('@/lib/auth', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/users', () => ({
  updateUserPreferences: vi.fn(),
  updateMealSlots: vi.fn(),
  updateUserEmail: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUsername: vi.fn(),
  updateEmailPreferences: vi.fn(),
  updateShoppingPreferences: vi.fn(),
  updateNutritionGoal: vi.fn(),
  deactivateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}))
vi.mock('@/lib/TaskRunner', () => ({
  taskRunner: { run: vi.fn((fn: () => unknown) => fn()) },
}))

function makeRequest(id: string, body: Record<string, unknown>) {
  return {
    request: new Request(`http://localhost/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ id }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/users/[id] — auth', () => {
  it('returns 401 when not logged in', async () => {
    (getSessionUser as Mock).mockResolvedValue(null)
    const { request, params } = makeRequest('1', { action: 'preferences', cuisinePreferences: [], dietaryRestrictions: [] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Unauthorized')
  })

  it('returns 403 when session user does not match id param', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 1, username: 'alice' })
    const { request, params } = makeRequest('99', { action: 'preferences', cuisinePreferences: [], dietaryRestrictions: [] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Forbidden')
  })

  it('returns 403 when id param is not a number', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 1, username: 'alice' })
    const { request, params } = makeRequest('abc', { action: 'preferences', cuisinePreferences: [], dietaryRestrictions: [] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/users/[id] — preferences', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('saves preferences and returns ok', async () => {
    (updateUserPreferences as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'preferences',
      cuisinePreferences: ['Italian', 'Mexican'],
      dietaryRestrictions: ['Vegan'],
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(updateUserPreferences).toHaveBeenCalledWith(42, {
      cuisinePreferences: ['Italian', 'Mexican'],
      dietaryRestrictions: ['Vegan'],
    })
  })

  it('returns 400 when cuisinePreferences is missing', async () => {
    const { request, params } = makeRequest('42', { action: 'preferences', dietaryRestrictions: [] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateUserPreferences).not.toHaveBeenCalled()
  })

  it('returns 400 when dietaryRestrictions is not an array', async () => {
    const { request, params } = makeRequest('42', { action: 'preferences', cuisinePreferences: [], dietaryRestrictions: 'Vegan' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateUserPreferences).not.toHaveBeenCalled()
  })

  it('returns 400 when cuisinePreferences contains non-string values', async () => {
    const { request, params } = makeRequest('42', { action: 'preferences', cuisinePreferences: ['Italian', 42], dietaryRestrictions: [] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateUserPreferences).not.toHaveBeenCalled()
  })

  it('returns 400 when dietaryRestrictions contains non-string values', async () => {
    const { request, params } = makeRequest('42', { action: 'preferences', cuisinePreferences: [], dietaryRestrictions: [{ evil: true }] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateUserPreferences).not.toHaveBeenCalled()
  })

  it('accepts empty arrays', async () => {
    (updateUserPreferences as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', { action: 'preferences', cuisinePreferences: [], dietaryRestrictions: [] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(updateUserPreferences).toHaveBeenCalledWith(42, { cuisinePreferences: [], dietaryRestrictions: [] })
  })
})

describe('PATCH /api/users/[id] — mealSlots', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('saves meal slots and echoes the normalized list', async () => {
    (updateMealSlots as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'mealSlots',
      mealSlots: ['Breakfast', 'Lunch', 'Dinner'],
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, mealSlots: ['Breakfast', 'Lunch', 'Dinner'] })
    expect(updateMealSlots).toHaveBeenCalledWith(42, ['Breakfast', 'Lunch', 'Dinner'])
  })

  it('trims, drops blanks, and de-duplicates case-insensitively while preserving order', async () => {
    (updateMealSlots as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'mealSlots',
      mealSlots: ['  Breakfast ', '', 'lunch', 'Lunch', 'Dinner'],
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(updateMealSlots).toHaveBeenCalledWith(42, ['Breakfast', 'lunch', 'Dinner'])
  })

  it('accepts an empty list (a user may clear all slots)', async () => {
    (updateMealSlots as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', { action: 'mealSlots', mealSlots: [] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(updateMealSlots).toHaveBeenCalledWith(42, [])
  })

  it('returns 400 when mealSlots is not an array', async () => {
    const { request, params } = makeRequest('42', { action: 'mealSlots', mealSlots: 'Breakfast' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateMealSlots).not.toHaveBeenCalled()
  })

  it('returns 400 when mealSlots contains non-string values', async () => {
    const { request, params } = makeRequest('42', { action: 'mealSlots', mealSlots: ['Breakfast', 42] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateMealSlots).not.toHaveBeenCalled()
  })

  it('returns 400 when there are more than 20 slots', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `Slot ${i}`)
    const { request, params } = makeRequest('42', { action: 'mealSlots', mealSlots: many })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateMealSlots).not.toHaveBeenCalled()
  })

  it('returns 400 when a slot name exceeds 50 characters', async () => {
    const { request, params } = makeRequest('42', { action: 'mealSlots', mealSlots: ['a'.repeat(51)] })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateMealSlots).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/users/[id] — email', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('updates email and returns ok', async () => {
    (updateUserEmail as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', { action: 'email', email: 'new@example.com' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(updateUserEmail).toHaveBeenCalledWith(42, 'new@example.com')
  })

  it('returns 400 for an invalid email', async () => {
    const { request, params } = makeRequest('42', { action: 'email', email: 'not-an-email' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateUserEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when email is missing', async () => {
    const { request, params } = makeRequest('42', { action: 'email' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateUserEmail).not.toHaveBeenCalled()
  })

  it('returns 400 when updateUserEmail throws (e.g. email taken)', async () => {
    (updateUserEmail as Mock).mockRejectedValue(new Error('Email already in use'))
    const { request, params } = makeRequest('42', { action: 'email', email: 'taken@example.com' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Email already in use')
  })
})

describe('PATCH /api/users/[id] — password', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('updates password and returns ok', async () => {
    (updateUserPassword as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'password',
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(updateUserPassword).toHaveBeenCalledWith({ userId: 42, currentPassword: 'OldPass1!', newPassword: 'NewPass1!' })
  })

  it('returns 400 when newPassword is too short', async () => {
    const { request, params } = makeRequest('42', {
      action: 'password',
      currentPassword: 'OldPass1!',
      newPassword: 'short',
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateUserPassword).not.toHaveBeenCalled()
  })

  it('returns 400 with specific message when currentPassword is missing', async () => {
    const { request, params } = makeRequest('42', { action: 'password', newPassword: 'NewPass1!' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Current password is required')
    expect(updateUserPassword).not.toHaveBeenCalled()
  })

  it('returns 400 when updateUserPassword throws (e.g. wrong current password)', async () => {
    (updateUserPassword as Mock).mockRejectedValue(new Error('Current password is incorrect'))
    const { request, params } = makeRequest('42', {
      action: 'password',
      currentPassword: 'wrong',
      newPassword: 'NewPass1!',
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Current password is incorrect')
  })
})

describe('PATCH /api/users/[id] — username', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('updates username and returns ok', async () => {
    (updateUsername as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', { action: 'username', username: 'new_alice' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(updateUsername).toHaveBeenCalledWith(42, 'new_alice')
  })

  it('returns 400 when username is too short', async () => {
    const { request, params } = makeRequest('42', { action: 'username', username: 'ab' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateUsername).not.toHaveBeenCalled()
  })

  it('returns 400 when username contains invalid characters', async () => {
    const { request, params } = makeRequest('42', { action: 'username', username: 'alice smith' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateUsername).not.toHaveBeenCalled()
  })

  it('returns 400 when username is taken', async () => {
    (updateUsername as Mock).mockRejectedValue(new Error('Username already in use'))
    const { request, params } = makeRequest('42', { action: 'username', username: 'taken_name' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Username already in use')
  })
})

describe('PATCH /api/users/[id] — emailPreferences', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('updates email preferences and returns ok', async () => {
    (updateEmailPreferences as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'emailPreferences',
      marketingEmailOptIn: true,
      recipeSuggestionFrequency: 'weekly',
      pantryExpirationFrequency: 'daily',
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(updateEmailPreferences).toHaveBeenCalledWith(42, {
      marketingEmailOptIn: true,
      recipeSuggestionFrequency: 'weekly',
      pantryExpirationFrequency: 'daily',
    })
  })

  it('updates shopping preferences and returns ok', async () => {
    (updateShoppingPreferences as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'shoppingPreferences',
      enableShoppingListPricingCollection: false,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(updateShoppingPreferences).toHaveBeenCalledWith(42, { enableShoppingListPricingCollection: false })
  })

  it('returns 400 when enableShoppingListPricingCollection is not a boolean', async () => {
    const { request, params } = makeRequest('42', {
      action: 'shoppingPreferences',
      enableShoppingListPricingCollection: 'nope',
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateShoppingPreferences).not.toHaveBeenCalled()
  })

  it('returns 400 when marketingEmailOptIn is not a boolean', async () => {
    const { request, params } = makeRequest('42', {
      action: 'emailPreferences',
      marketingEmailOptIn: 'yes',
      recipeSuggestionFrequency: 'weekly',
      pantryExpirationFrequency: 'daily',
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateEmailPreferences).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid recipeSuggestionFrequency', async () => {
    const { request, params } = makeRequest('42', {
      action: 'emailPreferences',
      marketingEmailOptIn: false,
      recipeSuggestionFrequency: 'hourly',
      pantryExpirationFrequency: 'daily',
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateEmailPreferences).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid pantryExpirationFrequency', async () => {
    const { request, params } = makeRequest('42', {
      action: 'emailPreferences',
      marketingEmailOptIn: false,
      recipeSuggestionFrequency: 'weekly',
      pantryExpirationFrequency: 'monthly',
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateEmailPreferences).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/users/[id] — nutritionGoal', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('saves a full nutrition goal and returns ok', async () => {
    (updateNutritionGoal as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'nutritionGoal',
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 60,
      fiber: 30,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(updateNutritionGoal).toHaveBeenCalledWith(42, {
      calories: 2000, protein: 150, carbs: 200, fat: 60, fiber: 30,
    })
  })

  it('accepts null (unset) for each field independently', async () => {
    (updateNutritionGoal as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'nutritionGoal',
      calories: 1800,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(updateNutritionGoal).toHaveBeenCalledWith(42, {
      calories: 1800, protein: null, carbs: null, fat: null, fiber: null,
    })
  })

  it('accepts an all-null goal (fully cleared)', async () => {
    (updateNutritionGoal as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'nutritionGoal',
      calories: null, protein: null, carbs: null, fat: null, fiber: null,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(updateNutritionGoal).toHaveBeenCalledWith(42, {
      calories: null, protein: null, carbs: null, fat: null, fiber: null,
    })
  })

  it('returns 400 when a field is negative', async () => {
    const { request, params } = makeRequest('42', {
      action: 'nutritionGoal',
      calories: -100, protein: null, carbs: null, fat: null, fiber: null,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateNutritionGoal).not.toHaveBeenCalled()
  })

  it('returns 400 when a field is not a number', async () => {
    const { request, params } = makeRequest('42', {
      action: 'nutritionGoal',
      calories: '2000', protein: null, carbs: null, fat: null, fiber: null,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateNutritionGoal).not.toHaveBeenCalled()
  })

  it('returns 400 when calories is not a whole number (integer column)', async () => {
    const { request, params } = makeRequest('42', {
      action: 'nutritionGoal',
      calories: 2000.5, protein: null, carbs: null, fat: null, fiber: null,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateNutritionGoal).not.toHaveBeenCalled()
  })

  it('returns 400 when a macro has more than two decimal places', async () => {
    const { request, params } = makeRequest('42', {
      action: 'nutritionGoal',
      calories: null, protein: 1.234, carbs: null, fat: null, fiber: null,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateNutritionGoal).not.toHaveBeenCalled()
  })

  it('returns 400 when a value exceeds the storable maximum', async () => {
    const { request, params } = makeRequest('42', {
      action: 'nutritionGoal',
      calories: null, protein: 100_000_000, carbs: null, fat: null, fiber: null,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect(updateNutritionGoal).not.toHaveBeenCalled()
  })

  it('accepts a macro with exactly two decimal places', async () => {
    (updateNutritionGoal as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', {
      action: 'nutritionGoal',
      calories: 2000, protein: 165.25, carbs: null, fat: null, fiber: null,
    })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(updateNutritionGoal).toHaveBeenCalledWith(42, {
      calories: 2000, protein: 165.25, carbs: null, fat: null, fiber: null,
    })
  })
})

describe('PATCH /api/users/[id] — deactivate', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('deactivates the account and returns ok', async () => {
    (deactivateAccount as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', { action: 'deactivate' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(deactivateAccount).toHaveBeenCalledWith(42)
  })
})

describe('PATCH /api/users/[id] — delete', () => {
  beforeEach(() => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
  })

  it('deletes the account and returns ok', async () => {
    (deleteAccount as Mock).mockResolvedValue(undefined)
    const { request, params } = makeRequest('42', { action: 'delete' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(deleteAccount).toHaveBeenCalledWith(42)
  })
})

describe('PATCH /api/users/[id] — unknown action', () => {
  it('returns 400 for an unrecognised action', async () => {
    (getSessionUser as Mock).mockResolvedValue({ userId: 42, username: 'alice' })
    const { request, params } = makeRequest('42', { action: 'delete-account' })

    const res = await PATCH(request, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Unknown action')
  })
})
