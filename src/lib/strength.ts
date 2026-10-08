import type { StrengthEntry, StrengthSet } from './types'

export const WEIGHT_LABELS = { known: '已知重量', bodyweight: '自重', unknown: '未知重量', not_applicable: '不适用' } as const

export function resolvedWeight(set: StrengthSet): boolean {
  return set.weightState === 'known'
    ? typeof set.weight === 'number' && Number.isFinite(set.weight) && set.weight > 0 && set.weight <= 1000
    : (set.weightState === 'bodyweight' || set.weightState === 'not_applicable') && set.weight === null
}

export function confirmedMissingWeight(set: StrengthSet): boolean {
  return set.weightState === 'unknown' && set.weight === null && set.missingWeightConfirmed === true
}

export function validCompletedSet(set: StrengthSet): boolean {
  if (set.missingWeightConfirmed !== undefined && typeof set.missingWeightConfirmed !== 'boolean') return false
  if (set.missingWeightConfirmed === true && !confirmedMissingWeight(set)) return false
  const reps = Number.isInteger(set.reps) && (set.reps ?? 0) > 0 && (set.reps ?? 0) <= 1000 && set.durationSeconds === undefined
  const seconds = Number.isInteger(set.durationSeconds) && (set.durationSeconds ?? 0) > 0 && (set.durationSeconds ?? 0) <= 86_400 && set.reps === undefined
  return set.done === true && (resolvedWeight(set) || confirmedMissingWeight(set)) && (reps || seconds)
}

// An acknowledged missing load is a completed fact, not an input to the existing calorie estimate.
export function validEstimatedSet(set: StrengthSet): boolean {
  return validCompletedSet(set) && resolvedWeight(set)
}

export function setVolume(set: StrengthSet): number {
  return validCompletedSet(set) && set.weightState === 'known' ? (set.weight ?? 0) * (set.reps ?? 0) : 0
}

// Read migration never rewrites the original storage. Ambiguous old zeroes require user review.
export function migrateStrengthEntry(entry: StrengthEntry): StrengthEntry {
  let changed = false
  const ambiguous = /(?:重量|负重|单位).{0,12}(?:未知|不明|未提供|缺|忘|未说明)|(?:未知|不明|未提供|缺|忘).{0,12}(?:重量|负重|单位)/.test([entry.note, ...(entry.uncertain ?? [])].join('；'))
  const sets = entry.sets.map((set): StrengthSet => {
    if (set.weightState) return set
    changed = true
    return typeof set.weight === 'number' && set.weight > 0 && !ambiguous
      ? { ...set, weightState: 'known' }
      : { ...set, weight: null, weightState: 'unknown', legacyWeight: set.weight ?? undefined }
  })
  if (!changed) return sets.some(validEstimatedSet) ? entry : { ...entry, estKcal: 0 }
  const oldCount = entry.sets.filter((set) => set.done).length
  const validCount = sets.filter(validEstimatedSet).length
  return { ...entry, sets, estKcal: oldCount ? Math.round(entry.estKcal * validCount / oldCount) : 0 }
}

export function applyFirstWeight(sets: StrengthSet[]): StrengthSet[] {
  const first = sets[0]
  if (!first || !resolvedWeight(first)) throw new Error('请先确认第一组的重量状态。')
  return sets.map((set) => ({ ...set, weight: first.weight, weightState: first.weightState, missingWeightConfirmed: undefined, legacyWeight: undefined }))
}
