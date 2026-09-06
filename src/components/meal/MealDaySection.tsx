import { useState } from 'react'
import * as store from '../../lib/store'
import type { DayLog, Meal, Profile } from '../../lib/types'
import { MealSection } from './MealSection'
import { DailyTargets } from './DailyTargets'
import { FoodItemsEditor } from './FoodItemsEditor'
import { parseFoodItemsResponse } from '../../lib/aiValidation'
import { postJson } from '../../lib/apiClient'
import { validateFoodItemsForSave } from '../../lib/foodValidation'

async function callRecalcMeal(items: Meal['items'], note: string): Promise<Meal['items']> {
  const body = await postJson('/api/recalc-meal', { items, note }, '饮食重算失败,请稍后重试。')
  const recalculated = parseFoodItemsResponse(body)
  if (recalculated.length === 0) throw new Error('AI 没有返回可用的食物数据,原记录未修改。')
  return recalculated
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
  const [recalcLoadingId, setRecalcLoadingId] = useState<string | null>(null)
  const [recalcPreview, setRecalcPreview] = useState<{
    mealId: string
    originalItems: Meal['items']
    items: Meal['items']
  } | null>(null)

  function refresh() {
    setDayLog(store.getDayLog(date))
  }

  function addMeal(meal: Omit<Meal, 'id'>) {
    store.addMeal(date, meal)
    refresh()
  }

  function deleteMeal(id: string) {
    store.deleteMeal(date, id)
    if (recalcPreview?.mealId === id) setRecalcPreview(null)
    refresh()
  }

  function updateNote(id: string, note: string) {
    store.updateMeal(date, id, { note })
    if (recalcPreview?.mealId === id) setRecalcPreview(null)
    refresh()
  }

  async function recalc(id: string) {
    const meal = dayLog.meals.find((m) => m.id === id)
    if (!meal?.note?.trim()) return
    setRecalcError(null)
    setRecalcLoadingId(id)
    try {
      const items = await callRecalcMeal(meal.items, meal.note)
      setRecalcPreview({ mealId: id, originalItems: meal.items, items })
    } catch (err) {
      setRecalcError(err instanceof Error ? err.message : '重算失败')
    } finally {
      setRecalcLoadingId(null)
    }
  }

  function confirmRecalc() {
    if (!recalcPreview) return
    const validationError = validateFoodItemsForSave(recalcPreview.items)
    if (validationError) {
      setRecalcError(`重算结果无法保存：${validationError}`)
      return
    }
    store.updateMeal(date, recalcPreview.mealId, { items: recalcPreview.items })
    setRecalcPreview(null)
    setRecalcError(null)
    refresh()
  }

  const originalKcal = recalcPreview?.originalItems.reduce((sum, item) => sum + item.kcal, 0) ?? 0
  const previewKcal = recalcPreview?.items.reduce((sum, item) => sum + item.kcal, 0) ?? 0

  return (
    <div className="space-y-2">
      {recalcError && <p className="text-xs text-red-400">{recalcError}</p>}
      <MealSection
        meals={dayLog.meals}
        onAddMeal={addMeal}
        onDeleteMeal={deleteMeal}
        onUpdateNote={updateNote}
        onRecalc={recalc}
        recalcLoadingId={recalcLoadingId}
      />
      {recalcPreview && (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div>
            <p className="text-sm font-medium text-neutral-900">重算结果尚未写入</p>
            <p className="text-xs text-neutral-600">
              原估算 {Math.round(originalKcal)} kcal → 新估算 {Math.round(previewKcal)} kcal，可先修改再确认。
            </p>
          </div>
          <FoodItemsEditor
            items={recalcPreview.items}
            onChange={(items) => setRecalcPreview({ ...recalcPreview, items })}
            aiGenerated
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              onClick={confirmRecalc}
            >
              确认替换原记录
            </button>
            <button
              className="min-h-11 rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700"
              onClick={() => setRecalcPreview(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}
      <DailyTargets profile={profile} weightKg={weightKg} meals={dayLog.meals} />
    </div>
  )
}
