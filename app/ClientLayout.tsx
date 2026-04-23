'use client'

import ToolBar from '@/components/ToolBar'
import { useRecipeStore } from '@/stores/recipes'
import { toSlug } from '@/utils/slug'
import type { Recipe } from '@/types/Recipe'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const recipes = useRecipeStore((state) => state.recipes)

  const menuOptions = [
    {
      label: 'Recipes',
      action: () => { console.log('Recipes clicked') },
      children: [
        { label: 'Browse All Recipes', action: () => { console.log('Browse All Recipes clicked') }, to: '/recipes' },
        { label: 'Add New Recipe', action: () => { console.log('Add New Recipe clicked') }, to: '/recipes/new' },
        ...recipes.map((recipe: Recipe) => ({
          label: recipe.name,
          to: `/recipes/${toSlug(recipe.name)}`,
          action: () => { console.log(`Recipe clicked: ${recipe.name}`) },
        })),
      ],
    },
    {
      label: 'Foods',
      action: () => { console.log('Foods clicked') },
      children: [
        { label: 'Browse All Foods', action: () => { console.log('Browse All Foods clicked') }, to: '/foods' },
        { label: 'Add New Food', action: () => { console.log('Add New Food clicked') }, to: '/foods/new' },
      ],
    },
    {
      label: 'Pantry',
      action: () => { console.log('Pantry clicked') },
      children: [
        { label: 'Browse Pantry', action: () => { console.log('Browse Pantry clicked') }, to: '/pantry' },
        { label: 'Add Pantry Item', action: () => { console.log('Add Pantry Item clicked') }, to: '/pantry/new' },
      ],
    },
    {
      label: 'Settings',
      action: () => { console.log('Settings clicked') },
      children: [
        {
          label: 'Profile',
          action: () => { console.log('Profile clicked') },
        },
        {
          label: 'Preferences',
          action: () => { console.log('Preferences clicked') },
        },
      ],
    },
    {
      label: 'Login',
      to: '/login',
      action: () => { console.log('Login clicked') },
    },
  ]

  return (
    <div className="app-shell">
      <ToolBar menuOptions={menuOptions} />
      {children}
    </div>
  )
}
