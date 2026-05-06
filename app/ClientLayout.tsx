'use client'

import ToolBar from '@/components/ToolBar'
import { toSlug } from '@/utils/slug'
import type { Recipe } from '@/types/Recipe'
import { PrimeReactProvider } from 'primereact/api'

interface ClientLayoutProps {
  children: React.ReactNode
  recipes: Recipe[]
  isLoggedIn: boolean
}

export default function ClientLayout({ children, recipes, isLoggedIn }: ClientLayoutProps) {
  const menuOptions = [
    {
      label: 'Recipes',
      to: '/recipes',
      children: [
        { label: 'Browse All Recipes', to: '/recipes' },
        { label: 'Add New Recipe', to: '/recipes/new' },
        ...recipes.map((recipe: Recipe) => ({
          label: recipe.name,
          to: `/recipes/${toSlug(recipe.name)}`,
        })),
      ],
    },
    {
      label: 'Foods',
      to: '/foods',
      children: [
        { label: 'Browse All Foods', to: '/foods' },
        { label: 'Add New Food', to: '/foods/new' },
      ],
    },
    {
      label: 'Pantry',
      to: '/pantry',
      children: [
        { label: 'Browse Pantry', to: '/pantry' },
        { label: 'Add Pantry Item', to: '/pantry/new' },
      ],
    },
    ...(isLoggedIn ? [{ label: 'Logout', to: '/logout' }] : [{ label: 'Login', to: '/login' }]),
  ]

  return (
    <PrimeReactProvider>
      <div className="app-shell">
        <ToolBar menuOptions={menuOptions} />
        {children}
      </div>
    </PrimeReactProvider>
  )
}
