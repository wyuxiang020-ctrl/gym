import { useState } from 'react'
import * as store from '../../lib/store'
import type { DayLog, FoodItem, Meal, Profile } from '../../lib/types'
import { defaultSlot } from '../../lib/mealSlot'
import { MealSection } from './MealSection'
import { DailyTargets } from './DailyTargets'

async function callRecalcMeal(items: Meal['items'], note: string): Promise<Meal['items']> {
  const res = await fetch('/api/recalc-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, note }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? '重算失败')
  return (body.result?.items ?? items) as Meal['items']
}

export function MealDaySection({
  date,
  profile,
  weightKg,
}: {
  date: string
  profile: Profile
  weightKg: number | null
}) {
  const [dayLog, setDayLog] = useState<DayLog>(() => store.getDayLog(date))
  const [recalcError, setRecalcError] = useState<string | null>(null)

  function refresh() {
    setDayLog(store.getDayLog(date))
  }

  function addMeal(meal: Omit<Meal, 'id'>) {
    store.addMeal(date, meal)
    refresh()
  }

  function addRecipe(items: FoodItem[]) {
    store.addMeal(date, { slot: defaultSlot(), items, confirmed: true })
    refresh()
  }

  function deleteMeal(id: string) {
    store.deleteMeal(date, id)
    refresh()
  }

  function updateNote(id: string, note: string) {
    store.updateMeal(date, id, { note })
    refresh()
  }

  async function recalc(id: string) {
    const meal = dayLog.meals.find((m) => m.id === id)
    if (!meal?.note?.trim()) return
    setRecalcError(null)
    try {
      const items = await callRecalcMeal(meal.items, meal.note)
      store.updateMeal(date, id, { items })
      refresh()
    } catch (err) {
      setRecalcError(err instanceof Error ? err.message : '重算失败')
    }
  }

  return (
    <div className="space-y-2">
      {recalcError && <p className="text-xs text-red-400">{recalcError}</p>}
      <MealSection
        meals={dayLog.meals}
        onAddMeal={addMeal}
        onDeleteMeal={deleteMeal}
        onUpdateNote={updateNote}
        onRecalc={recalc}
      />
      <DailyTargets profile={profile} weightKg={weightKg} meals={dayLog.meals} onAddRecipe={addRecipe} />
    </div>
  )
}
