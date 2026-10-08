import type { Meal } from './types'

export type Slot = Meal['slot']

export const SLOT_LABELS: Record<Slot, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export function defaultSlot(): Slot {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
