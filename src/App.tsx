import RecipeIndex from "@/Pages/Recipe/Index"
import RecipeStore from "@/Pages/Recipe/Store"
import ToolBar from "@/components/ToolBar"
import './App.css'
import { Routes, Route } from 'react-router-dom'
import Home from "@/Pages/Home"
import { useContext } from 'react'
import GlobalRecipeContext from '@/providers/RecipeProvider'
function App() {
    const { recipes } = useContext(GlobalRecipeContext);

  const menuOptions = [
    {
      label: 'All Recipes',
      action: () => { console.log('All Recipes clicked') },
      children: [
          { label: 'Add New Recipe', action: () => { console.log('Add New Recipe clicked') }, to: '/recipes/new' },
          ...recipes.map(recipe => ({
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
        <Route path="/recipes/new" element={<RecipeStore />} />
       { 
          recipes.map(recipe => (
            <Route key={recipe.id} path={`/recipes/${recipe.id}`} element={<RecipeIndex recipe={recipe} />} />
          ))
        }
      </Routes>
    </div>
  )
}

export default App
