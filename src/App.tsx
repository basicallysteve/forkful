import RecipeIndex from "@/Pages/Recipe/Index"
import RecipeStore from "@/Pages/Recipe/Store"
import RecipesList from "@/Pages/Recipes/Index"
import CreateAccount from "@/Pages/CreateAccount/CreateAccount"
import ToolBar from "@/components/ToolBar"
import './App.css'
import { Routes, Route } from 'react-router-dom'
import Home from "@/Pages/Home"
import { useContext } from 'react'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'
import type { Recipe } from '@/types/Recipe'

function App() {
  const recipeContext: RecipeContextType | undefined = useContext(GlobalRecipeContext)
  
  if (!recipeContext) {
    throw new Error('RecipeProvider is missing')
  }

  const { recipes } = recipeContext

  const menuOptions = [
    {
      label: 'Recipes',
      action: () => { console.log('Recipes clicked') },
      children: [
          { label: 'Browse All Recipes', action: () => { console.log('Browse All Recipes clicked') }, to: '/recipes' },
          { label: 'Add New Recipe', action: () => { console.log('Add New Recipe clicked') }, to: '/recipes/new' },
          ...recipes.map((recipe: Recipe) => ({
            label: recipe.name,
            to: `/recipes/${recipe.id}`,
            action: () => { console.log(`Recipe clicked: ${recipe.name}`) },
        }))
    ]
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
        }
      ]
    }
  ]

  
  return (
    <div className="app-shell">
      <ToolBar menuOptions={menuOptions} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/recipes" element={<RecipesList />} />
        <Route path="/recipes/new" element={<RecipeStore />} />
       { 
          recipes.map((recipe: Recipe) => (
            <Route key={recipe.id} path={`/recipes/${recipe.id}`} element={<RecipeIndex recipe={recipe} />} />
          ))
        }
      </Routes>
    </div>
  )
}

export default App
