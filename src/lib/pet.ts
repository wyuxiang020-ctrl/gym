import type { DayLog } from './types'
import { dayVolume } from './checkIn'

export interface PetLevel {
  level: number
  name: string
  minVolume: number
}

// 门槛按「kg×次数」的历史累计训练容量估算,大致对应几周到几个月的持续训练
export const PET_LEVELS: PetLevel[] = [
  { level: 0, name: '蛋', minVolume: 0 },
  { level: 1, name: '幼兽', minVolume: 1000 },
  { level: 2, name: '少年', minVolume: 5000 },
  { level: 3, name: '强壮', minVolume: 20000 },
  { level: 4, name: '巨兽', minVolume: 50000 },
]

export function totalLifetimeVolume(dayLogs: Record<string, DayLog>): number {
  return Object.values(dayLogs).reduce((sum, log) => sum + dayVolume(log), 0)
}

export function currentPetLevel(totalVolume: number): PetLevel {
  let current = PET_LEVELS[0]
  for (const lvl of PET_LEVELS) {
    if (totalVolume >= lvl.minVolume) current = lvl
  }
  return current
}

export function nextPetLevel(totalVolume: number): PetLevel | null {
  const idx = PET_LEVELS.findIndex((l) => l.level === currentPetLevel(totalVolume).level)
  return PET_LEVELS[idx + 1] ?? null
}
