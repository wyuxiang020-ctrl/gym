import { useState } from 'react'
import * as store from '../../lib/store'
import { calcCardioKcal, calcStrengthKcal, type CardioActivity } from '../../lib/met'
import type { CardioEntry, DayLog, Plan, PlanDay, StrengthEntry } from '../../lib/types'
import { StrengthLogger } from './StrengthLogger'
import { CardioLogger } from './CardioLogger'
import { NLWorkoutInput } from './NLWorkoutInput'

// 有氧类型中文标签 -> met.ts 的 key,用于换算强度对应的 kcal
const LABEL_TO_ACTIVITY: Record<string, CardioActivity> = {
  快走: 'walk',
  跑步: 'run',
  单车: 'cycling',
  椭圆机: 'elliptical',
  游泳: 'swimming',
  跳绳: 'jumpRope',
  划船机: 'rowing',
}

function parseRepsFromRange(repRange: string): number {
  const match = repRange.match(/\d+/)
  return match ? Number(match[0]) : 8
}

export function WorkoutSection({
  date,
  weightKg,
  plans,
}: {
  date: string
  weightKg: number | null
  plans: Plan[]
}) {
  const [dayLog, setDayLog] = useState<DayLog>(() => store.getDayLog(date))
  const activePlan = plans.find((p) => p.isActive) ?? null

  function refresh() {
    setDayLog(store.getDayLog(date))
  }

  function addExercise(name: string) {
    store.addStrengthEntry(date, {
      name,
      sets: [],
      estKcal: 0,
      source: 'manual',
    })
    refresh()
  }

  function importPlanDay(day: PlanDay) {
    for (const ex of day.exercises) {
      const last = store.getLastStrengthEntry(ex.name, date)
      const lastSet = last?.sets[last.sets.length - 1]
      const weight = lastSet?.weight ?? 20
      const reps = parseRepsFromRange(ex.repRange)
      const sets = Array.from({ length: Math.max(1, ex.sets) }, () => ({ weight, reps, done: false }))
      const estKcal = weightKg ? calcStrengthKcal(sets.length, weightKg, 'mid') : 0
      store.addStrengthEntry(date, { name: ex.name, sets, estKcal, source: 'manual' })
    }
    refresh()
  }

  function addSet(entryId: string) {
    const entry = dayLog.strength.find((s) => s.id === entryId)
    if (!entry) return
    const last = entry.sets[entry.sets.length - 1]
    const newSets = [...entry.sets, last ? { ...last, done: false } : { weight: 20, reps: 8, done: false }]
    store.updateStrengthEntry(date, entryId, {
      sets: newSets,
      estKcal: weightKg ? calcStrengthKcal(newSets.length, weightKg, entry.intensity ?? 'mid') : entry.estKcal,
    })
    refresh()
  }

  function updateSet(entryId: string, setIndex: number, patch: Partial<StrengthEntry['sets'][number]>) {
    const entry = dayLog.strength.find((s) => s.id === entryId)
    if (!entry) return
    const newSets = entry.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s))
    store.updateStrengthEntry(date, entryId, {
      sets: newSets,
      estKcal: weightKg ? calcStrengthKcal(newSets.length, weightKg, entry.intensity ?? 'mid') : entry.estKcal,
    })
    refresh()
  }

  function removeSet(entryId: string, setIndex: number) {
    const entry = dayLog.strength.find((s) => s.id === entryId)
    if (!entry) return
    const newSets = entry.sets.filter((_, i) => i !== setIndex)
    store.updateStrengthEntry(date, entryId, {
      sets: newSets,
      estKcal: weightKg ? calcStrengthKcal(newSets.length, weightKg, entry.intensity ?? 'mid') : entry.estKcal,
    })
    refresh()
  }

  function removeExercise(entryId: string) {
    store.deleteStrengthEntry(date, entryId)
    refresh()
  }

  function addCardio(entry: Omit<CardioEntry, 'id' | 'estKcal' | 'source'>) {
    const activity = LABEL_TO_ACTIVITY[entry.type] ?? 'walk'
    const estKcal = weightKg ? calcCardioKcal(activity, entry.intensity, weightKg, entry.minutes) : 0
    store.addCardioEntry(date, { ...entry, estKcal, source: 'manual' })
    refresh()
  }

  function removeCardio(id: string) {
    store.deleteCardioEntry(date, id)
    refresh()
  }

  // 自然语言解析结果里,同名动作直接并入已有条目(比如从计划导入后又用语音补充这个动作做了几组)
  function applyParsedWorkout(parsed: {
    strength: Omit<StrengthEntry, 'id' | 'source' | 'estKcal'>[]
    cardio: Omit<CardioEntry, 'id' | 'source' | 'estKcal'>[]
  }) {
    for (const s of parsed.strength) {
      const existing = dayLog.strength.find((e) => e.name.trim() === s.name.trim())
      if (existing) {
        const mergedSets = [...existing.sets, ...s.sets]
        const estKcal = weightKg
          ? calcStrengthKcal(mergedSets.length, weightKg, existing.intensity ?? 'mid')
          : existing.estKcal
        store.updateStrengthEntry(date, existing.id, {
          sets: mergedSets,
          estKcal,
          note: s.note ?? existing.note,
          uncertain: s.uncertain ?? existing.uncertain,
        })
      } else {
        const estKcal = weightKg ? calcStrengthKcal(s.sets.length, weightKg, s.intensity ?? 'mid') : 0
        store.addStrengthEntry(date, { ...s, estKcal, source: 'nl' })
      }
    }
    for (const c of parsed.cardio) {
      const activity = LABEL_TO_ACTIVITY[c.type] ?? 'walk'
      const estKcal = weightKg ? calcCardioKcal(activity, c.intensity, weightKg, c.minutes) : 0
      store.addCardioEntry(date, { ...c, estKcal, source: 'nl' })
    }
    refresh()
  }

  return (
    <div className="space-y-6">
      {activePlan && (
        <div className="space-y-2 rounded-lg border border-neutral-300 bg-card p-3">
          <p className="text-sm font-medium text-neutral-900">从计划导入今天的动作</p>
          <p className="text-xs text-neutral-500">当前计划:{activePlan.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {activePlan.days.map((day, i) => (
              <button
                key={i}
                onClick={() => importPlanDay(day)}
                className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm text-neutral-800 active:bg-neutral-100"
              >
                {day.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-400">导入后每组会预填组数和重量,勾选「完成」记录就行</p>
        </div>
      )}

      <NLWorkoutInput onConfirm={applyParsedWorkout} />

      <div>
        <h3 className="mb-3 text-sm font-medium text-neutral-400">力量训练</h3>
        <StrengthLogger
          date={date}
          entries={dayLog.strength}
          onAddExercise={addExercise}
          onAddSet={addSet}
          onUpdateSet={updateSet}
          onRemoveSet={removeSet}
          onRemoveEntry={removeExercise}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-neutral-400">有氧训练</h3>
        <CardioLogger entries={dayLog.cardio} weightKg={weightKg} onAdd={addCardio} onRemove={removeCardio} />
      </div>

      {!weightKg && (
        <p className="text-xs text-neutral-600">添加一条包含体重的测量记录后,这里的热量才能自动估算。</p>
      )}
    </div>
  )
}
