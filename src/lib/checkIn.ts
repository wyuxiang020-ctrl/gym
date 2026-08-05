import type { DayLog, Profile } from './types'
import { toDateStr } from './date'

export type CheckInMode = NonNullable<Profile['checkInMode']>

export function checkInEligible(dayLog: DayLog, mode: CheckInMode): boolean {
  const hasWorkout = dayLog.strength.length > 0 || dayLog.cardio.length > 0
  if (mode === 'open') return true
  if (mode === 'workout') return hasWorkout
  return hasWorkout && dayLog.meals.length > 0 // workout_and_meal
}

// 从今天往前数连续打卡天数,断了就是 0(不做惩罚性文案,只是数字归零)
export function calcStreak(dayLogs: Record<string, DayLog>, todayDate: string): number {
  let streak = 0
  const [y, m, d] = todayDate.split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  for (;;) {
    const key = toDateStr(cursor)
    const log = dayLogs[key]
    if (log?.checkedIn) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

// 当天力量训练容量(Σ 重量×次数),用于月历热力图深浅
export function dayVolume(dayLog: DayLog | undefined): number {
  if (!dayLog) return 0
  return dayLog.strength.reduce(
    (sum, entry) => sum + entry.sets.reduce((s, set) => s + set.weight * set.reps, 0),
    0,
  )
}

export function hasAnyRecord(dayLog: DayLog | undefined): boolean {
  if (!dayLog) return false
  return (
    dayLog.checkedIn ||
    dayLog.strength.length > 0 ||
    dayLog.cardio.length > 0 ||
    dayLog.meals.length > 0 ||
    dayLog.water > 0
  )
}
