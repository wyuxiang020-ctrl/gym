import type { PlanDay, Profile } from './types'
import {
  CORE,
  LEGS_COMPOUND,
  LEGS_ISOLATION,
  PULL_COMPOUND,
  PULL_ISOLATION,
  PUSH_COMPOUND,
  PUSH_ISOLATION,
} from './exerciseLibrary'

type ExerciseName = string

function pick(pool: ExerciseName[], offset: number, count: number): ExerciseName[] {
  const result: ExerciseName[] = []
  for (let i = 0; i < count; i++) {
    result.push(pool[(offset + i) % pool.length])
  }
  return result
}

interface GoalConfig {
  sets: number
  repRange: string
  cardio: { minutes: number; note: string; timesPerWeek: number } | null
}

function goalConfig(goal: Profile['goal'], experience: Profile['experience']): GoalConfig {
  const setsForRange = (low: number, high: number) =>
    experience === 'beginner' ? low : high

  switch (goal) {
    case 'bulk':
      return {
        sets: setsForRange(3, 4),
        repRange: '6-12',
        cardio: { minutes: 20, note: '低强度', timesPerWeek: 2 },
      }
    case 'cut':
      return {
        sets: setsForRange(3, 4),
        repRange: '8-15',
        cardio: { minutes: 30, note: '中等强度', timesPerWeek: 3 },
      }
    case 'maintain':
    default:
      return {
        sets: 3,
        repRange: '8-12',
        cardio: { minutes: 25, note: '中等强度', timesPerWeek: 2 },
      }
  }
}

function buildExercises(
  compoundPools: ExerciseName[][],
  isolationPools: ExerciseName[][],
  experience: Profile['experience'],
  sets: number,
  repRange: string,
  offset: number,
): PlanDay['exercises'] {
  const perCompoundGroup = experience === 'beginner' ? 1 : 2
  const exercises: PlanDay['exercises'] = []

  for (const pool of compoundPools) {
    for (const name of pick(pool, offset, perCompoundGroup)) {
      exercises.push({ name, sets, repRange })
    }
  }

  if (experience !== 'beginner') {
    for (const pool of isolationPools) {
      for (const name of pick(pool, offset, 1)) {
        exercises.push({ name, sets, repRange })
      }
    }
  }

  return exercises
}

function withCardio(day: PlanDay, config: GoalConfig, dayIndex: number, totalDays: number): PlanDay {
  if (!config.cardio) return day
  // 按目标频率把有氧分配到前 N 天(N = 每周次数),编辑后完全可调整
  const shouldHaveCardio = dayIndex < Math.min(config.cardio.timesPerWeek, totalDays)
  if (!shouldHaveCardio) return day
  return {
    ...day,
    cardio: { type: '有氧(可自选)', minutes: config.cardio.minutes, note: config.cardio.note },
  }
}

export function generatePlanDays(profile: Profile): PlanDay[] {
  const { trainingDaysPerWeek: days, goal, experience } = profile
  const config = goalConfig(goal, experience)
  const { sets, repRange } = config

  let rawDays: PlanDay[]

  if (days <= 3) {
    // 全身训练
    rawDays = Array.from({ length: days }, (_, i) => {
      const offset = i
      const exercises = buildExercises(
        [LEGS_COMPOUND, PUSH_COMPOUND, PULL_COMPOUND],
        [LEGS_ISOLATION, PUSH_ISOLATION, PULL_ISOLATION],
        experience,
        sets,
        repRange,
        offset,
      )
      exercises.push({ name: pick(CORE, i, 1)[0], sets, repRange })
      return { label: `Day ${i + 1} · 全身`, exercises }
    })
  } else if (days === 4) {
    // 上肢 / 下肢 交替
    rawDays = Array.from({ length: days }, (_, i) => {
      const isUpper = i % 2 === 0
      const offset = Math.floor(i / 2)
      if (isUpper) {
        const exercises = buildExercises(
          [PUSH_COMPOUND, PULL_COMPOUND],
          [PUSH_ISOLATION, PULL_ISOLATION],
          experience,
          sets,
          repRange,
          offset,
        )
        return { label: `Day ${i + 1} · 上肢`, exercises }
      }
      const exercises = buildExercises(
        [LEGS_COMPOUND],
        [LEGS_ISOLATION],
        experience,
        sets,
        repRange,
        offset,
      )
      exercises.push({ name: pick(CORE, offset, 1)[0], sets, repRange })
      return { label: `Day ${i + 1} · 下肢`, exercises }
    })
  } else {
    // 推 / 拉 / 腿
    const splitOrder: Array<'push' | 'pull' | 'legs'> = ['push', 'pull', 'legs']
    rawDays = Array.from({ length: days }, (_, i) => {
      const type = splitOrder[i % 3]
      const offset = Math.floor(i / 3)
      if (type === 'push') {
        const exercises = buildExercises([PUSH_COMPOUND], [PUSH_ISOLATION], experience, sets, repRange, offset)
        return { label: `Day ${i + 1} · 推`, exercises }
      }
      if (type === 'pull') {
        const exercises = buildExercises([PULL_COMPOUND], [PULL_ISOLATION], experience, sets, repRange, offset)
        return { label: `Day ${i + 1} · 拉`, exercises }
      }
      const exercises = buildExercises([LEGS_COMPOUND], [LEGS_ISOLATION], experience, sets, repRange, offset)
      exercises.push({ name: pick(CORE, offset, 1)[0], sets, repRange })
      return { label: `Day ${i + 1} · 腿`, exercises }
    })
  }

  return rawDays.map((day, i) => withCardio(day, config, i, days))
}

export function defaultPlanName(profile: Profile): string {
  const goalLabel = { bulk: '增肌', cut: '减脂', maintain: '维持' }[profile.goal]
  const splitLabel =
    profile.trainingDaysPerWeek <= 3
      ? '全身'
      : profile.trainingDaysPerWeek === 4
        ? '上下肢'
        : '推拉腿'
  return `${goalLabel} · ${splitLabel} ${profile.trainingDaysPerWeek} 天`
}
