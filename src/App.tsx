import RecipeIndex from "@/Pages/Recipe/Index"
import RecipeStore from "@/Pages/Recipe/Store"
import RecipesList from "@/Pages/Recipes/Index"
import FoodsList from "@/Pages/Foods/Index"
import FoodStore from "@/Pages/Food/Store"
import FoodIndex from "@/Pages/Food/Index"
import ToolBar from "@/components/ToolBar"
import './App.css'
import { Routes, Route } from 'react-router-dom'
import Home from "@/Pages/Home"
import { useContext } from 'react'
import GlobalRecipeContext, { type RecipeContextType } from '@/providers/RecipeProvider'
import GlobalFoodContext, { type FoodContextType } from '@/providers/FoodProvider'
import type { Recipe } from '@/types/Recipe'
import type { Food } from '@/types/Food'

function App() {
  const recipeContext: RecipeContextType | undefined = useContext(GlobalRecipeContext)
  const foodContext: FoodContextType | undefined = useContext(GlobalFoodContext)
  
  if (!recipeContext) {
    throw new Error('RecipeProvider is missing')
  }

  if (!foodContext) {
    throw new Error('FoodProvider is missing')
  }

  const { recipes } = recipeContext
  const { foods } = foodContext

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
      label: 'Foods',
      action: () => { console.log('Foods clicked') },
      children: [
          { label: 'Browse All Foods', action: () => { console.log('Browse All Foods clicked') }, to: '/foods' },
          { label: 'Add New Food', action: () => { console.log('Add New Food clicked') }, to: '/foods/new' },
          ...foods.slice(0, 10).map((food: Food) => ({
            label: food.name,
            to: `/foods/${food.id}`,
            action: () => { console.log(`Food clicked: ${food.name}`) },
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
        <Route path="/recipes" element={<RecipesList />} />
        <Route path="/recipes/new" element={<RecipeStore />} />
        <Route path="/foods" element={<FoodsList />} />
        <Route path="/foods/new" element={<FoodStore />} />
        { 
          recipes.map((recipe: Recipe) => (
            <Route key={recipe.id} path={`/recipes/${recipe.id}`} element={<RecipeIndex recipe={recipe} />} />
          ))
        }
        {
          foods.map((food: Food) => (
            <Route key={food.id} path={`/foods/${food.id}`} element={<FoodIndex food={food} />} />
          ))
        }
        {
          foods.map((food: Food) => (
            <Route key={`${food.id}-edit`} path={`/foods/${food.id}/edit`} element={<FoodStore existingFood={food} />} />
          ))
        }
      </Routes>
    </div>
  )
}

export default App
