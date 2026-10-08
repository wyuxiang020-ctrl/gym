import { lazy, Suspense, useState } from 'react'
import * as store from '../../lib/store'
import type { ConfirmedParsedWorkout } from '../../lib/aiValidation'
import { validateWorkoutForSave } from '../../lib/aiValidation'
import { validCompletedSet, validEstimatedSet } from '../../lib/strength'
import { hasCompletedWorkout } from '../../lib/checkIn'
import { calcCardioKcal, calcStrengthKcal, type CardioActivity } from '../../lib/met'
import type { CardioEntry, DayLog, Plan, PlanDay, StrengthEntry } from '../../lib/types'
import { useToast } from '../../lib/toast'
import { quoteForDate } from '../../lib/motivationalQuotes'
import { StrengthLogger } from './StrengthLogger'
import { CardioLogger } from './CardioLogger'
import { NLWorkoutInput } from './NLWorkoutInput'
import type { CompletionEvent } from '../../companion/WorkoutCompanion'

const EquipmentScanner = lazy(() => import('../../equipment/EquipmentScanner'))
const WorkoutCompanion = lazy(() => import('../../companion/WorkoutCompanion'))

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

const DEFAULT_TIMED_EXERCISES = new Set(['平板支撑'])

function parseRepsFromRange(repRange: string): number | null {
  const primaryTarget = repRange.trim().split(/[，,；;]/, 1)[0].trim()
  const match = primaryTarget.match(/^(?:每\s*组\s*)?(\d+)(?:\s*[-~至到]\s*\d+)?\s*(?:次)?$/)
  return match ? Number(match[1]) : null
}

function parseDurationSecondsFromRange(repRange: string): number | null | undefined {
  const value = repRange.trim()
  const match = value.match(
    /^(?:每\s*(?:组|次)\s*)?(\d+(?:\.\d+)?)(?:\s*[-~至到]\s*\d+(?:\.\d+)?)?\s*(秒|分钟)(?:\s*\/\s*(?:组|次))?$/,
  )
  if (!match && /次/.test(value)) return undefined
  if (!match && !/秒|分钟/.test(value)) return undefined
  if (!match) return null
  const seconds = Number(match[1]) * (match[2] === '分钟' ? 60 : 1)
  const rounded = Math.round(seconds)
  return Number.isFinite(rounded) && rounded >= 1 ? rounded : null
}

function estimatedSetCount(sets: StrengthEntry['sets']): number {
  return sets.filter(validEstimatedSet).length
}

function planCardioIntensity(note?: string): CardioEntry['intensity'] {
  if (note?.includes('高')) return 'high'
  if (note?.includes('低')) return 'low'
  return 'mid'
}

function samePlannedCardio(entry: CardioEntry, planned: NonNullable<PlanDay['cardio']>): boolean {
  const marker = `计划来源:${planned.type} ${planned.minutes}分钟`
  return (
    (entry.type.trim().toLowerCase() === planned.type.trim().toLowerCase() && entry.minutes === planned.minutes) ||
    entry.note?.includes(marker) === true
  )
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
  const [pendingImport, setPendingImport] = useState<PlanDay | null>(null)
  const [pendingParsed, setPendingParsed] = useState<ConfirmedParsedWorkout | null>(null)
  const [parsedResetToken, setParsedResetToken] = useState(0)
  const [equipmentOpen, setEquipmentOpen] = useState(new URLSearchParams(window.location.search).get('equipment-training') === '1')
  const [companionOpen, setCompanionOpen] = useState(new URLSearchParams(window.location.search).get('training-companion') === '1')
  const [completion, setCompletion] = useState<CompletionEvent | null>(null)
  const [companionLaunch, setCompanionLaunch] = useState<{ entryId: string; sequence: number } | null>(null)
  const activePlan = plans.find((p) => p.isActive) ?? null
  const { showToast } = useToast()

  const allWorkoutDone =
    hasCompletedWorkout(dayLog) &&
    dayLog.strength.every(
      (entry) =>
        entry.sets.length > 0 &&
        entry.sets.every(validCompletedSet),
    ) &&
    dayLog.cardio.every((entry) => entry.done !== false)

  function refresh() {
    setDayLog(store.getDayLog(date))
  }

  function safeEdit(action: () => void) {
    try { action(); return true } catch (error) { showToast(error instanceof Error ? error.message : '保存失败，请保留原始记录后重试。'); return false }
  }

  function saveWholeDay(nextDayLog: DayLog): boolean {
    try {
      store.replaceDayLog(date, nextDayLog)
      refresh()
      return true
    } catch (error) {
      showToast(error instanceof Error ? error.message : '写入失败，请检查记录后重试。')
      return false
    }
  }

  function addExercise(name: string) {
    if (store.getDayLog(date).strength.length >= 200) {
      showToast('今天最多记录 200 个力量动作')
      return
    }
    store.addStrengthEntry(date, {
      name,
      sets: [],
      estKcal: 0,
      source: 'manual',
    })
    refresh()
    showToast(`已添加「${name}」`)
  }

  function performPlanImport(day: PlanDay, includeDuplicates: boolean) {
    const dayLog = store.getDayLog(date)
    const existingNames = new Set(dayLog.strength.map((entry) => entry.name.trim().toLowerCase()))
    const exercises = includeDuplicates
      ? day.exercises
      : day.exercises.filter((exercise) => !existingNames.has(exercise.name.trim().toLowerCase()))

    const importedStrength = exercises.map((ex): StrengthEntry => {
      const last = store.getLastStrengthEntry(ex.name, date)
      const lastSet = last?.sets.findLast(validCompletedSet)
      const durationSeconds = parseDurationSecondsFromRange(ex.repRange)
      const reps = durationSeconds === undefined ? parseRepsFromRange(ex.repRange) : null
      // Historical weights are suggestions, not confirmation of today's actual load.
      const weight = null
      const weightState = 'unknown' as const
      const setCount = Math.min(20, Math.max(1, ex.sets))
      const sets: StrengthEntry['sets'] =
        durationSeconds === null || (durationSeconds === undefined && reps === null)
          ? []
          : Array.from({ length: setCount }, () =>
              durationSeconds !== undefined
                ? { weight, weightState, durationSeconds, done: false }
                : { weight, weightState, reps: reps as number, done: false },
            )
      return {
        id: crypto.randomUUID(),
        name: ex.name,
        sets,
        estKcal: 0,
        source: 'manual',
        note:
          [
            durationSeconds === null
              ? `目标时长无法读取:${ex.repRange}`
              : durationSeconds !== undefined
                ? `目标时长:${ex.repRange}`
                : reps === null
                  ? `目标次数无法读取:${ex.repRange}`
                  : undefined,
            ex.note,
            lastSet ? `上次重量状态:${lastSet.weightState}${lastSet.weight === null ? '' : ` ${lastSet.weight}kg`}；本次仍需确认` : '本次重量待确认',
          ]
            .filter(Boolean)
            .join('；') || undefined,
      }
    })
    const shouldImportCardio = Boolean(
      day.cardio &&
      (includeDuplicates || !dayLog.cardio.some((entry) => samePlannedCardio(entry, day.cardio!))),
    )
    const importedCardio: CardioEntry[] =
      day.cardio && shouldImportCardio
        ? [
            {
              id: crypto.randomUUID(),
              type: day.cardio.type,
              minutes: day.cardio.minutes,
              intensity: planCardioIntensity(day.cardio.note),
              done: false,
              estKcal: 0,
              source: 'manual',
              note: [
                `计划来源:${day.cardio.type} ${day.cardio.minutes}分钟`,
                day.cardio.note,
              ]
                .filter(Boolean)
                .join('；'),
            },
          ]
        : []
    const importedCount = importedStrength.length + importedCardio.length
    if (dayLog.strength.length + importedStrength.length > 200 || dayLog.cardio.length + importedCardio.length > 100) {
      showToast('今天的训练记录已达到安全上限，请先整理现有记录。')
      return
    }
    if (
      importedCount > 0 &&
      !saveWholeDay({
        ...dayLog,
        strength: [...dayLog.strength, ...importedStrength],
        cardio: [...dayLog.cardio, ...importedCardio],
      })
    ) {
      return
    }
    setPendingImport(null)
    showToast(
      importedCount > 0
        ? `已导入「${day.label}」共 ${importedCount} 项训练`
        : '今天已包含该训练日的全部内容，未重复导入',
    )
  }

  function requestPlanImport(day: PlanDay) {
    const existingNames = new Set(dayLog.strength.map((entry) => entry.name.trim().toLowerCase()))
    const hasConflict =
      day.exercises.some((exercise) => existingNames.has(exercise.name.trim().toLowerCase())) ||
      Boolean(day.cardio && dayLog.cardio.some((entry) => samePlannedCardio(entry, day.cardio!)))
    if (hasConflict) {
      setPendingImport(day)
      return
    }
    performPlanImport(day, true)
  }

  function addSet(entryId: string) {
    const entry = dayLog.strength.find((s) => s.id === entryId)
    if (!entry) return
    if (entry.sets.length >= 50) {
      showToast('每个力量动作最多记录 50 组')
      return
    }
    const last = entry.sets[entry.sets.length - 1]
    const defaultSet = DEFAULT_TIMED_EXERCISES.has(entry.name.trim())
      ? { weight: null, weightState: 'unknown' as const, durationSeconds: 30, done: false }
      : { weight: null, weightState: 'unknown' as const, reps: 8, done: false }
    const newSets = [...entry.sets, last ? { ...last, done: false, missingWeightConfirmed: undefined } : defaultSet]
    store.updateStrengthEntry(date, entryId, {
      sets: newSets,
      estKcal: weightKg
        ? calcStrengthKcal(estimatedSetCount(newSets), weightKg, entry.intensity ?? 'mid')
        : entry.estKcal,
    })
    refresh()
  }

  function updateSet(entryId: string, setIndex: number, patch: Partial<StrengthEntry['sets'][number]>) {
    const entry = dayLog.strength.find((s) => s.id === entryId)
    if (!entry) return
    const newSets = entry.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s))
    store.updateStrengthEntry(date, entryId, {
      sets: newSets,
      estKcal: weightKg
        ? calcStrengthKcal(estimatedSetCount(newSets), weightKg, entry.intensity ?? 'mid')
        : entry.estKcal,
    })
    refresh()
    if (patch.done === true && entry.sets[setIndex] && !validCompletedSet(entry.sets[setIndex]) && validCompletedSet(newSets[setIndex])) {
      setCompletion(previous => ({ sequence: (previous?.sequence ?? 0) + 1, entryId }))
    }
  }

  function removeSet(entryId: string, setIndex: number) {
    const entry = dayLog.strength.find((s) => s.id === entryId)
    if (!entry) return
    const newSets = entry.sets.filter((_, i) => i !== setIndex)
    store.updateStrengthEntry(date, entryId, {
      sets: newSets,
      estKcal: weightKg
        ? calcStrengthKcal(estimatedSetCount(newSets), weightKg, entry.intensity ?? 'mid')
        : entry.estKcal,
    })
    refresh()
  }

  function removeExercise(entryId: string) {
    store.deleteStrengthEntry(date, entryId)
    refresh()
  }

  function clearStrengthNotice(entryId: string) {
    store.updateStrengthEntry(date, entryId, { uncertain: [], note: undefined })
    refresh()
  }

  function addCardio(entry: Omit<CardioEntry, 'id' | 'estKcal' | 'source'>) {
    if (dayLog.cardio.length >= 100) {
      showToast('今天最多记录 100 个有氧项目')
      return
    }
    const activity = LABEL_TO_ACTIVITY[entry.type] ?? 'walk'
    const estKcal = weightKg ? calcCardioKcal(activity, entry.intensity, weightKg, entry.minutes) : 0
    store.addCardioEntry(date, { ...entry, done: true, estKcal, source: 'manual' })
    refresh()
  }

  function updateCardio(id: string, patch: Partial<Omit<CardioEntry, 'id'>>) {
    const entry = dayLog.cardio.find((item) => item.id === id)
    if (!entry) return
    const updated = { ...entry, ...patch }
    const activity = LABEL_TO_ACTIVITY[updated.type]
    const estKcal =
      updated.done !== false && activity && weightKg
        ? calcCardioKcal(activity, updated.intensity, weightKg, updated.minutes)
        : 0
    store.updateCardioEntry(date, id, { ...patch, estKcal })
    refresh()
  }

  function removeCardio(id: string) {
    store.deleteCardioEntry(date, id)
    refresh()
  }

  function clearCardioNotice(id: string) {
    store.updateCardioEntry(date, id, { uncertain: [], note: undefined })
    refresh()
  }

  function persistParsedWorkout(parsed: ConfirmedParsedWorkout, conflictMode: 'append' | 'replace') {
    const validation = validateWorkoutForSave(parsed)
    if (!validation.ok) { showToast(validation.error); return }
    const dayLog = store.getDayLog(date)
    const workingStrength = dayLog.strength.map((entry) => ({ ...entry, sets: [...entry.sets] }))
    const workingCardio = [...dayLog.cardio]
    const parsedStrength = parsed.strength.reduce<ConfirmedParsedWorkout['strength']>((entries, item) => {
      const existing = entries.find(
        (entry) => entry.name.trim().toLowerCase() === item.name.trim().toLowerCase(),
      )
      if (!existing) {
        entries.push({ ...item, sets: [...item.sets] })
        return entries
      }
      existing.sets = [...existing.sets, ...item.sets]
      existing.note = [existing.note, item.note].filter(Boolean).join('；') || undefined
      existing.uncertain = [...new Set([...(existing.uncertain ?? []), ...(item.uncertain ?? [])])]
      return entries
    }, [])

    if (conflictMode === 'replace') {
      const names = new Set(parsedStrength.map((s) => s.name.trim().toLowerCase()))
      for (let i = workingStrength.length - 1; i >= 0; i--) if (names.has(workingStrength[i].name.trim().toLowerCase())) workingStrength.splice(i, 1)
      const types = new Set(parsed.cardio.map((c) => c.type))
      for (let i = workingCardio.length - 1; i >= 0; i--) if (types.has(workingCardio[i].type)) workingCardio.splice(i, 1)
    }
    for (const s of parsedStrength) {
      const normalizedName = s.name.trim().toLowerCase()
      const existing = workingStrength.find((entry) => entry.name.trim().toLowerCase() === normalizedName)
      if (existing) {
        const nextSets = conflictMode === 'replace' ? [...s.sets] : [...existing.sets, ...s.sets]
        const estKcal = weightKg
          ? calcStrengthKcal(estimatedSetCount(nextSets), weightKg, s.intensity ?? existing.intensity ?? 'mid')
          : existing.estKcal
        existing.sets = nextSets
        existing.estKcal = estKcal
        existing.intensity = s.intensity ?? existing.intensity
        existing.note = s.note ?? existing.note
        existing.uncertain = s.uncertain ?? existing.uncertain
        existing.source =
          conflictMode === 'replace'
            ? 'nl'
            : existing.source === 'manual'
              ? 'mixed'
              : existing.source
      } else {
        const estKcal = weightKg
          ? calcStrengthKcal(estimatedSetCount(s.sets), weightKg, s.intensity ?? 'mid')
          : 0
        const added: StrengthEntry = { ...s, id: crypto.randomUUID(), estKcal, source: 'nl' }
        workingStrength.push(added)
      }
    }
    for (const c of parsed.cardio) {
      const activity = LABEL_TO_ACTIVITY[c.type] ?? 'walk'
      const estKcal = weightKg ? calcCardioKcal(activity, c.intensity, weightKg, c.minutes) : 0
      workingCardio.push({ ...c, id: crypto.randomUUID(), done: true, estKcal, source: 'nl' })
    }
    const oversizedEntry = workingStrength.find((entry) => entry.sets.length > 50)
    if (oversizedEntry) {
      showToast(`「${oversizedEntry.name}」合并后超过 50 组，请删减后再写入。`)
      return
    }
    if (workingStrength.length > 200 || workingCardio.length > 100) {
      showToast('今天的训练记录已达到安全上限，请先整理现有记录。')
      return
    }
    if (!saveWholeDay({ ...dayLog, strength: workingStrength, cardio: workingCardio })) {
      return
    }
    setPendingParsed(null)
    setParsedResetToken((value) => value + 1)
    showToast('AI 训练结果已写入')
  }

  function requestParsedWorkout(parsed: ConfirmedParsedWorkout) {
    const dayLog = store.getDayLog(date)
    const existingNames = new Set(dayLog.strength.map((entry) => entry.name.trim().toLowerCase()))
    const hasConflict = parsed.strength.some((entry) => existingNames.has(entry.name.trim().toLowerCase())) || parsed.cardio.some((entry) => dayLog.cardio.some((existing) => existing.type === entry.type))
    if (hasConflict) {
      setPendingParsed(parsed)
      return
    }
    persistParsedWorkout(parsed, 'append')
  }

  return (
    <div className="space-y-6">
      {allWorkoutDone && (
        <div className="animate-fade-in space-y-1 rounded-lg border border-plate-green bg-plate-green/10 p-3 text-center">
          <p className="font-heading text-sm font-semibold text-plate-green">✓ 今日训练已计入档案</p>
          <p className="text-xs text-neutral-600">{quoteForDate(date)}</p>
        </div>
      )}

      {activePlan && (
        <div className="space-y-2 rounded-lg border border-neutral-300 bg-card p-3">
          <p className="text-sm font-medium text-neutral-900">从计划导入今天的动作</p>
          <p className="text-xs text-neutral-500">当前计划:{activePlan.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {activePlan.days.map((day, i) => (
              <button
                key={i}
                onClick={() => requestPlanImport(day)}
                className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm text-neutral-800 active:bg-neutral-100"
              >
                {day.label}
              </button>
            ))}
          </div>
          {pendingImport && (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-800">今天已有重复的动作或有氧项目，要如何导入？</p>
              <p className="text-xs text-amber-700">
                为避免重复记录，建议跳过重复项目；如果确实是第二次训练，可明确追加全部。
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="min-h-11 rounded-md bg-primary px-3 text-xs font-medium text-white"
                  onClick={() => performPlanImport(pendingImport, false)}
                >
                  跳过重复项目
                </button>
                <button
                  className="min-h-11 rounded-md border border-amber-400 px-3 text-xs text-amber-800"
                  onClick={() => performPlanImport(pendingImport, true)}
                >
                  仍然追加全部
                </button>
                <button
                  className="min-h-11 rounded-md border border-neutral-300 px-3 text-xs text-neutral-600"
                  onClick={() => setPendingImport(null)}
                >
                  取消
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-neutral-400">导入后力量组和有氧均为待完成，实际做完后再勾选「完成」。</p>
          <p className="text-xs text-neutral-500">真人示范试点覆盖「全身训练 · 新手三日」的 Day 1 四个动作。导入后点「视频与要领」，看完返回当前记录；其余动作暂未覆盖。模板未新增专业审校，不代表个性化训练处方。</p>
        </div>
      )}

      <NLWorkoutInput key={date} date={date} onConfirm={requestParsedWorkout} resetToken={parsedResetToken} />

      {companionOpen ? <Suspense fallback={<p>正在加载熊猫陪练…</p>}><WorkoutCompanion key={`${date}:${companionLaunch?.sequence ?? 0}`} date={date} entries={dayLog.strength} initialEntryId={companionLaunch?.entryId} focusOnOpen={Boolean(companionLaunch)} completion={completion} onClose={() => setCompanionOpen(false)} /></Suspense> : <button className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm text-neutral-800" onClick={() => { setCompanionLaunch(null); setCompanionOpen(true) }}>开启熊猫陪练</button>}

      <section>
        <button className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm text-neutral-800" aria-expanded={equipmentOpen} onClick={() => setEquipmentOpen(value => !value)}>{equipmentOpen ? '收起器械扫描' : '扫描静态器械'}</button>
        {equipmentOpen && <div className="equipment-embedded"><Suspense fallback={<p>正在加载器械扫描…</p>}><EquipmentScanner key={date} date={date} onStartCompanion={name => {
          const current = store.getDayLog(date)
          const entry = current.strength.find(item => item.name === name)
          if (!entry) return false
          setDayLog(current)
          setCompanionLaunch(previous => ({ entryId: entry.id, sequence: (previous?.sequence ?? 0) + 1 }))
          setCompanionOpen(true); setEquipmentOpen(false)
          return true
        }} onContinueTraining={() => { setEquipmentOpen(false); requestAnimationFrame(() => document.getElementById('equipment-strength-records')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })) }} onAddExercise={name => {
          const current = store.getDayLog(date)
          if (current.strength.some(entry => entry.name === name)) { setDayLog(current); showToast('当前记录已有这个动作，请在下方继续填写。'); return true }
          if (current.strength.length >= 200) { showToast('今天最多记录 200 个力量动作'); return false }
          return safeEdit(() => addExercise(name))
        }} /></Suspense></div>}
      </section>

      {pendingParsed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="parsed-conflict-title"
        >
          <div className="w-full max-w-md space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-xl">
            <p id="parsed-conflict-title" className="text-sm font-medium text-amber-900">
              AI 结果里有今天已经存在的同名动作或有氧项目
            </p>
            <p className="text-xs text-amber-700">
              请选择把新识别的组数追加到原动作，或用新组数替换今天的同名动作；确认前不会写入任何内容。
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-11 rounded-md bg-primary px-3 text-xs font-medium text-white"
                onClick={() => persistParsedWorkout(pendingParsed, 'append')}
              >
                追加新组数
              </button>
              <button
                className="min-h-11 rounded-md border border-amber-400 px-3 text-xs text-amber-800"
                onClick={() => persistParsedWorkout(pendingParsed, 'replace')}
              >
                替换同名动作组数
              </button>
              <button
                className="min-h-11 rounded-md border border-neutral-300 px-3 text-xs text-neutral-600"
                onClick={() => setPendingParsed(null)}
              >
                返回编辑
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 id="equipment-strength-records" className="mb-3 text-sm font-medium text-neutral-400">力量训练</h3>
        <StrengthLogger
          date={date}
          entries={dayLog.strength}
          onAddExercise={(...args) => safeEdit(() => addExercise(...args))}
          onAddSet={(...args) => safeEdit(() => addSet(...args))}
          onUpdateSet={(...args) => safeEdit(() => updateSet(...args))}
          onClearNotice={(...args) => safeEdit(() => clearStrengthNotice(...args))}
          onRemoveSet={(...args) => safeEdit(() => removeSet(...args))}
          onRemoveEntry={(...args) => safeEdit(() => removeExercise(...args))}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-neutral-400">有氧训练</h3>
        <CardioLogger
          entries={dayLog.cardio}
          weightKg={weightKg}
          onAdd={(...args) => safeEdit(() => addCardio(...args))}
          onUpdate={(...args) => safeEdit(() => updateCardio(...args))}
          onClearNotice={(...args) => safeEdit(() => clearCardioNotice(...args))}
          onRemove={(...args) => safeEdit(() => removeCardio(...args))}
        />
      </div>

      {!weightKg && (
        <p className="text-xs text-neutral-600">添加一条包含体重的测量记录后,这里的热量才能自动估算。</p>
      )}
    </div>
  )
}
