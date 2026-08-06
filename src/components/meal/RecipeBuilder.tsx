import { useState } from 'react'
import {
  PROTEIN_INGREDIENTS,
  VEGETABLE_INGREDIENTS,
  scaleIngredient,
  suggestRecipeName,
} from '../../lib/recipeIngredients'
import type { FoodItem } from '../../lib/types'
import { Stepper } from '../workout/Stepper'

const DEFAULT_PROTEIN_G = 150
const DEFAULT_VEGETABLE_G = 150

export function RecipeBuilder({ onAddToMeal }: { onAddToMeal: (items: FoodItem[]) => void }) {
  const [proteinName, setProteinName] = useState(PROTEIN_INGREDIENTS[0].name)
  const [vegName, setVegName] = useState(VEGETABLE_INGREDIENTS[0].name)
  const [proteinGrams, setProteinGrams] = useState(DEFAULT_PROTEIN_G)
  const [vegGrams, setVegGrams] = useState(DEFAULT_VEGETABLE_G)
  const [added, setAdded] = useState(false)

  const proteinIngredient = PROTEIN_INGREDIENTS.find((p) => p.name === proteinName)!
  const vegIngredient = VEGETABLE_INGREDIENTS.find((v) => v.name === vegName)!

  const proteinScaled = scaleIngredient(proteinIngredient, proteinGrams)
  const vegScaled = scaleIngredient(vegIngredient, vegGrams)
  const dishName = suggestRecipeName(vegName, proteinName)

  const totalKcal = proteinScaled.kcal + vegScaled.kcal
  const totalProtein = Math.round((proteinScaled.protein + vegScaled.protein) * 10) / 10

  function handleAdd() {
    const items: FoodItem[] = [
      {
        name: proteinScaled.name,
        grams: proteinScaled.grams,
        kcal: proteinScaled.kcal,
        protein: proteinScaled.protein,
        carbs: proteinScaled.carbs,
        fat: proteinScaled.fat,
        confidence: 'high',
      },
      {
        name: vegScaled.name,
        grams: vegScaled.grams,
        kcal: vegScaled.kcal,
        protein: vegScaled.protein,
        carbs: vegScaled.carbs,
        fat: vegScaled.fat,
        confidence: 'high',
      },
    ]
    onAddToMeal(items)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-300 bg-card p-3">
      <p className="text-sm font-medium text-neutral-900">搭配一份菜谱</p>

      <div>
        <p className="mb-1 text-xs text-neutral-500">选蛋白质(肉蛋奶豆制品)</p>
        <div className="flex flex-wrap gap-1.5">
          {PROTEIN_INGREDIENTS.map((p) => (
            <button
              key={p.name}
              onClick={() => setProteinName(p.name)}
              className={`min-h-11 rounded-md border px-2.5 text-xs ${
                proteinName === p.name ? 'border-primary text-primary bg-primary/10' : 'border-neutral-300 text-neutral-600'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Stepper value={proteinGrams} step={25} min={25} onChange={setProteinGrams} suffix="g" />
          <span className="text-xs text-neutral-500">
            {proteinScaled.kcal} kcal · 蛋白质 {proteinScaled.protein}g
          </span>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-neutral-500">选蔬菜</p>
        <div className="flex flex-wrap gap-1.5">
          {VEGETABLE_INGREDIENTS.map((v) => (
            <button
              key={v.name}
              onClick={() => setVegName(v.name)}
              className={`min-h-11 rounded-md border px-2.5 text-xs ${
                vegName === v.name ? 'border-plate-green text-plate-green bg-plate-green/10' : 'border-neutral-300 text-neutral-600'
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Stepper value={vegGrams} step={25} min={25} onChange={setVegGrams} suffix="g" />
          <span className="text-xs text-neutral-500">
            {vegScaled.kcal} kcal · 蛋白质 {vegScaled.protein}g
          </span>
        </div>
      </div>

      <div className="space-y-1 rounded-md bg-neutral-100 p-3">
        <p className="font-heading text-base text-neutral-900">{dishName}</p>
        <p className="text-xs text-neutral-600">
          {proteinScaled.name} {proteinScaled.grams}g · {vegScaled.name} {vegScaled.grams}g
        </p>
        <p className="text-xs text-neutral-500">
          合计约 {totalKcal} kcal · 蛋白质 {totalProtein}g
        </p>
      </div>

      <button
        onClick={handleAdd}
        className="min-h-11 w-full rounded-md bg-primary hover:bg-primary-dark text-sm font-medium text-white"
      >
        {added ? '已加入今天饮食 ✓' : '加入今天饮食'}
      </button>
    </div>
  )
}
