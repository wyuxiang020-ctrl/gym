type JsonObject = Record<string, unknown>

export const WORKOUT_RESULT_LIMITS = {
  strengthEntries: 30,
  cardioEntries: 10,
  setsPerStrength: 50,
  labelCharacters: 100,
  weightKg: 1_000,
  reps: 1_000,
  durationSeconds: 86_400,
  cardioMinutes: 1_440,
  distanceKm: 1_000,
  avgHr: 250,
  noteCharacters: 2_000,
  uncertainItems: 20,
  uncertainCharacters: 300,
} as const

export const WORKOUT_CARDIO_TYPES = ['快走', '跑步', '单车', '椭圆机', '游泳', '跳绳', '划船机'] as const
const SUPPORTED_CARDIO_TYPES = new Set<string>(WORKOUT_CARDIO_TYPES)

export const FOOD_RESULT_LIMITS = {
  items: 30,
  nameCharacters: 120,
  grams: 100_000,
  kcal: 100_000,
  macroGrams: 10_000,
} as const

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: JsonObject, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value)
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  )
}

function isFiniteNumber(value: unknown, minimum = 0, maximum = Number.POSITIVE_INFINITY): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isFiniteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && isFiniteNumber(value, minimum, maximum)
}

function validFoodItem(value: unknown): boolean {
  return (
    isObject(value) &&
    hasExactKeys(value, ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence']) &&
    typeof value.name === 'string' &&
    Boolean(value.name.trim()) &&
    value.name.length <= FOOD_RESULT_LIMITS.nameCharacters &&
    isFiniteNumber(value.grams, 0, FOOD_RESULT_LIMITS.grams) &&
    isFiniteNumber(value.kcal, 0, FOOD_RESULT_LIMITS.kcal) &&
    isFiniteNumber(value.protein, 0, FOOD_RESULT_LIMITS.macroGrams) &&
    isFiniteNumber(value.carbs, 0, FOOD_RESULT_LIMITS.macroGrams) &&
    isFiniteNumber(value.fat, 0, FOOD_RESULT_LIMITS.macroGrams) &&
    typeof value.confidence === 'string' &&
    ['high', 'mid', 'low'].includes(value.confidence)
  )
}

function validStrength(value: unknown): boolean {
  return (
    isObject(value) &&
    hasExactKeys(value, ['name', 'sets', 'note', 'uncertain']) &&
    typeof value.name === 'string' &&
    Boolean(value.name.trim()) &&
    value.name.length <= WORKOUT_RESULT_LIMITS.labelCharacters &&
    Array.isArray(value.sets) &&
    value.sets.length <= WORKOUT_RESULT_LIMITS.setsPerStrength &&
    value.sets.every((set) => {
      if (
        !isObject(set) ||
        !hasExactKeys(set, ['weight', 'weightState', 'reps', 'durationSeconds', 'done']) ||
        !['known', 'bodyweight', 'unknown', 'not_applicable'].includes(String(set.weightState)) ||
        (set.weightState === 'known' ? !isFiniteNumber(set.weight, Number.MIN_VALUE, WORKOUT_RESULT_LIMITS.weightKg) : set.weight !== null) ||
        typeof set.done !== 'boolean'
      ) {
        return false
      }
      const hasReps = isFiniteInteger(set.reps, 1, WORKOUT_RESULT_LIMITS.reps)
      const hasDuration = isFiniteInteger(
        set.durationSeconds,
        1,
        WORKOUT_RESULT_LIMITS.durationSeconds,
      )
      const repsEmpty = set.reps === null
      const durationEmpty = set.durationSeconds === null
      return (hasReps && durationEmpty) || (hasDuration && repsEmpty)
    }) &&
    typeof value.note === 'string' &&
    value.note.length <= WORKOUT_RESULT_LIMITS.noteCharacters &&
    Array.isArray(value.uncertain) &&
    value.uncertain.length <= WORKOUT_RESULT_LIMITS.uncertainItems &&
    value.uncertain.every(
      (item) =>
        typeof item === 'string' &&
        item.length <= WORKOUT_RESULT_LIMITS.uncertainCharacters,
    )
  )
}

function validCardio(value: unknown): boolean {
  return (
    isObject(value) &&
    hasExactKeys(value, [
      'type',
      'done',
      'minutes',
      'distance',
      'avgHr',
      'intensity',
      'note',
      'uncertain',
    ]) &&
    typeof value.type === 'string' &&
    typeof value.done === 'boolean' &&
    Boolean(value.type.trim()) &&
    value.type.length <= WORKOUT_RESULT_LIMITS.labelCharacters &&
    SUPPORTED_CARDIO_TYPES.has(value.type.trim()) &&
    (value.minutes === null ||
      isFiniteNumber(value.minutes, 1, WORKOUT_RESULT_LIMITS.cardioMinutes)) &&
    (value.distance === null ||
      isFiniteNumber(value.distance, 0, WORKOUT_RESULT_LIMITS.distanceKm)) &&
    (value.avgHr === null ||
      isFiniteNumber(value.avgHr, 1, WORKOUT_RESULT_LIMITS.avgHr)) &&
    ['low', 'mid', 'high'].includes(String(value.intensity)) &&
    typeof value.note === 'string' &&
    value.note.length <= WORKOUT_RESULT_LIMITS.noteCharacters &&
    Array.isArray(value.uncertain) &&
    value.uncertain.length <= WORKOUT_RESULT_LIMITS.uncertainItems &&
    value.uncertain.every(
      (item) =>
        typeof item === 'string' &&
        item.length <= WORKOUT_RESULT_LIMITS.uncertainCharacters,
    )
  )
}

function invalidResult(value: unknown): never {
  const error = new Error('AI returned JSON with an invalid data structure') as Error & { rawText?: string }
  error.rawText = JSON.stringify(value)
  throw error
}

export function validateWorkoutResult(value: unknown): unknown {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ['strength', 'cardio']) ||
    !Array.isArray(value.strength) ||
    value.strength.length > WORKOUT_RESULT_LIMITS.strengthEntries ||
    !value.strength.every(validStrength) ||
    !Array.isArray(value.cardio) ||
    value.cardio.length > WORKOUT_RESULT_LIMITS.cardioEntries ||
    !value.cardio.every(validCardio)
  ) {
    return invalidResult(value)
  }
  return value
}

export function validateFoodResult(value: unknown): unknown {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ['items']) ||
    !Array.isArray(value.items) ||
    value.items.length > FOOD_RESULT_LIMITS.items ||
    !value.items.every(validFoodItem)
  ) {
    return invalidResult(value)
  }
  return value
}
