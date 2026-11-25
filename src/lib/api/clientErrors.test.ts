import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, type ApiErrorKind } from './errors'
import * as pantry from './pantry'
import * as shopping from './shoppingList'
import * as reviews from './reviews'
import * as products from './products'
import * as users from './users'
import * as off from './openFoodFacts'

const failing = (status: number, body?: unknown) =>
  ({
    ok: false,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body')
      return body
    },
  }) as unknown as Response

type Call = [name: string, run: () => Promise<unknown>]

// Every wrapper in the migrated modules that throws on a failed response.
const calls: Call[] = [
  ['apiFetchPantryItems', () => pantry.apiFetchPantryItems()],
  ['apiFetchPantryItem', () => pantry.apiFetchPantryItem(1)],
  ['apiCreatePantryItem', () => pantry.apiCreatePantryItem({ originalSizeAmount: 1, currentSizeAmount: 1 })],
  ['apiUpdatePantryItem', () => pantry.apiUpdatePantryItem(1, {})],
  ['apiDeletePantryItem', () => pantry.apiDeletePantryItem(1)],
  ['apiDeletePantryItems', () => pantry.apiDeletePantryItems([1])],
  ['apiFetchIngredientPantryMatches', () => pantry.apiFetchIngredientPantryMatches('abc')],
  ['apiPrepareMeal', () => pantry.apiPrepareMeal({ recipeShortId: 'abc', servings: 1, skipDeduction: true, deductions: [] })],
  ['apiFetchShoppingListItems', () => shopping.apiFetchShoppingListItems()],
  ['apiFillPantryGapFromRecipe', () => shopping.apiFillPantryGapFromRecipe('abc')],
  ['apiCreateShoppingListItem', () => shopping.apiCreateShoppingListItem({ sourceType: 'freeform', name: 'x', amount: 1 })],
  ['apiScanToBuyShoppingListItem', () => shopping.apiScanToBuyShoppingListItem(1)],
  ['apiDeleteShoppingListItem', () => shopping.apiDeleteShoppingListItem(1)],
  ['apiUpdateShoppingListItemStatus', () => shopping.apiUpdateShoppingListItemStatus(1, 'bought')],
  ['apiUpdateShoppingListItemDetails', () => shopping.apiUpdateShoppingListItemDetails(1, { linePrice: 1 })],
  ['apiSplitShoppingListItem', () => shopping.apiSplitShoppingListItem(1, { portions: [] })],
  ['apiCompleteShoppingTrip', () => shopping.apiCompleteShoppingTrip(true)],
  ['apiFetchReviews', () => reviews.apiFetchReviews('abc')],
  ['apiCreateReview', () => reviews.apiCreateReview('abc', { rating: 5 })],
  ['apiUpdateReview', () => reviews.apiUpdateReview(1, { rating: 4 })],
  ['apiDeleteReview', () => reviews.apiDeleteReview(1)],
  ['apiToggleReviewLike', () => reviews.apiToggleReviewLike(1)],
  ['apiReportReview', () => reviews.apiReportReview(1, { reason: 'spam' } as Parameters<typeof reviews.apiReportReview>[1])],
  ['apiFetchAdminReports', () => reviews.apiFetchAdminReports()],
  ['apiDismissReport', () => reviews.apiDismissReport(1)],
  ['apiAdminDeleteReview', () => reviews.apiAdminDeleteReview(1)],
  ['apiFetchProducts', () => products.apiFetchProducts()],
  ['apiFetchProduct', () => products.apiFetchProduct('slug')],
  ['apiCreateProduct', () => products.apiCreateProduct({} as Parameters<typeof products.apiCreateProduct>[0])],
  ['apiUpdateProduct', () => products.apiUpdateProduct('slug', {} as Parameters<typeof products.apiUpdateProduct>[1])],
  ['apiFetchProductByBarcode', () => products.apiFetchProductByBarcode('123')],
  ['apiLinkProductToFood', () => products.apiLinkProductToFood('slug', 1)],
  ['apiDeleteProduct', () => products.apiDeleteProduct('slug')],
  ['apiSearchOpenFoodFacts', () => off.apiSearchOpenFoodFacts('milk')],
  ['apiGetProductByBarcode', () => off.apiGetProductByBarcode('123')],
  ['apiSignUp', () => users.apiSignUp({ username: 'u', email: 'e', password: 'p', cuisinePreferences: [], dietaryRestrictions: [] })],
  ['apiUpdateUsername (patchUser)', () => users.apiUpdateUsername(1, 'u')],
  ['apiSubmitAccountFeedback', () => users.apiSubmitAccountFeedback(1, { action: 'deleted', reasons: [] })],
  ['apiReactivateAccount', () => users.apiReactivateAccount('u', 'p')],
  ['apiUploadAvatar', () => users.apiUploadAvatar(1, new File(['x'], 'a.png'))],
  ['apiDeleteAvatar', () => users.apiDeleteAvatar(1)],
]

// These return null on a 404 instead of throwing.
const nullOn404 = new Set(['apiFetchPantryItem', 'apiFetchProduct', 'apiFetchProductByBarcode', 'apiGetProductByBarcode'])

const statuses: [number, ApiErrorKind][] = [
  [401, 'unauthorized'],
  [403, 'forbidden'],
  [404, 'not_found'],
  [422, 'invalid'],
  [500, 'server'],
]

beforeEach(() => {
  vi.restoreAllMocks()
})

describe.each(calls)('%s', (name, run) => {
  it.each(statuses.filter(([s]) => s !== 404 || !nullOn404.has(name)))(
    'throws an ApiError of the right kind for %i (%s)',
    async (status, kind) => {
      global.fetch = vi.fn().mockResolvedValue(failing(status))
      const err = await run().then(() => null, (e: unknown) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(status)
      expect((err as ApiError).kind).toBe(kind)
    },
  )

  it('keeps the server error message', async () => {
    global.fetch = vi.fn().mockResolvedValue(failing(400, { error: 'Server said no' }))
    const err = await run().then(() => null, (e: unknown) => e)
    expect((err as ApiError).message).toBe('Server said no')
  })

  it('reports a dropped connection as a network ApiError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await run().then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).kind).toBe('network')
  })
})

describe('null on 404', () => {
  it.each([...nullOn404])('%s still resolves null', async (name) => {
    const run = calls.find(([n]) => n === name)![1]
    global.fetch = vi.fn().mockResolvedValue(failing(404))
    await expect(run()).resolves.toBeNull()
  })
})

describe('apiSignUp invite code', () => {
  it('still throws InviteInvalidError for an invalid invite', async () => {
    global.fetch = vi.fn().mockResolvedValue(failing(400, { code: 'invalid_invite', error: 'nope' }))
    await expect(
      users.apiSignUp({ username: 'u', email: 'e', password: 'p', cuisinePreferences: [], dietaryRestrictions: [] }),
    ).rejects.toBeInstanceOf(users.InviteInvalidError)
  })
})

describe('success paths with 204', () => {
  it.each([
    ['apiDeletePantryItem', () => pantry.apiDeletePantryItem(1)],
    ['apiDeleteShoppingListItem', () => shopping.apiDeleteShoppingListItem(1)],
    ['apiDeleteReview', () => reviews.apiDeleteReview(1)],
    ['apiDismissReport', () => reviews.apiDismissReport(1)],
    ['apiAdminDeleteReview', () => reviews.apiAdminDeleteReview(1)],
    ['apiDeleteProduct', () => products.apiDeleteProduct('slug')],
  ] as Call[])('%s resolves on a 204', async (_name, run) => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 204 } as Response)
    await expect(run()).resolves.toBeUndefined()
  })
})
