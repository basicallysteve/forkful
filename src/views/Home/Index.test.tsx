import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from './index'
import type { Recipe } from '@/types/Recipe'
import type { PantryItem } from '@/types/PantryItem'
import type { Food } from '@/types/Food'

const mockFood: Food = {
  id: 1,
  name: 'Milk',
  calories: 60,
  protein: 3,
  carbs: 5,
  fat: 3,
  fiber: 0,
  servingSize: 240,
  servingUnit: 'ml',
  measurements: ['ml', 'cup'],
}

const mockRecipes: Recipe[] = [
  {
    id: 1,
    name: 'Chocolate Milk',
    meal: 'Snack',
    description: 'Yummy chocolate milk!',
    ingredients: [],
    date_published: new Date('2025-01-01'),
    isPublic: true,
  },
  {
    id: 2,
    name: 'Ham and Cheese Sandwich',
    meal: 'Lunch',
    description: 'A simple and quick lunch!',
    ingredients: [],
    date_published: new Date('2025-01-02'),
    isPublic: true,
  },
]

const mockPantryItems: PantryItem[] = [
  {
    id: 1,
    food: mockFood,
    expirationDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    originalSize: { size: 1, unit: 'l' },
    currentSize: { size: 0.5, unit: 'l' },
    addedDate: new Date(),
    status: 'expiring-soon',
    frozenDate: null,
  },
  {
    id: 2,
    food: { ...mockFood, id: 2, name: 'Eggs' },
    expirationDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // yesterday
    originalSize: { size: 12, unit: 'count' },
    currentSize: { size: 6, unit: 'count' },
    addedDate: new Date(),
    status: 'expired',
    frozenDate: null,
  },
]

describe('Home — unauthenticated view', () => {
  it('renders the hero headline', () => {
    render(<Home isAuthenticated={false} recipes={[]} />)
    expect(screen.getByText('Your kitchen, organised.')).toBeInTheDocument()
  })

  it('renders the Get started free CTA linking to /create-account', () => {
    render(<Home isAuthenticated={false} recipes={[]} />)
    const cta = screen.getByRole('link', { name: /get started free/i })
    expect(cta).toHaveAttribute('href', '/create-account')
  })

  it('renders the Log in secondary link', () => {
    render(<Home isAuthenticated={false} recipes={[]} />)
    const login = screen.getByRole('link', { name: /log in/i })
    expect(login).toHaveAttribute('href', '/login')
  })

  it('renders all three feature callout cards', () => {
    render(<Home isAuthenticated={false} recipes={[]} />)
    expect(screen.getByText('Recipes')).toBeInTheDocument()
    expect(screen.getByText('Pantry tracker')).toBeInTheDocument()
    expect(screen.getByText('Food log')).toBeInTheDocument()
  })

  it('renders the Popular recipes section heading', () => {
    render(<Home isAuthenticated={false} recipes={mockRecipes} />)
    expect(screen.getByText('Popular recipes')).toBeInTheDocument()
  })

  it('renders recipe names', () => {
    render(<Home isAuthenticated={false} recipes={mockRecipes} />)
    expect(screen.getByText('Chocolate Milk')).toBeInTheDocument()
    expect(screen.getByText('Ham and Cheese Sandwich')).toBeInTheDocument()
  })

  it('shows Most popular badge on the first recipe only', () => {
    render(<Home isAuthenticated={false} recipes={mockRecipes} />)
    const badges = screen.getAllByText(/most popular/i)
    expect(badges).toHaveLength(1)
  })

  it('shows empty state when there are no recipes', () => {
    render(<Home isAuthenticated={false} recipes={[]} />)
    expect(screen.getByText('No recipes available yet.')).toBeInTheDocument()
  })

  it('renders Browse all recipes link', () => {
    render(<Home isAuthenticated={false} recipes={mockRecipes} />)
    expect(screen.getByRole('link', { name: /browse all recipes/i })).toHaveAttribute('href', '/recipes')
  })

  it('does not render the authenticated dashboard', () => {
    render(<Home isAuthenticated={false} recipes={mockRecipes} />)
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Expiring soon')).not.toBeInTheDocument()
  })
})

describe('Home — authenticated dashboard', () => {
  it('renders the welcome heading with username', () => {
    render(<Home isAuthenticated username="steve" recipes={[]} />)
    expect(screen.getByText('Welcome back, steve!')).toBeInTheDocument()
  })

  it('renders Recently saved recipes section', () => {
    render(<Home isAuthenticated username="steve" recipes={mockRecipes} />)
    expect(screen.getByText('Recently saved recipes')).toBeInTheDocument()
    expect(screen.getByText('Chocolate Milk')).toBeInTheDocument()
    expect(screen.getByText('Ham and Cheese Sandwich')).toBeInTheDocument()
  })

  it('shows empty state with browse link when no saved recipes', () => {
    render(<Home isAuthenticated username="steve" recipes={[]} />)
    expect(screen.getByText(/no saved recipes yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /browse recipes/i })).toHaveAttribute('href', '/recipes')
  })

  it('does not show Most popular badge in authenticated view', () => {
    render(<Home isAuthenticated username="steve" recipes={mockRecipes} />)
    expect(screen.queryByText(/most popular/i)).not.toBeInTheDocument()
  })

  it('renders the Expiring soon pantry widget', () => {
    render(<Home isAuthenticated username="steve" recipes={[]} expiringItems={mockPantryItems} />)
    expect(screen.getByText('Expiring soon')).toBeInTheDocument()
    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('Eggs')).toBeInTheDocument()
  })

  it('shows expired label for past-due items', () => {
    render(<Home isAuthenticated username="steve" recipes={[]} expiringItems={mockPantryItems} />)
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('shows empty pantry state when no expiring items', () => {
    render(<Home isAuthenticated username="steve" recipes={[]} expiringItems={[]} />)
    expect(screen.getByText('Nothing expiring in the next 7 days.')).toBeInTheDocument()
  })

  it('renders the Food log widget with Coming soon badge', () => {
    render(<Home isAuthenticated username="steve" recipes={[]} />)
    const headings = screen.getAllByText('Food log')
    expect(headings.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Breakfast')).toBeInTheDocument()
    expect(screen.getByText('Lunch')).toBeInTheDocument()
    expect(screen.getByText('Dinner')).toBeInTheDocument()
    expect(screen.getByText('Snacks')).toBeInTheDocument()
  })

  it('renders the Value saved widget with Coming soon badge', () => {
    render(<Home isAuthenticated username="steve" recipes={[]} />)
    expect(screen.getByText('Value saved')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('renders View pantry link in pantry widget', () => {
    render(<Home isAuthenticated username="steve" recipes={[]} expiringItems={mockPantryItems} />)
    expect(screen.getByRole('link', { name: /view pantry/i })).toHaveAttribute('href', '/pantry')
  })

  it('does not render the hero or feature callouts', () => {
    render(<Home isAuthenticated username="steve" recipes={[]} />)
    expect(screen.queryByText('Your kitchen, organised.')).not.toBeInTheDocument()
    expect(screen.queryByText('Pantry tracker')).not.toBeInTheDocument()
  })
})
