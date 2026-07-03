'use client'

import { useEffect, useMemo, useState } from 'react'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import { useFoodStore } from '@/stores/food'
import { useShoppingListStore } from '@/stores/shoppingList'
import { apiCreateShoppingListFoodItem } from '@/lib/api/shoppingList'
import { preferredShoppingUnit, sortUnitsCustomFirst } from '@/utils/unitConversion'
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
  const upsertItem = useShoppingListStore((state) => state.upsertItem)

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
    () => sortUnitsCustomFirst(getFoodUnits(selectedFood)).map((foodUnit) => ({ label: foodUnit, value: foodUnit })),
    [selectedFood]
  )

  function handleFoodSelected(food: Food) {
    const nextUnits = getFoodUnits(food)
    setSelectedFood(food)
    setFoodName(food.name)
    setUnit(preferredShoppingUnit(nextUnits, food.servingUnit))
  }

  function handleFoodInputChange(text: string) {
    setFoodName(text)
    // Editing or clearing the search text invalidates a previously selected food,
    // so the item can no longer be added until a food is re-selected.
    if (selectedFood && text !== selectedFood.name) {
      setSelectedFood(null)
      setUnit('')
    }
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
      upsertItem(created)
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
    <div className="shopping-list">
      <div className="shopping-list-content">
        <header className="shopping-list-header">
          <h1>Shopping List</h1>
        </header>

        <div className="shopping-list-panel">
          <div className="add-item-form">
            <div className="field field-food">
              <label htmlFor="shopping-list-food">Food</label>
              <FoodSearch
                value={foodName}
                localFoods={foods}
                onChange={handleFoodSelected}
                onInputChange={handleFoodInputChange}
                placeholder="Search foods"
                inputAriaLabel="Shopping list food"
              />
            </div>

            <div className="field field-amount">
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

            <div className="field field-unit">
              <label htmlFor="shopping-list-unit">Unit</label>
              <Dropdown
                inputId="shopping-list-unit"
                ariaLabel="Shopping list unit"
                value={unit}
                onChange={(e) => setUnit(e.value)}
                options={unitOptions}
                placeholder="Select"
              />
            </div>

            <button
              type="button"
              className="add-item-button"
              onClick={handleAddItem}
              disabled={isAddDisabled}
            >
              {saving ? 'Adding…' : 'Add Item'}
            </button>
          </div>

          {saveError && (
            <div className="add-item-error" role="alert">
              {saveError}
            </div>
          )}

          {items.length === 0 ? (
            <p className="shopping-list-empty">No items yet. Add a food to start your shopping list.</p>
          ) : (
            <ul className="shopping-list-items" aria-label="Shopping list items">
              {items.map((item) => (
                <li key={item.id} className="shopping-list-item">
                  <span className="check-circle" aria-hidden="true" />
                  <span className="item-name">{item.food.name}</span>
                  <span className="item-qty">{item.amount} {item.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
