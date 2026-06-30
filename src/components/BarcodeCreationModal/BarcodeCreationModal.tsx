'use client'

import { useRef, useState, useEffect } from 'react'
import { InputText } from 'primereact/inputtext'
import Modal from '@/components/Modal/Modal'
import FoodSearch from '@/components/FoodSearch/FoodSearch'
import { apiCreateProduct } from '@/lib/api/products'
import { apiFetchFoods } from '@/lib/api/foods'
import { useFoodStore } from '@/stores/food'
import type { Worker as TesseractWorker } from 'tesseract.js'
import type { Product } from '@/types/Product'
import type { Food } from '@/types/Food'
import './barcode-creation-modal.scss'

interface NutritionFields {
  calories: string
  protein: string
  carbs: string
  fat: string
  fiber: string
  saturatedFat: string
  sugar: string
  sodium: string
  servingSize: string
  servingUnit: string
}

interface BarcodeCreationModalProps {
  barcode: string
  onCreated: (product: Product) => void
  onHide: () => void
}

const EMPTY_NUTRITION: NutritionFields = {
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  saturatedFat: '',
  sugar: '',
  sodium: '',
  servingSize: '',
  servingUnit: '',
}

export default function BarcodeCreationModal({ barcode, onCreated, onHide }: BarcodeCreationModalProps) {
  const foods = useFoodStore((state) => state.foods)
  const setFoods = useFoodStore((state) => state.setFoods)

  const [name, setName] = useState('')
  const [foodName, setFoodName] = useState('')
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [nutrition, setNutrition] = useState<NutritionFields>(EMPTY_NUTRITION)
  const [scanning, setScanning] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [foodsError, setFoodsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<TesseractWorker | null>(null)

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (foods.length > 0) return
    let cancelled = false
    apiFetchFoods()
      .then((fetched) => { if (!cancelled) setFoods(fetched) })
      .catch(() => { if (!cancelled) setFoodsError('Could not load foods. Please try again.') })
    return () => { cancelled = true }
  }, [foods.length, setFoods])

  function setField(field: keyof NutritionFields, value: string) {
    setNutrition((prev) => ({ ...prev, [field]: value }))
  }

  function handleScanLabel() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setScanning(true)
    setOcrError(null)

    try {
      if (!workerRef.current) {
        const { createWorker } = await import('tesseract.js')
        workerRef.current = await createWorker('eng')
      }
      const { data: { text } } = await workerRef.current.recognize(file)
      parseNutritionLabel(text)
    } catch {
      setOcrError('Could not read the label. Please enter values manually.')
    } finally {
      setScanning(false)
      // Reset so the same file can be re-selected
      e.target.value = ''
    }
  }

  function parseNutritionLabel(text: string) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

    function extract(patterns: RegExp[]): string {
      for (const line of lines) {
        for (const pat of patterns) {
          const m = line.match(pat)
          if (m) return m[1].trim()
        }
      }
      return ''
    }

    const servingRaw = extract([/serving size[:\s]+(.+)/i])
    const servingMatch = servingRaw.match(/^([\d.]+)\s*([a-zA-Z]+)/)
    const parsedServingSize = servingMatch ? servingMatch[1] : ''
    const parsedServingUnit = servingMatch ? servingMatch[2] : servingRaw

    setNutrition({
      calories: extract([/calories[:\s]+([\d.]+)/i, /energy[:\s]+([\d.]+)\s*kcal/i]),
      protein: extract([/protein[:\s]+([\d.]+)\s*g/i]),
      carbs: extract([/total carbohydrate[s]?[:\s]+([\d.]+)\s*g/i, /carbohydrate[s]?[:\s]+([\d.]+)\s*g/i, /carbs?[:\s]+([\d.]+)\s*g/i]),
      fat: extract([/total fat[:\s]+([\d.]+)\s*g/i, /(?<!saturated\s)fat[:\s]+([\d.]+)\s*g/i]),
      fiber: extract([/dietary fiber[:\s]+([\d.]+)\s*g/i, /fibre[:\s]+([\d.]+)\s*g/i, /fiber[:\s]+([\d.]+)\s*g/i]),
      saturatedFat: extract([/saturated fat[:\s]+([\d.]+)\s*g/i, /saturates[:\s]+([\d.]+)\s*g/i]),
      sugar: extract([/total sugars?[:\s]+([\d.]+)\s*g/i, /sugars?[:\s]+([\d.]+)\s*g/i]),
      sodium: extract([/sodium[:\s]+([\d.]+)\s*mg/i]),
      servingSize: parsedServingSize,
      servingUnit: parsedServingUnit,
    })
  }

  async function handleSave() {
    if (!name.trim() || !selectedFood) return

    const resolvedServingUnit = nutrition.servingUnit.trim() || 'g'
    const resolvedServingSize = Math.max(Number(nutrition.servingSize) || 0.01, 0.01)

    setSaving(true)
    setSaveError(null)
    try {
      const created = await apiCreateProduct({
        name: name.trim(),
        barcode,
        parentFoodId: selectedFood.id,
        calories: Number(nutrition.calories) || 0,
        protein: Number(nutrition.protein) || 0,
        carbs: Number(nutrition.carbs) || 0,
        fat: Number(nutrition.fat) || 0,
        fiber: Number(nutrition.fiber) || 0,
        saturatedFat: nutrition.saturatedFat ? Number(nutrition.saturatedFat) : undefined,
        sugar: nutrition.sugar ? Number(nutrition.sugar) : undefined,
        sodium: nutrition.sodium ? Number(nutrition.sodium) : undefined,
        servingSize: resolvedServingSize,
        servingUnit: resolvedServingUnit,
        measurements: [{ unit: resolvedServingUnit }],
        source: 'manual',
      })
      onCreated(created)
    } catch {
      setSaveError('Failed to save product. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isSaveDisabled = saving || !name.trim() || !selectedFood

  return (
    <Modal
      visible
      onHide={onHide}
      header="Add new product"
      style={{ width: '480px', maxWidth: '95vw' }}
    >
      <div className="bcm-form">
        <div className="bcm-barcode-tag">
          <i className="pi pi-barcode" />
          {barcode}
        </div>

        <div className="form-field">
          <label htmlFor="bcm-name">
            Product name <span className="required">*</span>
          </label>
          <InputText
            id="bcm-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Quaker Oats Instant Oatmeal"
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>
            What type of food is this? <span className="required">*</span>
          </label>
          <small className="bcm-food-hint">Required for meal suggestions</small>
          {foodsError && <p className="bcm-save-error">{foodsError}</p>}
          <FoodSearch
            value={foodName}
            localFoods={foods}
            onChange={(food) => {
              setSelectedFood(food)
              setFoodName(food.name)
            }}
            placeholder="Search foods…"
            inputAriaLabel="Food type"
          />
        </div>

        <div className="bcm-nutrition-section">
          <div className="bcm-nutrition-header">
            <span>Nutrition facts</span>
            <button
              type="button"
              className="secondary-button bcm-scan-btn"
              onClick={handleScanLabel}
              disabled={scanning}
            >
              <i className="pi pi-camera" />
              {scanning ? 'Reading label…' : 'Scan nutrition label'}
            </button>
          </div>

          {ocrError && <p className="bcm-ocr-error">{ocrError}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="bcm-file-input"
            onChange={handleFileChange}
          />

          <div className="bcm-nutrition-row">
            <label className="form-field">
              <span>Serving size</span>
              <input
                type="number"
                min="0.01"
                step="0.1"
                className="text-input"
                value={nutrition.servingSize}
                onChange={(e) => setField('servingSize', e.target.value)}
                placeholder="e.g. 28"
              />
            </label>
            <label className="form-field">
              <span>Serving unit</span>
              <InputText
                value={nutrition.servingUnit}
                onChange={(e) => setField('servingUnit', e.target.value)}
                placeholder="e.g. g"
              />
            </label>
          </div>

          <label className="form-field">
            <span>Calories</span>
            <input
              type="number"
              min="0"
              className="text-input"
              value={nutrition.calories}
              onChange={(e) => setField('calories', e.target.value)}
              placeholder="0"
            />
          </label>

          <div className="bcm-nutrition-row">
            <label className="form-field">
              <span>Protein (g)</span>
              <input type="number" min="0" step="0.1" className="text-input"
                value={nutrition.protein} onChange={(e) => setField('protein', e.target.value)} placeholder="0" />
            </label>
            <label className="form-field">
              <span>Carbs (g)</span>
              <input type="number" min="0" step="0.1" className="text-input"
                value={nutrition.carbs} onChange={(e) => setField('carbs', e.target.value)} placeholder="0" />
            </label>
            <label className="form-field">
              <span>Fat (g)</span>
              <input type="number" min="0" step="0.1" className="text-input"
                value={nutrition.fat} onChange={(e) => setField('fat', e.target.value)} placeholder="0" />
            </label>
          </div>

          <div className="bcm-nutrition-row">
            <label className="form-field">
              <span>Fiber (g)</span>
              <input type="number" min="0" step="0.1" className="text-input"
                value={nutrition.fiber} onChange={(e) => setField('fiber', e.target.value)} placeholder="0" />
            </label>
            <label className="form-field">
              <span>Sat. fat (g)</span>
              <input type="number" min="0" step="0.1" className="text-input"
                value={nutrition.saturatedFat} onChange={(e) => setField('saturatedFat', e.target.value)} placeholder="0" />
            </label>
          </div>

          <div className="bcm-nutrition-row">
            <label className="form-field">
              <span>Sugar (g)</span>
              <input type="number" min="0" step="0.1" className="text-input"
                value={nutrition.sugar} onChange={(e) => setField('sugar', e.target.value)} placeholder="0" />
            </label>
            <label className="form-field">
              <span>Sodium (mg)</span>
              <input type="number" min="0" step="0.1" className="text-input"
                value={nutrition.sodium} onChange={(e) => setField('sodium', e.target.value)} placeholder="0" />
            </label>
          </div>
        </div>

        {saveError && <p className="bcm-save-error">{saveError}</p>}

        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onHide}>Cancel</button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={isSaveDisabled}
          >
            {saving ? 'Saving…' : 'Add product'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
