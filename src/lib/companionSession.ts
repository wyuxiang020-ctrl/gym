import { confirmedMissingWeight, setVolume, validCompletedSet } from './strength'
import type { StrengthEntry } from './types'

export type RestClock = { deadline: number | null; remainingMs: number }
export const remainingRest = (clock: RestClock, now: number) => Math.max(0, clock.deadline === null ? clock.remainingMs : clock.deadline - now)
export const startRest = (seconds: number, now: number): RestClock => ({ deadline: now + Math.max(0, Math.min(600, seconds)) * 1000, remainingMs: 0 })
export const pauseRest = (clock: RestClock, now: number): RestClock => ({ deadline: null, remainingMs: remainingRest(clock, now) })
export const resumeRest = (clock: RestClock, now: number): RestClock => ({ deadline: now + remainingRest(clock, now), remainingMs: 0 })
export const extendRest = (clock: RestClock, now: number): RestClock => {
  const remainingMs = Math.min(600000, remainingRest(clock, now) + 30000)
  return clock.deadline === null ? { deadline: null, remainingMs } : { deadline: now + remainingMs, remainingMs: 0 }
}
export function companionSummary(entry: StrengthEntry) {
  const completed = entry.sets.filter(validCompletedSet)
  return {
    completed: completed.length,
    pending: entry.sets.length - completed.length,
    volume: completed.reduce((sum, set) => sum + setVolume(set), 0),
    seconds: completed.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0),
    missingWeight: completed.filter(confirmedMissingWeight).length,
  }
}
