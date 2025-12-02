import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { RecipeProvider } from './providers/RecipeProvider.tsx'
import { FoodProvider } from './providers/FoodProvider.tsx'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RecipeProvider>
        <FoodProvider>
          <App />
        </FoodProvider>
      </RecipeProvider>
    </BrowserRouter>
  </StrictMode>,
)
