import type {
  CardioEntry,
  DayLog,
  FoodItem,
  GymData,
  Meal,
  Measurement,
  Plan,
  PlanDay,
  Profile,
  StrengthEntry,
} from './types'

type JsonObject = Record<string, unknown>
import { migrateStrengthEntry } from './strength'

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(
  value: unknown,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY,
): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isOptionalNumber(
  value: unknown,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY,
): boolean {
  // Older AI responses used JSON null for optional distance/heart-rate fields.
  return value === undefined || value === null || isNumber(value, minimum, maximum)
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isProfile(value: unknown): value is Profile {
  return (
    isObject(value) &&
    typeof value.gender === 'string' &&
    ['male', 'female'].includes(value.gender) &&
    Number.isInteger(value.birthYear) &&
    isNumber(value.birthYear, 1900) &&
    value.birthYear <= new Date().getFullYear() &&
    isNumber(value.height, 1, 300) &&
    typeof value.experience === 'string' &&
    ['beginner', 'intermediate', 'advanced'].includes(value.experience) &&
    typeof value.goal === 'string' &&
    ['cut', 'bulk', 'maintain'].includes(value.goal) &&
    Number.isInteger(value.trainingDaysPerWeek) &&
    isNumber(value.trainingDaysPerWeek, 2) &&
    value.trainingDaysPerWeek <= 6 &&
    typeof value.activityLevel === 'number' &&
    [1, 2, 3, 4, 5].includes(value.activityLevel) &&
    isOptionalNumber(value.targetWeight, 0, 1_000) &&
    isOptionalNumber(value.targetBodyFat, 0, 100) &&
    isOptionalNumber(value.waterTargetMl, 0, 20_000) &&
    isOptionalString(value.targetNote) &&
    (value.checkInMode === undefined ||
      (typeof value.checkInMode === 'string' &&
        ['open', 'workout', 'workout_and_meal'].includes(value.checkInMode)))
  )
}

function isMeasurement(value: unknown): value is Measurement {
  return (
    isObject(value) &&
    isDateString(value.date) &&
    ['weight', 'bodyFat', 'waist', 'chest', 'hip', 'arm', 'thigh'].every((key) =>
      isOptionalNumber(value[key]),
    ) &&
    isOptionalString(value.note)
  )
}

function isPlanDay(value: unknown): value is PlanDay {
  if (
    !isObject(value) ||
    typeof value.label !== 'string' ||
    !value.label.trim() ||
    value.label.length > 100 ||
    !Array.isArray(value.exercises) ||
    value.exercises.length > 100
  ) return false
  const exercisesValid = value.exercises.every(
    (exercise) =>
      isObject(exercise) &&
      typeof exercise.name === 'string' &&
      Boolean(exercise.name.trim()) &&
      exercise.name.length <= 100 &&
      Number.isInteger(exercise.sets) &&
      isNumber(exercise.sets, 1) &&
      exercise.sets <= 20 &&
      typeof exercise.repRange === 'string' &&
      exercise.repRange.length <= 100 &&
      isOptionalString(exercise.note),
  )
  const cardioValid =
    value.cardio === undefined ||
    (isObject(value.cardio) &&
      typeof value.cardio.type === 'string' &&
      Boolean(value.cardio.type.trim()) &&
      value.cardio.type.length <= 100 &&
      isNumber(value.cardio.minutes, 1, 1_440) &&
      isOptionalString(value.cardio.note))
  return exercisesValid && cardioValid
}

function isPlan(value: unknown): value is Plan {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.name === 'string' &&
    Boolean(value.name.trim()) &&
    value.name.length <= 100 &&
    typeof value.isActive === 'boolean' &&
    Array.isArray(value.days) &&
    value.days.length <= 50 &&
    value.days.every(isPlanDay)
  )
}

function isStrengthEntry(value: unknown): value is StrengthEntry {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Boolean(value.name.trim()) &&
    value.name.length <= 100 &&
    Array.isArray(value.sets) &&
    value.sets.length <= 50 &&
    value.sets.every((set) => {
      if (!isObject(set) || typeof set.done !== 'boolean') return false
      if (set.weightState === undefined) {
        if (!isNumber(set.weight, 0, 1_000)) return false
      } else if (set.weightState === 'known') {
        if (!isNumber(set.weight, Number.MIN_VALUE, 1_000)) return false
      } else if (!['bodyweight', 'unknown', 'not_applicable'].includes(String(set.weightState)) || set.weight !== null) return false
      if (set.missingWeightConfirmed !== undefined && typeof set.missingWeightConfirmed !== 'boolean') return false
      if (set.missingWeightConfirmed === true && (set.weightState !== 'unknown' || set.weight !== null)) return false
      if (set.legacyWeight !== undefined && !isNumber(set.legacyWeight, 0, 1_000)) return false
      // reps=0 remains readable for backward compatibility, but current UI cannot create it
      // and check-in/volume logic does not count it as completed work.
      const repsValid = Number.isInteger(set.reps) && isNumber(set.reps, 0, 1_000)
      const durationValid = Number.isInteger(set.durationSeconds) && isNumber(set.durationSeconds, 1, 86_400)
      const repsEmpty = set.reps === undefined
      const durationEmpty = set.durationSeconds === undefined
      return (repsValid && durationEmpty) || (durationValid && repsEmpty)
    }) &&
    (value.intensity === undefined ||
      (typeof value.intensity === 'string' && ['low', 'mid', 'high'].includes(value.intensity))) &&
    isNumber(value.estKcal, 0, 100_000) &&
    typeof value.source === 'string' &&
    ['manual', 'nl', 'mixed'].includes(value.source) &&
    isOptionalString(value.note) &&
    (value.uncertain === undefined ||
      (Array.isArray(value.uncertain) && value.uncertain.every((item) => typeof item === 'string')))
  )
}

function isCardioEntry(value: unknown): value is CardioEntry {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    Boolean(value.type.trim()) &&
    value.type.length <= 100 &&
    isNumber(value.minutes, 1, 1_440) &&
    isOptionalNumber(value.distance, 0, 1_000) &&
    isOptionalNumber(value.avgHr, 1, 250) &&
    typeof value.intensity === 'string' &&
    ['low', 'mid', 'high'].includes(value.intensity) &&
    (value.done === undefined || typeof value.done === 'boolean') &&
    isNumber(value.estKcal, 0, 100_000) &&
    typeof value.source === 'string' &&
    ['manual', 'nl'].includes(value.source) &&
    isOptionalString(value.note) &&
    (value.uncertain === undefined ||
      (Array.isArray(value.uncertain) && value.uncertain.every((item) => typeof item === 'string')))
  )
}

function isFoodItem(value: unknown): value is FoodItem {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    Boolean(value.name.trim()) &&
    value.name.length <= 120 &&
    isNumber(value.grams, 0, 100_000) &&
    isNumber(value.kcal, 0, 100_000) &&
    isNumber(value.protein, 0, 10_000) &&
    isNumber(value.carbs, 0, 10_000) &&
    isNumber(value.fat, 0, 10_000) &&
    typeof value.confidence === 'string' &&
    ['high', 'mid', 'low'].includes(value.confidence)
  )
}

function isMeal(value: unknown): value is Meal {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.slot === 'string' &&
    ['breakfast', 'lunch', 'dinner', 'snack'].includes(value.slot) &&
    Array.isArray(value.items) &&
    value.items.length <= 100 &&
    value.items.every(isFoodItem) &&
    typeof value.confirmed === 'boolean' &&
    isOptionalString(value.rawText) &&
    isOptionalString(value.photoThumb) &&
    isOptionalString(value.note)
  )
}

function isDayLog(value: unknown): value is DayLog {
  return (
    isObject(value) &&
    isDateString(value.date) &&
    typeof value.checkedIn === 'boolean' &&
    Array.isArray(value.strength) &&
    value.strength.length <= 200 &&
    value.strength.every(isStrengthEntry) &&
    Array.isArray(value.cardio) &&
    value.cardio.length <= 100 &&
    value.cardio.every(isCardioEntry) &&
    Array.isArray(value.meals) &&
    value.meals.length <= 100 &&
    value.meals.every(isMeal) &&
    isNumber(value.water, 0, 20_000) &&
    isOptionalString(value.bodyNote) &&
    (value.mood === undefined ||
      (typeof value.mood === 'number' && [0, 1, 2, 3].includes(value.mood)))
  )
}

function invalidImport(section: string): never {
  throw new Error(`备份文件中的 ${section} 数据格式不正确`)
}

export function parseGymData(value: unknown): GymData {
  if (!isObject(value)) return invalidImport('顶层')

  const profile = value.profile === undefined ? null : value.profile
  const measurements = value.measurements === undefined ? [] : value.measurements
  const plans = value.plans === undefined ? [] : value.plans
  const dayLogs = value.dayLogs === undefined ? {} : value.dayLogs
  const exerciseVideos = value.exerciseVideos === undefined ? {} : value.exerciseVideos

  if (profile !== null && !isProfile(profile)) return invalidImport('身体档案')
  if (!Array.isArray(measurements) || measurements.length > 10_000 || !measurements.every(isMeasurement)) {
    return invalidImport('身体测量')
  }
  if (!Array.isArray(plans) || plans.length > 100 || !plans.every(isPlan)) return invalidImport('训练计划')
  if (
    !isObject(dayLogs) ||
    Object.keys(dayLogs).length > 10_000 ||
    !Object.entries(dayLogs).every(([date, log]) => isDateString(date) && isDayLog(log) && log.date === date)
  ) {
    return invalidImport('每日记录')
  }
  if (
    !isObject(exerciseVideos) ||
    Object.keys(exerciseVideos).length > 1_000 ||
    !Object.values(exerciseVideos).every((url) => typeof url === 'string' && url.length <= 2_048)
  ) {
    return invalidImport('动作视频')
  }
  if (value.lastFedDate !== undefined && !isDateString(value.lastFedDate)) return invalidImport('投喂日期')

  return {
    profile,
    measurements,
    plans,
    dayLogs: Object.fromEntries(Object.entries(dayLogs as Record<string, DayLog>).map(([date, log]) => [date, {
      ...log, strength: log.strength.map(migrateStrengthEntry),
    }])),
    exerciseVideos: exerciseVideos as Record<string, string>,
    lastFedDate: value.lastFedDate,
  }
}
