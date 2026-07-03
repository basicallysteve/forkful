'use client'

import { useEffect, useMemo, useState } from 'react'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import { useFoodStore } from '@/stores/food'
import { useShoppingListStore } from '@/stores/shoppingList'
import { apiCreateShoppingListFoodItem } from '@/lib/api/shoppingList'
import type { Food } from '@/types/Food'
import type { ShoppingListItem } from '@/types/ShoppingList'
import { InputNumber } from 'primereact/inputnumber'
import type { InputNumberValueChangeEvent } from 'primereact/inputnumber'
import { Dropdown } from 'primereact/dropdown'

type ShoppingListViewProps = {
  initialFoods: Food[]
  initialItems: ShoppingListItem[]
}

function getFoodUnits(food: Food | null): string[] {
  if (!food) return []
  const units = food.measurements.map((measurement) => measurement.unit)
  return units.length > 0 ? units : [food.servingUnit].filter(Boolean)
}

export default function ShoppingListView({ initialFoods, initialItems }: ShoppingListViewProps) {
  const foods = useFoodStore((state) => state.foods)
  const setFoods = useFoodStore((state) => state.setFoods)
  const items = useShoppingListStore((state) => state.items)
  const setItems = useShoppingListStore((state) => state.setItems)
  const addItem = useShoppingListStore((state) => state.addItem)

  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [foodName, setFoodName] = useState('')
  const [amount, setAmount] = useState(1)
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setFoods(initialFoods)
    setItems(initialItems)
  }, [initialFoods, initialItems, setFoods, setItems])

  const unitOptions = useMemo(
    () => getFoodUnits(selectedFood).map((foodUnit) => ({ label: foodUnit, value: foodUnit })),
    [selectedFood]
  )

  function handleFoodSelected(food: Food) {
    const nextUnits = getFoodUnits(food)
    setSelectedFood(food)
    setFoodName(food.name)
    setUnit(nextUnits[0] ?? '')
  }

  async function handleAddItem() {
    if (!selectedFood || amount <= 0 || !unit) return

    setSaving(true)
    setSaveError(null)
    try {
      const created = await apiCreateShoppingListFoodItem({
        foodId: selectedFood.id,
        amount,
        unit,
      })
      addItem(created)
      setSelectedFood(null)
      setFoodName('')
      setAmount(1)
      setUnit('')
    } catch {
      setSaveError('Failed to add item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isAddDisabled = saving || !selectedFood || amount <= 0 || !unit

  return (
    <div className="pantry-list">
      <div className="pantry-content">
        <div className="pantry-header">
          <div>
            <p className="pantry-label">Meal Planning</p>
            <h1 className="pantry-name">Shopping List</h1>
          </div>
        </div>

        <div className="pantry-panel">
          <div className="panel-toolbar" style={{ alignItems: 'flex-end' }}>
            <div className="filter-group" style={{ minWidth: 280, flex: 1 }}>
              <label htmlFor="shopping-list-food">Food</label>
              <FoodSearch
                value={foodName}
                localFoods={foods}
                onChange={handleFoodSelected}
                placeholder="Search foods"
                inputAriaLabel="Shopping list food"
              />
            </div>

            <div className="filter-group">
              <label htmlFor="shopping-list-amount">Amount</label>
              <InputNumber
                inputId="shopping-list-amount"
                min={0.01}
                minFractionDigits={0}
                maxFractionDigits={2}
                value={amount}
                onValueChange={(e: InputNumberValueChangeEvent) => setAmount(e.value ?? 1)}
              />
            </div>

            <div className="filter-group">
              <label htmlFor="shopping-list-unit">Unit</label>
              <Dropdown
                inputId="shopping-list-unit"
                ariaLabel="Shopping list unit"
                value={unit}
                onChange={(e) => setUnit(e.value)}
                options={unitOptions}
                placeholder="Select unit"
              />
            </div>

            <button
              type="button"
              className="pill pill-primary"
              onClick={handleAddItem}
              disabled={isAddDisabled}
            >
              {saving ? 'Adding…' : 'Add Item'}
            </button>
          </div>

          {saveError && (
            <div className="bulk-actions-bar" role="alert">
              {saveError}
            </div>
          )}

          {items.length === 0 ? (
            <div className="empty-state">No items yet. Add a food to start your shopping list.</div>
          ) : (
            <div className="pantry-grid">
              {items.map((item) => (
                <article key={item.id} className="pantry-item-card">
                  <div className="item-header">
                    <div>
                      <h2>{item.food.name}</h2>
                      <p>{item.amount} {item.unit}</p>
                    </div>
                  </div>
                  <div className="item-meta">
                    <span>Source: {item.sourceType}</span>
                    <span>Status: {item.status}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
