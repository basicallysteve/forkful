import RecipeIndex from "@/Pages/Recipe/Index"
import RecipeStore from "@/Pages/Recipe/Store"
import RecipesList from "@/Pages/Recipes/Index"
import CreateAccount from "@/Pages/CreateAccount/CreateAccount"
import Login from "@/Pages/Login/Login"
import FoodsList from "@/Pages/Foods/Index"
import FoodStore from "@/Pages/Food/Store"
import FoodIndex from "@/Pages/Food/Index"
import PantryList from "@/Pages/Pantry/Index"
import PantryStore from "@/Pages/Pantry/Store"
import ToolBar from "@/components/ToolBar"
import './App.css'
import { Routes, Route } from 'react-router-dom'
import Home from "@/Pages/Home"
import { useRecipeStore } from '@/stores/recipes'
import { useFoodStore } from '@/stores/food'
import { usePantryStore } from '@/stores/pantry'
import type { Recipe } from '@/types/Recipe'
import type { Food } from '@/types/Food'
import type { PantryItem } from '@/types/PantryItem'
import { toSlug } from '@/utils/slug'

function App() {
  const recipes = useRecipeStore((state) => state.recipes)
  const foods = useFoodStore((state) => state.foods)
  const pantryItems = usePantryStore((state) => state.items)

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
        }))
    ]
    },
    {
      label: 'Foods',
      action: () => { console.log('Foods clicked') },
      children: [
          { label: 'Browse All Foods', action: () => { console.log('Browse All Foods clicked') }, to: '/foods' },
          { label: 'Add New Food', action: () => { console.log('Add New Food clicked') }, to: '/foods/new' },
    ]
    },
    {
      label: 'Pantry',
      action: () => { console.log('Pantry clicked') },
      children: [
          { label: 'Browse Pantry', action: () => { console.log('Browse Pantry clicked') }, to: '/pantry' },
          { label: 'Add Pantry Item', action: () => { console.log('Add Pantry Item clicked') }, to: '/pantry/new' },
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
    },
    {
      label: 'Login',
      to: '/login',
    },
  ]

  
  return (
    <div className="app-shell">
      <ToolBar menuOptions={menuOptions} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/recipes" element={<RecipesList />} />
        <Route path="/recipes/new" element={<RecipeStore />} />
        <Route path="/foods" element={<FoodsList />} />
        <Route path="/foods/new" element={<FoodStore />} />
        <Route path="/pantry" element={<PantryList />} />
        <Route path="/pantry/new" element={<PantryStore />} />
        { 
          recipes.map((recipe: Recipe) => (
            <Route key={recipe.id} path={`/recipes/${toSlug(recipe.name)}`} element={<RecipeIndex recipe={recipe} />} />
          ))
        }
        {
          foods.map((food: Food) => (
            <Route key={food.id} path={`/foods/${toSlug(food.name)}`} element={<FoodIndex food={food} />} />
          ))
        }
        {
          foods.map((food: Food) => (
            <Route key={`${food.id}-edit`} path={`/foods/${toSlug(food.name)}/edit`} element={<FoodStore existingFood={food} />} />
          ))
        }
        {
          pantryItems.map((item: PantryItem) => (
            <Route key={`${item.id}-edit`} path={`/pantry/${item.id}/edit`} element={<PantryStore existingItem={item} />} />
          ))
        }
      </Routes>
    </div>
  )
}

export default App
