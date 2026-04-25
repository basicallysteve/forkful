'use client'

import ToolBar from '@/components/ToolBar'
import { toSlug } from '@/utils/slug'
import type { Recipe } from '@/types/Recipe'

interface ClientLayoutProps {
  children: React.ReactNode
  recipes: Recipe[]
}

export default function ClientLayout({ children, recipes }: ClientLayoutProps) {
  const menuOptions = [
    {
      label: 'Recipes',
      to: '/recipes',
      action: () => {},
      children: [
        { label: 'Browse All Recipes', to: '/recipes', action: () => {} },
        { label: 'Add New Recipe', to: '/recipes/new', action: () => {} },
        ...recipes.map((recipe: Recipe) => ({
          label: recipe.name,
          to: `/recipes/${toSlug(recipe.name)}`,
          action: () => {},
        })),
      ],
    },
    {
      label: 'Foods',
      to: '/foods',
      action: () => {},
      children: [
        { label: 'Browse All Foods', to: '/foods', action: () => {} },
        { label: 'Add New Food', to: '/foods/new', action: () => {} },
      ],
    },
    {
      label: 'Pantry',
      to: '/pantry',
      action: () => {},
      children: [
        { label: 'Browse Pantry', to: '/pantry', action: () => {} },
        { label: 'Add Pantry Item', to: '/pantry/new', action: () => {} },
      ],
    },
    {
      label: 'Login',
      to: '/login',
      action: () => {},
    },
  ]

  return (
    <div className="app-shell">
      <ToolBar menuOptions={menuOptions} />
      {children}
    </div>
  )
}
