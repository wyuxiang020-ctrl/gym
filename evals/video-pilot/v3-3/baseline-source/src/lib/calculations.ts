import type { Measurement, Profile } from './types'

const ACTIVITY_FACTORS: Record<Profile['activityLevel'], number> = {
  1: 1.2,
  2: 1.375,
  3: 1.55,
  4: 1.725,
  5: 1.9,
}

export function calcAge(birthYear: number): number {
  return new Date().getFullYear() - birthYear
}

export function calcBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

// 反推:给定身高与目标 BMI,对应的体重(kg)
export function weightForBmi(heightCm: number, bmi: number): number {
  const heightM = heightCm / 100
  return bmi * heightM * heightM
}

export function calcBMR(params: {
  gender: Profile['gender']
  weightKg: number
  heightCm: number
  age: number
}): number {
  const base = 10 * params.weightKg + 6.25 * params.heightCm - 5 * params.age
  return params.gender === 'male' ? base + 5 : base - 161
}

export function calcTDEE(bmr: number, activityLevel: Profile['activityLevel']): number {
  return bmr * ACTIVITY_FACTORS[activityLevel]
}

export function calcWaistToHeightRatio(waistCm: number, heightCm: number): number {
  return waistCm / heightCm
}

// 用最近两条含体重的测量记录估算每周体重变化百分比(负值 = 减少)
export function calcWeeklyWeightChangePercent(measurements: Measurement[]): number | null {
  const withWeight = measurements
    .filter((m): m is Measurement & { weight: number } => m.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (withWeight.length < 2) return null

  const first = withWeight[withWeight.length - 2]
  const last = withWeight[withWeight.length - 1]
  const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000
  if (days <= 0) return null

  const weeks = days / 7
  const changePercent = ((last.weight - first.weight) / first.weight) * 100
  return changePercent / weeks
}

export function isTargetBelowHealthyBmi(targetWeight: number, heightCm: number): boolean {
  return targetWeight < weightForBmi(heightCm, 18.5)
}

export function isLossRateTooFast(weeklyChangePercent: number | null): boolean {
  return weeklyChangePercent !== null && weeklyChangePercent <= -1
}

// 任何建议热量都不应低于 BMR;供未来的热量建议功能复用
export function applyCalorieFloor(suggestedKcal: number, bmr: number): number {
  return Math.max(suggestedKcal, bmr)
}
