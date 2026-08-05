import { useState } from 'react'
import type { FoodItem, Meal, Profile } from '../../lib/types'
import { calcAge, calcBMR, calcTDEE } from '../../lib/calculations'
import {
  calcCalorieTarget,
  calcCarbsTargetG,
  calcFatTargetG,
  calcProteinTargetG,
  carbsFoodEquivalents,
  fatFoodEquivalents,
  VEGETABLE_EXAMPLES,
  VEGETABLE_TARGET_G,
} from '../../lib/nutritionTargets'
import { RecipeBuilder } from './RecipeBuilder'

function NutrientRow({
  label,
  target,
  consumed,
  unit,
  equivalents,
}: {
  label: string
  target: number
  consumed: number | null
  unit: string
  equivalents: string[]
}) {
  const [open, setOpen] = useState(false)
  const gap = consumed != null ? Math.round(target - consumed) : null

  return (
    <>
      <tr className="border-b border-neutral-200">
        <td className="py-1.5 pr-2 text-neutral-900">{label}</td>
        <td className="py-1.5 pr-2 text-right text-neutral-800">
          {target}
          {unit}
        </td>
        <td className="py-1.5 pr-2 text-right text-neutral-800">
          {consumed != null ? `${Math.round(consumed)}${unit}` : '—'}
        </td>
        <td className="py-1.5 text-right text-neutral-800">
          {gap != null ? (gap >= 0 ? `还差 ${gap}${unit}` : `超出 ${-gap}${unit}`) : '—'}
        </td>
      </tr>
      {equivalents.length > 0 && (
        <tr className="border-b border-neutral-200">
          <td colSpan={4} className="pb-2 pt-1">
            <button
              className="text-xs text-neutral-400 underline underline-offset-2"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? '收起' : '查看食材参考'}
            </button>
            {open && (
              <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
                {equivalents.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export function DailyTargets({
  profile,
  weightKg,
  meals,
  onAddRecipe,
}: {
  profile: Profile
  weightKg: number | null
  meals: Meal[]
  onAddRecipe: (items: FoodItem[]) => void
}) {
  if (!weightKg) {
    return <p className="text-xs text-neutral-500">添加一条包含体重的测量记录后,这里会显示今日营养目标。</p>
  }

  const age = calcAge(profile.birthYear)
  const bmr = calcBMR({ gender: profile.gender, weightKg, heightCm: profile.height, age })
  const tdee = calcTDEE(bmr, profile.activityLevel)
  const proteinTarget = calcProteinTargetG(profile.goal, weightKg)
  const calorieTarget = calcCalorieTarget(tdee, profile.goal, bmr)
  const fatTarget = calcFatTargetG(calorieTarget)
  const carbsTarget = calcCarbsTargetG(calorieTarget, proteinTarget, fatTarget)

  const consumedProtein = meals.reduce((s, m) => s + m.items.reduce((s2, i) => s2 + i.protein, 0), 0)
  const consumedCarbs = meals.reduce((s, m) => s + m.items.reduce((s2, i) => s2 + i.carbs, 0), 0)
  const consumedFat = meals.reduce((s, m) => s + m.items.reduce((s2, i) => s2 + i.fat, 0), 0)
  const consumedKcal = meals.reduce((s, m) => s + m.items.reduce((s2, i) => s2 + i.kcal, 0), 0)

  const proteinGap = proteinTarget - consumedProtein
  const carbsGap = carbsTarget - consumedCarbs
  const fatGap = fatTarget - consumedFat

  return (
    <div className="space-y-2 rounded-lg border border-neutral-300 bg-card p-3">
      <p className="text-sm font-medium text-neutral-900">今日营养目标(基于体重、身高与目标估算)</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="py-1 font-normal">项目</th>
            <th className="py-1 text-right font-normal">目标</th>
            <th className="py-1 text-right font-normal">已摄入</th>
            <th className="py-1 text-right font-normal">差额</th>
          </tr>
        </thead>
        <tbody>
          <NutrientRow label="热量" target={calorieTarget} consumed={consumedKcal} unit=" kcal" equivalents={[]} />
          <NutrientRow label="蛋白质" target={proteinTarget} consumed={consumedProtein} unit="g" equivalents={[]} />
          <NutrientRow
            label="碳水"
            target={carbsTarget}
            consumed={consumedCarbs}
            unit="g"
            equivalents={carbsGap > 0 ? carbsFoodEquivalents(carbsGap) : []}
          />
          <NutrientRow
            label="脂肪"
            target={fatTarget}
            consumed={consumedFat}
            unit="g"
            equivalents={fatGap > 0 ? fatFoodEquivalents(fatGap) : []}
          />
          <NutrientRow label="蔬菜" target={VEGETABLE_TARGET_G} consumed={null} unit="g" equivalents={VEGETABLE_EXAMPLES} />
        </tbody>
      </table>
      <p className="text-xs text-neutral-400">
        热量 / 蛋白质 / 碳水 / 脂肪基于 TDEE 与体重估算;蔬菜为通用膳食建议,不随体重变化。仅供参考。
      </p>

      {proteinGap > 0 && <RecipeBuilder proteinGapG={proteinGap} onAddToMeal={onAddRecipe} />}
    </div>
  )
}
