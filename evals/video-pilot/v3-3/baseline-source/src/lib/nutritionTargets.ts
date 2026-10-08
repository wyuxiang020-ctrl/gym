import type { Profile } from './types'

// 蛋白质系数取目标区间的中值:增肌 1.6-2.2、减脂 1.8-2.2、维持 1.2-1.6
const PROTEIN_COEFFICIENT: Record<Profile['goal'], number> = {
  bulk: 1.9,
  cut: 2.0,
  maintain: 1.4,
}

const CALORIE_OFFSET: Record<Profile['goal'], number> = {
  bulk: 300,
  cut: -400,
  maintain: 0,
}

export function calcProteinTargetG(goal: Profile['goal'], weightKg: number): number {
  return Math.round(weightKg * PROTEIN_COEFFICIENT[goal])
}

// 热量目标 = TDEE + 目标对应偏移量,但任何情况下不低于 BMR
export function calcCalorieTarget(tdee: number, goal: Profile['goal'], bmr: number): number {
  return Math.round(Math.max(tdee + CALORIE_OFFSET[goal], bmr))
}

const FAT_KCAL_RATIO = 0.25 // 脂肪占总热量目标的比例,常见区间 20-30%,取中值
const KCAL_PER_G_FAT = 9
const KCAL_PER_G_CARB = 4
const KCAL_PER_G_PROTEIN = 4

export function calcFatTargetG(calorieTarget: number): number {
  return Math.round((calorieTarget * FAT_KCAL_RATIO) / KCAL_PER_G_FAT)
}

// 碳水 = 剩余热量(总目标 - 蛋白质热量 - 脂肪热量)换算成克数
export function calcCarbsTargetG(calorieTarget: number, proteinG: number, fatG: number): number {
  const remainingKcal = calorieTarget - proteinG * KCAL_PER_G_PROTEIN - fatG * KCAL_PER_G_FAT
  return Math.max(0, Math.round(remainingKcal / KCAL_PER_G_CARB))
}

// 蔬菜按中国居民膳食指南的通用建议(300-500g/天),不随体重换算
export const VEGETABLE_TARGET_G = 400

function gramsFor(gapG: number, per100g: number): number {
  return Math.round(((gapG / per100g) * 100) / 10) * 10
}

// 蛋白质每 100g 含量(生重估算)
const PROTEIN_SOURCES: { name: string; per100g: number }[] = [
  { name: '鸡胸肉(生)', per100g: 23 },
  { name: '虾仁', per100g: 24 },
  { name: '瘦牛肉', per100g: 26 },
  { name: '三文鱼', per100g: 20 },
  { name: '北豆腐', per100g: 12 },
]
const PROTEIN_POWDER_SCOOP_G = 24 // 一勺(约30g粉)
const EGG_PROTEIN_G = 6 // 一个鸡蛋(约50g)

// 把营养缺口换算成常见食物份量,方便凭感觉判断要不要吃,而不是纠结克数
export function proteinFoodEquivalents(gapG: number): string[] {
  if (gapG <= 0) return []
  const items = PROTEIN_SOURCES.map((s) => `${s.name}约 ${gramsFor(gapG, s.per100g)}g`)
  items.push(`蛋白粉约 ${Math.round((gapG / PROTEIN_POWDER_SCOOP_G) * 10) / 10} 勺`)
  items.push(`鸡蛋约 ${Math.ceil(gapG / EGG_PROTEIN_G)} 个`)
  return items
}

// 碳水每 100g 含量(熟重/常见购买状态估算)
const CARB_SOURCES: { name: string; per100g: number }[] = [
  { name: '米饭(熟)', per100g: 28 },
  { name: '红薯(熟)', per100g: 24 },
  { name: '全麦面包', per100g: 43 },
  { name: '燕麦(干)', per100g: 61 },
  { name: '意大利面(熟)', per100g: 25 },
]

export function carbsFoodEquivalents(gapG: number): string[] {
  if (gapG <= 0) return []
  return CARB_SOURCES.map((s) => `${s.name}约 ${gramsFor(gapG, s.per100g)}g`)
}

// 脂肪每 100g 含量估算
const FAT_SOURCES: { name: string; per100g: number }[] = [
  { name: '橄榄油', per100g: 100 },
  { name: '混合坚果', per100g: 50 },
  { name: '牛油果', per100g: 15 },
  { name: '花生酱', per100g: 50 },
]

export function fatFoodEquivalents(gapG: number): string[] {
  if (gapG <= 0) return []
  return FAT_SOURCES.map((s) => `${s.name}约 ${gramsFor(gapG, s.per100g)}g`)
}

export const VEGETABLE_EXAMPLES = [
  '生菜、菠菜等叶菜:每餐约一到两拳头',
  '西兰花、菜花:每餐约一拳头',
  '番茄、黄瓜:每餐约一个中等大小',
]
