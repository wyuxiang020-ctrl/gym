export interface Ingredient {
  name: string
  kcal: number // 每 100g
  protein: number
  carbs: number
  fat: number
}

// 蛋白质来源:肉蛋奶及豆制品(生重估算,每 100g)
export const PROTEIN_INGREDIENTS: Ingredient[] = [
  { name: '鸡胸肉', kcal: 110, protein: 23, carbs: 0, fat: 1.5 },
  { name: '虾仁', kcal: 90, protein: 24, carbs: 1, fat: 1 },
  { name: '瘦牛肉', kcal: 140, protein: 26, carbs: 0, fat: 5 },
  { name: '三文鱼', kcal: 180, protein: 20, carbs: 0, fat: 11 },
  { name: '鸭胸', kcal: 120, protein: 19, carbs: 0, fat: 4.5 },
  { name: '猪里脊', kcal: 143, protein: 20, carbs: 0, fat: 6 },
  { name: '金枪鱼', kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { name: '北豆腐', kcal: 90, protein: 12, carbs: 3, fat: 5 },
  { name: '鹰嘴豆(熟)', kcal: 164, protein: 9, carbs: 27, fat: 2.6 },
  { name: '鸡蛋', kcal: 145, protein: 13, carbs: 1, fat: 10 },
  { name: '希腊酸奶', kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
]

// 蔬菜(每 100g)
export const VEGETABLE_INGREDIENTS: Ingredient[] = [
  { name: '西兰花', kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: '菠菜', kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name: '番茄', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name: '黄瓜', kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { name: '生菜', kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  { name: '芦笋', kcal: 20, protein: 2.2, carbs: 3.9, fat: 0.1 },
  { name: '胡萝卜', kcal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { name: '白菜', kcal: 13, protein: 1.5, carbs: 2.2, fat: 0.2 },
  { name: '秋葵', kcal: 33, protein: 1.9, carbs: 7, fat: 0.2 },
  { name: '口蘑', kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3 },
  { name: '甜椒', kcal: 20, protein: 0.9, carbs: 4.6, fat: 0.2 },
]

const COOKING_METHODS = ['炒', '蒸', '煮']

export function suggestRecipeName(vegetable: string, protein: string, methodIndex = 0): string {
  const method = COOKING_METHODS[methodIndex % COOKING_METHODS.length]
  return `${vegetable}${method}${protein}`
}

export function scaleIngredient(ingredient: Ingredient, grams: number): Ingredient & { grams: number } {
  const ratio = grams / 100
  return {
    name: ingredient.name,
    grams,
    kcal: Math.round(ingredient.kcal * ratio),
    protein: Math.round(ingredient.protein * ratio * 10) / 10,
    carbs: Math.round(ingredient.carbs * ratio * 10) / 10,
    fat: Math.round(ingredient.fat * ratio * 10) / 10,
  }
}
