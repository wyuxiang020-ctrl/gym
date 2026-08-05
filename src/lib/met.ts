export type CardioActivity =
  | 'strength'
  | 'walk'
  | 'run'
  | 'cycling'
  | 'elliptical'
  | 'swimming'
  | 'jumpRope'
  | 'rowing'

export type Intensity = 'low' | 'mid' | 'high'

// MET 参照表:项目 x 强度
export const MET_TABLE: Record<CardioActivity, Record<Intensity, number>> = {
  strength: { low: 3.5, mid: 5.0, high: 6.0 },
  walk: { low: 3.5, mid: 4.3, high: 5.0 },
  run: { low: 7.0, mid: 9.8, high: 11.8 }, // 7分/km, 6分/km, 5分/km
  cycling: { low: 4.0, mid: 8.0, high: 10.0 },
  elliptical: { low: 4.6, mid: 5.0, high: 5.5 },
  swimming: { low: 6.0, mid: 8.3, high: 10.0 },
  jumpRope: { low: 8.8, mid: 11.8, high: 12.3 },
  rowing: { low: 4.8, mid: 7.0, high: 8.5 },
}

export const CARDIO_TYPE_LABELS: Record<Exclude<CardioActivity, 'strength'>, string> = {
  walk: '快走',
  run: '跑步',
  cycling: '单车',
  elliptical: '椭圆机',
  swimming: '游泳',
  jumpRope: '跳绳',
  rowing: '划船机',
}

function roundTo10(kcal: number): number {
  return Math.round(kcal / 10) * 10
}

// 消耗 kcal = MET × 体重kg × 时长(小时),取整到 10 kcal
export function calcMetKcal(activity: CardioActivity, intensity: Intensity, weightKg: number, minutes: number): number {
  const met = MET_TABLE[activity][intensity]
  const hours = minutes / 60
  return roundTo10(met * weightKg * hours)
}

export function calcCardioKcal(
  type: CardioActivity,
  intensity: Intensity,
  weightKg: number,
  minutes: number,
): number {
  return calcMetKcal(type, intensity, weightKg, minutes)
}

// 力量训练时长按「总组数 × 3 分钟」估算,也允许手动填实际时长
export function estimateStrengthMinutes(totalSets: number): number {
  return totalSets * 3
}

export function calcStrengthKcal(
  totalSets: number,
  weightKg: number,
  intensity: Intensity = 'mid',
  actualMinutes?: number,
): number {
  const minutes = actualMinutes ?? estimateStrengthMinutes(totalSets)
  return calcMetKcal('strength', intensity, weightKg, minutes)
}
