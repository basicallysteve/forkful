import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import Log from './Index'
import { UnauthorizedError } from '@/lib/api/errors'
import { resetFoodLogStore } from '@/stores/foodLog'
import type { FoodLogEntry } from '@/types/FoodLogEntry'

const { apiFetchDailyLog } = vi.hoisted(() => ({ apiFetchDailyLog: vi.fn() }))
vi.mock('@/lib/api/foodLog', () => ({ apiFetchDailyLog, apiCreateFoodLogEntry: vi.fn() }))
vi.mock('@/lib/api/foods', () => ({ apiFetchFoods: vi.fn().mockResolvedValue([]) }))
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false }))

const SLOTS = ['Breakfast', 'Brunch']

function entry(id: number, name: string, mealSlot: string | null): FoodLogEntry {
  return {
    id, sourceType: 'food', foodId: id, food: { id, name } as FoodLogEntry['food'],
    amount: 2, unit: 'g', calories: 120, protein: 5, carbs: 10, fat: 3, fiber: 1,
    logDate: '2026-11-16', dateAdded: new Date(2026, 10, 16, 8, id), mealSlot,
  }
}

function dailyLog(entries: FoodLogEntry[]) {
  return { logDate: '2026-11-16', entries, total: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } }
}

describe('Log view load failures', () => {
  beforeEach(() => {
    resetFoodLogStore()
    apiFetchDailyLog.mockReset()
  })

  it('shows a sign-in prompt, not "Could not load", on a 401', async () => {
    apiFetchDailyLog.mockRejectedValue(new UnauthorizedError())
    render(<Log mealSlots={SLOTS} />)
    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link.getAttribute('href')).toBe('/login')
    expect(screen.queryByText(/Could not load today/i)).toBeNull()
  })

  it('still shows the generic error for other failures', async () => {
    apiFetchDailyLog.mockRejectedValue(new Error('500'))
    render(<Log mealSlots={SLOTS} />)
    expect(await screen.findByText(/Could not load today/i)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull()
  })
})

describe('Log view meal slot grouping', () => {
  beforeEach(() => {
    resetFoodLogStore()
    apiFetchDailyLog.mockReset()
  })

  function sectionTitles() {
    return Array.from(document.querySelectorAll('.daily-log-meal-title')).map((el) => el.textContent)
  }

  it('shows exactly the user\'s slots, in order, not the hard-coded three', async () => {
    apiFetchDailyLog.mockResolvedValue(dailyLog([]))
    render(<Log mealSlots={SLOTS} />)
    await screen.findByText(/Nothing logged yet/i)
    expect(sectionTitles()).toEqual(['Breakfast', 'Brunch'])
  })

  it('files each entry under its slot, with Other and Unsorted groups when needed', async () => {
    apiFetchDailyLog.mockResolvedValue(dailyLog([
      entry(1, 'Test Pancakes', 'Brunch'),
      entry(2, 'Test Toast', 'Breakfast'),
      entry(3, 'Test Soup', 'Lunch'),
      entry(4, 'Test Apple', null),
    ]))
    render(<Log mealSlots={SLOTS} />)
    await screen.findByText('Test Pancakes')
    expect(sectionTitles()).toEqual(['Breakfast', 'Brunch', 'Other', 'Unsorted'])
    const section = (title: string) =>
      screen.getByText(title, { selector: '.daily-log-meal-title' }).closest('section') as HTMLElement
    expect(within(section('Breakfast')).getByText('Test Toast')).toBeTruthy()
    expect(within(section('Brunch')).getByText('Test Pancakes')).toBeTruthy()
    expect(within(section('Other')).getByText('Test Soup')).toBeTruthy()
    expect(within(section('Unsorted')).getByText('Test Apple')).toBeTruthy()
  })

  it('renders rows, not the 7-column table', async () => {
    apiFetchDailyLog.mockResolvedValue(dailyLog([entry(1, 'Test Toast', 'Breakfast')]))
    render(<Log mealSlots={SLOTS} />)
    await screen.findByText('Test Toast')
    expect(document.querySelector('table')).toBeNull()
    const row = screen.getByText('Test Toast').closest('li') as HTMLElement
    expect(row.textContent).toContain('120')
    expect(row.textContent).toMatch(/Protein 5g/)
    expect(row.textContent).toMatch(/Carbs 10g/)
    expect(row.textContent).toMatch(/Fat 3g/)
    expect(row.textContent).toMatch(/Fiber 1g/)
  })
})
