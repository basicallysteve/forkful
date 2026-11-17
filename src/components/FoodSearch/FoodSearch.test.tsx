import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import FoodSearch from './FoodSearch'
import type { Food } from '@/types/Food'

const mockUseSession = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

const mockFetchFoods = vi.fn()
const mockSearchOff = vi.fn()
vi.mock('@/lib/api/foods', () => ({
  apiFetchFoods: (...a: unknown[]) => mockFetchFoods(...a),
  apiCreateFood: vi.fn(),
}))
vi.mock('@/lib/api/openFoodFacts', () => ({
  apiSearchOpenFoodFacts: (...a: unknown[]) => mockSearchOff(...a),
  mapOFFProductToFood: vi.fn(),
}))

function food(id: number, name: string): Food {
  return {
    id, name, calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 0,
    servingSize: 100, servingUnit: 'g', measurements: [{ unit: 'g' }],
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

function setup(localFoods: Food[] = [food(1, 'Apple')]) {
  const onChange = vi.fn()
  render(<FoodSearch value="" localFoods={localFoods} onChange={onChange} inputAriaLabel="Food" />)
  return { onChange, input: screen.getByRole('combobox') }
}

function type(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } })
}

async function flushDebounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(400) })
}

const addRow = (q: string) => screen.queryAllByRole('option', { name: new RegExp(`Add "${q}" as a new food`) })

function expectAddRowLast(q: string) {
  const options = screen.getAllByRole('option')
  expect(options[options.length - 1]).toHaveTextContent(`Add "${q}" as a new food`)
}

describe('FoodSearch add-new row', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseSession.mockReturnValue({ data: { user: { name: 'u' } }, status: 'authenticated' })
    mockFetchFoods.mockResolvedValue([])
    mockSearchOff.mockResolvedValue([])
  })
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

  it('shows the add row and a Searching row immediately on a local miss', () => {
    const { input } = setup()
    type(input, 'zzqxj')
    expect(addRow('zzqxj')).toHaveLength(1)
    expect(screen.getByRole('option', { name: /Searching/ })).toBeInTheDocument()
  })

  it('keeps the add row as the last option', () => {
    const { input } = setup()
    type(input, 'zzqxj')
    expectAddRowLast('zzqxj')
  })

  it('replaces Searching with fetched results without duplicating the add row, which stays last', async () => {
    mockFetchFoods.mockResolvedValue([food(2, 'Zzqxj Bar')])
    const { input } = setup()
    type(input, 'zzqxj')
    await flushDebounce()
    expect(screen.queryByRole('option', { name: /Searching/ })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Zzqxj Bar/ })).toBeInTheDocument()
    expect(addRow('zzqxj')).toHaveLength(1)
    expectAddRowLast('zzqxj')
  })

  it('shows one add row alongside a local match', async () => {
    const { input } = setup([food(1, 'Apple')])
    type(input, 'app')
    expect(screen.getByRole('option', { name: /Apple/ })).toBeInTheDocument()
    expect(addRow('app')).toHaveLength(1)
    await flushDebounce()
    expect(addRow('app')).toHaveLength(1)
  })

  it('keeps the add row and clears Searching when the online search fails', async () => {
    mockFetchFoods.mockRejectedValue(new Error('boom'))
    mockSearchOff.mockRejectedValue(new Error('boom'))
    const { input } = setup()
    type(input, 'zzqxj')
    await flushDebounce()
    expect(screen.queryByRole('option', { name: /Searching/ })).not.toBeInTheDocument()
    expect(addRow('zzqxj')).toHaveLength(1)
  })

  it('ignores results for a stale query', async () => {
    const first = deferred<Food[]>()
    mockFetchFoods.mockImplementation((p: { search: string }) =>
      p.search === 'zzq' ? first.promise : Promise.resolve([food(3, 'Zzqxj Fresh')]))
    const { input } = setup()
    type(input, 'zzq')
    await flushDebounce() // request for "zzq" now in flight
    type(input, 'zzqxj')
    await act(async () => { first.resolve([food(9, 'Zzq Stale')]) })
    expect(screen.queryByRole('option', { name: /Zzq Stale/ })).not.toBeInTheDocument()
    await flushDebounce()
    expect(screen.getByRole('option', { name: /Zzqxj Fresh/ })).toBeInTheDocument()
    expect(addRow('zzqxj')).toHaveLength(1)
    expect(addRow('zzq')).toHaveLength(0)
  })

  it('closes the panel when the query is emptied', () => {
    const { input } = setup()
    type(input, 'zzqxj')
    type(input, '')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('hides the add row when signed out', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    const { input } = setup()
    type(input, 'zzqxj')
    expect(addRow('zzqxj')).toHaveLength(0)
    await flushDebounce()
    expect(addRow('zzqxj')).toHaveLength(0)
  })

  it('does nothing when the Searching row is chosen', () => {
    const { input, onChange } = setup()
    type(input, 'zzqxj')
    fireEvent.click(screen.getByRole('option', { name: /Searching/ }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByText('Add a new food')).not.toBeInTheDocument()
  })
})
