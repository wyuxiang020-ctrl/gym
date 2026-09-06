import type { Meal } from './types'

export const FOOD_SAVE_LIMITS = {
  items: 100,
  nameCharacters: 120,
  grams: 100_000,
  kcal: 100_000,
  macroGrams: 10_000,
} as const

function inRange(value: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= maximum
}

export function validateFoodItemsForSave(items: Meal['items']): string | null {
  if (items.length === 0) return '请至少保留一项食物'
  if (items.length > FOOD_SAVE_LIMITS.items) {
    return `一餐最多保存 ${FOOD_SAVE_LIMITS.items} 项食物`
  }

  for (const [index, item] of items.entries()) {
    const label = `第 ${index + 1} 项食物`
    if (!item.name.trim() || item.name.length > FOOD_SAVE_LIMITS.nameCharacters) {
      return `${label}的名称需要在 1-${FOOD_SAVE_LIMITS.nameCharacters} 个字符之间`
    }
    if (!inRange(item.grams, FOOD_SAVE_LIMITS.grams)) return `${label}的克数超出有效范围`
    if (!inRange(item.kcal, FOOD_SAVE_LIMITS.kcal)) return `${label}的热量超出有效范围`
    if (
      !inRange(item.protein, FOOD_SAVE_LIMITS.macroGrams) ||
      !inRange(item.carbs, FOOD_SAVE_LIMITS.macroGrams) ||
      !inRange(item.fat, FOOD_SAVE_LIMITS.macroGrams)
    ) {
      return `${label}的三大营养素超出有效范围`
    }
    if (![item.grams, item.kcal, item.protein, item.carbs, item.fat].some((value) => value > 0)) {
      return `${label}至少需要一项大于 0 的营养数据`
    }
    if (!['high', 'mid', 'low'].includes(item.confidence)) return `${label}的把握标签无效`
  }
  return null
}
