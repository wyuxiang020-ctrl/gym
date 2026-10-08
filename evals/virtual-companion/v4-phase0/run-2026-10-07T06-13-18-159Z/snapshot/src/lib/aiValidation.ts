import type { CardioEntry, FoodItem, StrengthEntry } from './types'
import { CARDIO_TYPE_LABELS } from './met'
import { confirmedMissingWeight, resolvedWeight } from './strength'
import type { StrengthSet } from './types'

export type ParsedStrength = Omit<StrengthEntry, 'id' | 'source' | 'estKcal'>
export type ParsedCardio = Omit<CardioEntry, 'id' | 'source' | 'estKcal' | 'minutes'> & {
  minutes: number | null
}
export type ParsedWorkout = { strength: ParsedStrength[]; cardio: ParsedCardio[] }
export type ConfirmedParsedWorkout = {
  strength: ParsedStrength[]
  cardio: (Omit<ParsedCardio, 'minutes'> & { minutes: number })[]
}
export type WorkoutSaveValidation =
  | { ok: true; value: ConfirmedParsedWorkout }
  | { ok: false; error: string }

const WORKOUT_LIMITS = {
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

const FOOD_RESULT_LIMITS = {
  items: 30,
  nameCharacters: 120,
  grams: 100_000,
  kcal: 100_000,
  macroGrams: 10_000,
} as const

const SUPPORTED_CARDIO_TYPES = new Set<string>(Object.values(CARDIO_TYPE_LABELS))

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown, minimum = 0, maximum = Number.POSITIVE_INFINITY): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function isFiniteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && isFiniteNumber(value, minimum, maximum)
}

function optionalString(value: unknown, maximumLength = Number.POSITIVE_INFINITY): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= maximumLength)
}

function optionalStringArray(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= WORKOUT_LIMITS.uncertainItems &&
      value.every((item) => typeof item === 'string' && item.length <= WORKOUT_LIMITS.uncertainCharacters))
  )
}

function invalidAiResult(): never {
  throw new Error('AI 返回的数据格式不完整,原始输入已保留,请重试或手动记录。')
}

function parseStrength(value: unknown, preserveLocalConfirmation = false): ParsedStrength {
  if (
    !isObject(value) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > WORKOUT_LIMITS.labelCharacters ||
    !Array.isArray(value.sets) ||
    value.sets.length > WORKOUT_LIMITS.setsPerStrength
  ) {
    return invalidAiResult()
  }
  if (!optionalString(value.note, WORKOUT_LIMITS.noteCharacters) || !optionalStringArray(value.uncertain)) {
    return invalidAiResult()
  }
  if (value.intensity !== undefined && !['low', 'mid', 'high'].includes(String(value.intensity))) {
    return invalidAiResult()
  }

  const sets = value.sets.map((set) => {
    if (
      !isObject(set) ||
      !['known', 'bodyweight', 'unknown', 'not_applicable'].includes(String(set.weightState)) ||
      (set.weightState === 'known' ? !isFiniteNumber(set.weight, Number.MIN_VALUE, WORKOUT_LIMITS.weightKg) : set.weight !== null) ||
      typeof set.done !== 'boolean'
    ) {
      return invalidAiResult()
    }

    // The model cannot acknowledge missing facts on the user's behalf.
    const confirmation: Pick<StrengthSet, 'missingWeightConfirmed'> = {}
    if (preserveLocalConfirmation && set.missingWeightConfirmed !== undefined) {
      if (typeof set.missingWeightConfirmed !== 'boolean' ||
        (set.missingWeightConfirmed === true && (set.weightState !== 'unknown' || set.weight !== null))) return invalidAiResult()
      confirmation.missingWeightConfirmed = set.missingWeightConfirmed
    }
    const reps = set.reps === null ? undefined : set.reps
    const durationSeconds = set.durationSeconds === null ? undefined : set.durationSeconds
    if (isFiniteInteger(reps, 1, WORKOUT_LIMITS.reps) && durationSeconds === undefined) {
      return { weight: set.weight as number | null, weightState: set.weightState as StrengthSet['weightState'], reps, done: set.done, ...confirmation }
    }
    if (isFiniteInteger(durationSeconds, 1, WORKOUT_LIMITS.durationSeconds) && reps === undefined) {
      return { weight: set.weight as number | null, weightState: set.weightState as StrengthSet['weightState'], durationSeconds, done: set.done, ...confirmation }
    }
    return invalidAiResult()
  })

  return {
    name: value.name.trim(),
    sets,
    intensity: value.intensity as ParsedStrength['intensity'],
    note: value.note,
    uncertain: value.uncertain,
  }
}

function parseCardio(value: unknown): ParsedCardio {
  if (
    !isObject(value) ||
    typeof value.type !== 'string' ||
    !value.type.trim() ||
    value.type.length > WORKOUT_LIMITS.labelCharacters ||
    !SUPPORTED_CARDIO_TYPES.has(value.type.trim()) ||
    typeof value.done !== 'boolean' ||
    !['low', 'mid', 'high'].includes(String(value.intensity)) ||
    !optionalString(value.note, WORKOUT_LIMITS.noteCharacters) ||
    !optionalStringArray(value.uncertain)
  ) {
    return invalidAiResult()
  }

  const minutes = value.minutes === null ? null : value.minutes
  if (minutes !== null && !isFiniteNumber(minutes, 1, WORKOUT_LIMITS.cardioMinutes)) {
    return invalidAiResult()
  }

  const distance = value.distance === null ? undefined : value.distance
  const avgHr = value.avgHr === null ? undefined : value.avgHr
  if (distance !== undefined && !isFiniteNumber(distance, 0, WORKOUT_LIMITS.distanceKm)) {
    return invalidAiResult()
  }
  if (avgHr !== undefined && !isFiniteNumber(avgHr, 1, WORKOUT_LIMITS.avgHr)) return invalidAiResult()

  return {
    type: value.type.trim(),
    done: value.done,
    minutes,
    distance,
    avgHr,
    intensity: value.intensity as ParsedCardio['intensity'],
    note: value.note,
    uncertain: value.uncertain,
  }
}

function parseFoodItem(value: unknown): FoodItem {
  if (
    !isObject(value) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > FOOD_RESULT_LIMITS.nameCharacters ||
    !isFiniteNumber(value.grams, 0, FOOD_RESULT_LIMITS.grams) ||
    !isFiniteNumber(value.kcal, 0, FOOD_RESULT_LIMITS.kcal) ||
    !isFiniteNumber(value.protein, 0, FOOD_RESULT_LIMITS.macroGrams) ||
    !isFiniteNumber(value.carbs, 0, FOOD_RESULT_LIMITS.macroGrams) ||
    !isFiniteNumber(value.fat, 0, FOOD_RESULT_LIMITS.macroGrams) ||
    typeof value.confidence !== 'string' ||
    !['high', 'mid', 'low'].includes(value.confidence)
  ) {
    return invalidAiResult()
  }

  return {
    name: value.name.trim(),
    grams: value.grams,
    kcal: value.kcal,
    protein: value.protein,
    carbs: value.carbs,
    fat: value.fat,
    confidence: value.confidence as FoodItem['confidence'],
  }
}

function resultObject(body: unknown): JsonObject {
  if (!isObject(body) || !isObject(body.result)) return invalidAiResult()
  return body.result
}

export function parseWorkoutResponse(body: unknown): ParsedWorkout {
  const result = resultObject(body)
  if (!Array.isArray(result.strength) || !Array.isArray(result.cardio)) return invalidAiResult()
  if (
    result.strength.length > WORKOUT_LIMITS.strengthEntries ||
    result.cardio.length > WORKOUT_LIMITS.cardioEntries
  ) {
    return invalidAiResult()
  }
  return {
    strength: result.strength.map((entry) => parseStrength(entry)),
    cardio: result.cardio.map(parseCardio),
  }
}

// Drafts may contain unfinished edits. Model responses and final saves still
// use strict validation; recovering a draft never marks it valid for saving.
export function parseWorkoutDraft(value: unknown): ParsedWorkout {
  if (!isObject(value) || !Array.isArray(value.strength) || !Array.isArray(value.cardio) ||
    value.strength.length > WORKOUT_LIMITS.strengthEntries || value.cardio.length > WORKOUT_LIMITS.cardioEntries) return invalidAiResult()
  const strength = value.strength.map((entry) => {
    if (!isObject(entry) || typeof entry.name !== 'string' || entry.name.length > WORKOUT_LIMITS.noteCharacters) return invalidAiResult()
    return { ...parseStrength({ ...entry, name: '草稿' }, true), name: entry.name }
  })
  const cardio = value.cardio.map((entry) => {
    if (!isObject(entry)) return invalidAiResult()
    for (const key of ['minutes', 'distance', 'avgHr']) {
      if (entry[key] !== null && entry[key] !== undefined && !isFiniteNumber(entry[key], -Number.MAX_VALUE)) return invalidAiResult()
    }
    if (entry.minutes === undefined) return invalidAiResult()
    return {
      ...parseCardio({ ...entry, minutes: null, distance: undefined, avgHr: undefined }),
      minutes: entry.minutes as number | null,
      distance: (entry.distance ?? undefined) as number | undefined,
      avgHr: (entry.avgHr ?? undefined) as number | undefined,
    }
  })
  return { strength, cardio }
}

export function validateWorkoutForSave(value: ParsedWorkout): WorkoutSaveValidation {
  if (value.strength.length === 0 && value.cardio.length === 0) {
    return { ok: false, error: '没有可写入的训练内容。' }
  }
  if (value.strength.length > WORKOUT_LIMITS.strengthEntries) {
    return { ok: false, error: `一次最多写入 ${WORKOUT_LIMITS.strengthEntries} 个力量动作。` }
  }
  if (value.cardio.length > WORKOUT_LIMITS.cardioEntries) {
    return { ok: false, error: `一次最多写入 ${WORKOUT_LIMITS.cardioEntries} 个有氧项目。` }
  }

  for (const [entryIndex, entry] of value.strength.entries()) {
    const label = `第 ${entryIndex + 1} 个力量动作`
    if (!entry.name.trim() || entry.name.length > WORKOUT_LIMITS.labelCharacters) {
      return { ok: false, error: `${label}的名称无效,请修改后再写入。` }
    }
    if (entry.sets.length === 0) {
      return { ok: false, error: `「${entry.name.trim()}」没有可保存的组数,请删除该项或重新解析。` }
    }
    if (entry.sets.length > WORKOUT_LIMITS.setsPerStrength) {
      return { ok: false, error: `「${entry.name.trim()}」一次最多保存 ${WORKOUT_LIMITS.setsPerStrength} 组。` }
    }
    if (entry.intensity !== undefined && !['low', 'mid', 'high'].includes(entry.intensity)) {
      return { ok: false, error: `「${entry.name.trim()}」的强度无效。` }
    }

    for (const [setIndex, set] of entry.sets.entries()) {
      const setLabel = `「${entry.name.trim()}」第 ${setIndex + 1} 组`
      if ((set.missingWeightConfirmed !== undefined && typeof set.missingWeightConfirmed !== 'boolean') ||
        (set.missingWeightConfirmed === true && !confirmedMissingWeight(set))) {
        return { ok: false, error: `${setLabel}的重量缺失确认状态无效，请重新核对重量。` }
      }
      if (!resolvedWeight(set) && !confirmedMissingWeight(set)) {
        return { ok: false, error: `${setLabel}重量尚未确认。请填写数值与单位，选择自重／不适用，或明确确认重量未记录；系统不会用 0 或历史重量代填。` }
      }
      const repsValid = isFiniteInteger(set.reps, 1, WORKOUT_LIMITS.reps) && set.durationSeconds === undefined
      const durationValid = isFiniteInteger(set.durationSeconds, 1, WORKOUT_LIMITS.durationSeconds) && set.reps === undefined
      if (repsValid === durationValid) {
        return { ok: false, error: `${setLabel}必须填写次数或持续秒数,且不能同时填写。` }
      }
      if (set.done !== true) {
        return { ok: false, error: `${setLabel}尚未标记为完成。` }
      }
    }
  }

  for (const [entryIndex, entry] of value.cardio.entries()) {
    const label = `第 ${entryIndex + 1} 个有氧项目`
    if (entry.done !== true) return { ok: false, error: `${label}尚未完成；未来计划不能写入已完成记录。` }
    if (
      !entry.type.trim() ||
      entry.type.length > WORKOUT_LIMITS.labelCharacters ||
      !SUPPORTED_CARDIO_TYPES.has(entry.type.trim())
    ) {
      return { ok: false, error: `${label}的类型无效,请选择列表中的项目。` }
    }
    if (!isFiniteNumber(entry.minutes, 1, WORKOUT_LIMITS.cardioMinutes)) {
      return { ok: false, error: `「${entry.type.trim()}」时长不明确,请填写 1–${WORKOUT_LIMITS.cardioMinutes} 分钟。` }
    }
    if (!['low', 'mid', 'high'].includes(entry.intensity)) {
      return { ok: false, error: `「${entry.type.trim()}」的强度无效。` }
    }
    if (
      entry.distance !== undefined &&
      !isFiniteNumber(entry.distance, 0, WORKOUT_LIMITS.distanceKm)
    ) {
      return { ok: false, error: `「${entry.type.trim()}」的距离必须在 0–${WORKOUT_LIMITS.distanceKm} km 之间。` }
    }
    if (entry.avgHr !== undefined && !isFiniteNumber(entry.avgHr, 1, WORKOUT_LIMITS.avgHr)) {
      return { ok: false, error: `「${entry.type.trim()}」的平均心率必须在 1–${WORKOUT_LIMITS.avgHr} 之间。` }
    }
  }

  return {
    ok: true,
    value: {
      strength: value.strength,
      cardio: value.cardio.map((entry) => ({ ...entry, minutes: entry.minutes as number })),
    },
  }
}

export function parseFoodItemsResponse(body: unknown): FoodItem[] {
  const result = resultObject(body)
  if (!Array.isArray(result.items)) return invalidAiResult()
  if (result.items.length > FOOD_RESULT_LIMITS.items) return invalidAiResult()
  return result.items.map(parseFoodItem)
}
