import { useEffect, useRef, useState } from 'react'
import type { Plan, PlanDay } from '../lib/types'
import { EXERCISE_DETAILS } from '../lib/exerciseDetails'
import { useToast } from '../lib/toast'
import { ExercisePicker } from './workout/ExercisePicker'
import { ExerciseDetailSheet } from './workout/ExerciseDetailSheet'

type Exercise = PlanDay['exercises'][number]
type DragScope = { type: 'day' } | { type: 'exercise'; dayIndex: number }

function validatePlan(name: string, days: PlanDay[]): string | null {
  if (!name.trim()) return '计划名称不能为空'
  if (name.length > 100) return '计划名称最多 100 个字符'
  if (days.length === 0) return '训练计划至少需要一天'
  if (days.length > 50) return '一个计划最多包含 50 天'
  for (const day of days) {
    if (!day.label.trim()) return '每天的名称不能为空'
    if (day.label.length > 100) return '每天的名称最多 100 个字符'
    if (day.exercises.length > 100) return '每个训练日最多包含 100 个动作'
    for (const exercise of day.exercises) {
      if (!exercise.name.trim()) return '动作名称不能为空'
      if (exercise.name.length > 100) return '动作名称最多 100 个字符'
      if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20) {
        return '每个动作的组数需要在 1-20 之间'
      }
      if (!exercise.repRange.trim()) return '次数或时长不能为空'
      if (exercise.repRange.length > 100) return '次数或时长最多 100 个字符'
    }
    if (day.cardio && (!day.cardio.type.trim() || day.cardio.type.length > 100)) {
      return '有氧项目名称需要在 1-100 个字符之间'
    }
    if (day.cardio && (!Number.isFinite(day.cardio.minutes) || day.cardio.minutes < 1 || day.cardio.minutes > 1440)) {
      return '有氧时长需要在 1-1440 分钟之间'
    }
  }
  return null
}

export function PlanEditor({
  plan,
  onSave,
  onSaveAsNew,
  onSetActive,
  onDelete,
}: {
  plan: Plan
  onSave: (patch: { name: string; days: PlanDay[] }) => void
  onSaveAsNew: (patch: { name: string; days: PlanDay[] }) => void
  onSetActive: () => void
  onDelete: () => void
}) {
  const [name, setName] = useState(plan.name)
  const [days, setDays] = useState<PlanDay[]>(plan.days)
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null)
  const [detailFor, setDetailFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  const [dragScope, setDragScope] = useState<DragScope | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    setName(plan.name)
    setDays(plan.days)
  }, [plan.id, plan.name, plan.days])

  function updateDay(i: number, patch: Partial<PlanDay>) {
    setDays((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  function updateExercise(dayIndex: number, exIndex: number, patch: Partial<Exercise>) {
    setDays((ds) =>
      ds.map((d, idx) =>
        idx !== dayIndex
          ? d
          : { ...d, exercises: d.exercises.map((e, ei) => (ei === exIndex ? { ...e, ...patch } : e)) },
      ),
    )
  }

  function addExercise(dayIndex: number, name: string) {
    if (days[dayIndex].exercises.length >= 100) {
      setError('每个训练日最多包含 100 个动作')
      return
    }
    updateDay(dayIndex, {
      exercises: [...days[dayIndex].exercises, { name, sets: 3, repRange: '8-12' }],
    })
    setPickerOpenFor(null)
    showToast(`已添加「${name}」到这一天`)
  }

  function removeExercise(dayIndex: number, exIndex: number) {
    updateDay(dayIndex, { exercises: days[dayIndex].exercises.filter((_, i) => i !== exIndex) })
  }

  function addDay() {
    if (days.length >= 50) {
      setError('一个计划最多包含 50 天')
      return
    }
    setDays((ds) => [...ds, { label: `Day ${ds.length + 1}`, exercises: [] }])
  }

  function removeDay(i: number) {
    setDays((ds) => ds.filter((_, idx) => idx !== i))
  }

  function reorderDays(from: number, to: number) {
    if (from === to) return
    setDays((ds) => {
      const copy = [...ds]
      const [moved] = copy.splice(from, 1)
      copy.splice(to, 0, moved)
      return copy
    })
  }

  function reorderExercises(dayIndex: number, from: number, to: number) {
    if (from === to) return
    setDays((ds) =>
      ds.map((d, idx) => {
        if (idx !== dayIndex) return d
        const copy = [...d.exercises]
        const [moved] = copy.splice(from, 1)
        copy.splice(to, 0, moved)
        return { ...d, exercises: copy }
      }),
    )
  }

  function toggleCardio(dayIndex: number) {
    const day = days[dayIndex]
    updateDay(dayIndex, {
      cardio: day.cardio ? undefined : { type: '有氧(可自选)', minutes: 20 },
    })
  }

  function save(asNew: boolean) {
    const validationError = validatePlan(name, days)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    if (asNew) {
      onSaveAsNew({ name: `${name.trim().slice(0, 97)} 副本`, days })
      showToast('已另存为新计划')
    } else {
      onSave({ name: name.trim(), days })
      showToast('已保存修改')
    }
  }

  // 长按拖动排序:用 Pointer Events 而不是 HTML5 draggable,
  // 因为 draggable 在 iOS Safari 触屏上基本不生效
  function startDrag(scope: DragScope, index: number, e: React.PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragScope(scope)
    setDragIndex(index)
  }

  function moveDrag(scope: DragScope, e: React.PointerEvent) {
    if (dragIndex === null || !dragScope) return
    if (dragScope.type !== scope.type) return
    if (scope.type === 'exercise' && dragScope.type === 'exercise' && scope.dayIndex !== dragScope.dayIndex) return

    const y = e.clientY
    const list = scope.type === 'day' ? days : days[scope.dayIndex].exercises
    const keyFor = (i: number) => (scope.type === 'day' ? `day-${i}` : `ex-${scope.dayIndex}-${i}`)

    for (let i = 0; i < list.length; i++) {
      if (i === dragIndex) continue
      const el = itemRefs.current.get(keyFor(i))
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      if ((dragIndex < i && y > mid) || (dragIndex > i && y < mid)) {
        if (scope.type === 'day') {
          reorderDays(dragIndex, i)
        } else {
          reorderExercises(scope.dayIndex, dragIndex, i)
        }
        setDragIndex(i)
        break
      }
    }
  }

  function endDrag() {
    setDragScope(null)
    setDragIndex(null)
  }

  const isDraggingDay = (i: number) => dragScope?.type === 'day' && dragIndex === i
  const isDraggingExercise = (dayIndex: number, exIndex: number) =>
    dragScope?.type === 'exercise' && dragScope.dayIndex === dayIndex && dragIndex === exIndex

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          maxLength={100}
          className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900 text-sm flex-1 min-w-[200px]"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {plan.isActive ? (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">当前使用</span>
        ) : (
          <button
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:border-neutral-400"
            onClick={onSetActive}
          >
            设为当前计划
          </button>
        )}
        <button
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-red-500 hover:border-red-300"
          onClick={onDelete}
        >
          删除计划
        </button>
      </div>

      <div className="space-y-3">
        {days.map((day, dayIndex) => (
          <div
            key={dayIndex}
            ref={(el) => {
              if (el) itemRefs.current.set(`day-${dayIndex}`, el)
            }}
            className={`rounded-lg border bg-card p-3 space-y-2 transition-shadow ${
              isDraggingDay(dayIndex) ? 'border-primary shadow-lg opacity-80' : 'border-neutral-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-display w-5 text-sm text-neutral-400">{dayIndex + 1}</span>
              <button
                className="touch-none cursor-grab select-none px-1 text-lg text-neutral-400"
                title="长按拖动排序"
                onPointerDown={(e) => startDrag({ type: 'day' }, dayIndex, e)}
                onPointerMove={(e) => moveDrag({ type: 'day' }, e)}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                ⠿
              </button>
              <input
                maxLength={100}
                className="flex-1 rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
                value={day.label}
                onChange={(e) => updateDay(dayIndex, { label: e.target.value })}
              />
              <button
                className="text-xs text-neutral-500 hover:text-red-500"
                onClick={() => removeDay(dayIndex)}
              >
                删除整天
              </button>
            </div>

            <div className="space-y-1">
              {day.exercises.map((ex, exIndex) => {
                const muscle = EXERCISE_DETAILS[ex.name]?.muscle
                return (
                  <div
                    key={exIndex}
                    ref={(el) => {
                      if (el) itemRefs.current.set(`ex-${dayIndex}-${exIndex}`, el)
                    }}
                    className={`animate-fade-in rounded-md border bg-neutral-100 px-2 py-1.5 transition-shadow ${
                      isDraggingExercise(dayIndex, exIndex) ? 'border-primary shadow-lg opacity-80' : 'border-neutral-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-4 text-xs text-neutral-400">{exIndex + 1}</span>
                      <button
                        className="touch-none cursor-grab select-none px-0.5 text-sm text-neutral-400"
                        title="长按拖动排序"
                        onPointerDown={(e) => startDrag({ type: 'exercise', dayIndex }, exIndex, e)}
                        onPointerMove={(e) => moveDrag({ type: 'exercise', dayIndex }, e)}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                      >
                        ⠿
                      </button>
                      <input
                        maxLength={100}
                        className="flex-1 min-w-[100px] bg-transparent text-sm text-neutral-900 outline-none"
                        value={ex.name}
                        onChange={(e) => updateExercise(dayIndex, exIndex, { name: e.target.value })}
                      />
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="w-14 bg-card border border-neutral-300 rounded px-1 py-0.5 text-xs text-neutral-800"
                        value={ex.sets}
                        onChange={(e) => updateExercise(dayIndex, exIndex, { sets: Number(e.target.value) })}
                        title="组数"
                      />
                      <span className="text-xs text-neutral-400">组 ×</span>
                      <input
                        maxLength={100}
                        className="w-16 bg-card border border-neutral-300 rounded px-1 py-0.5 text-xs text-neutral-800"
                        value={ex.repRange}
                        onChange={(e) => updateExercise(dayIndex, exIndex, { repRange: e.target.value })}
                        title="次数区间"
                      />
                      <button
                        className="text-xs text-neutral-400"
                        onClick={() => setDetailFor(ex.name)}
                        title="查看动作要领"
                      >
                        ⓘ
                      </button>
                      <button
                        className="text-xs text-neutral-400 hover:text-red-500"
                        onClick={() => removeExercise(dayIndex, exIndex)}
                      >
                        ✕
                      </button>
                    </div>
                    {muscle && <p className="ml-9 mt-0.5 text-[10px] text-neutral-400">练:{muscle}</p>}
                  </div>
                )
              })}
            </div>

            {pickerOpenFor === dayIndex ? (
              <ExercisePicker onSelect={(exName) => addExercise(dayIndex, exName)} addLabel="添加到这一天" />
            ) : (
              <button
                className="text-xs text-neutral-600 hover:text-neutral-800"
                onClick={() => setPickerOpenFor(dayIndex)}
              >
                + 添加动作
              </button>
            )}

            <div className="border-t border-neutral-300 pt-2">
              {day.cardio ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                  <span>有氧</span>
                  <input
                    maxLength={100}
                    className="w-24 bg-neutral-100 border border-neutral-300 rounded px-2 py-1 text-neutral-800"
                    value={day.cardio.type}
                    onChange={(e) => updateDay(dayIndex, { cardio: { ...day.cardio!, type: e.target.value } })}
                  />
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    className="w-16 bg-neutral-100 border border-neutral-300 rounded px-2 py-1 text-neutral-800"
                    value={day.cardio.minutes}
                    onChange={(e) =>
                      updateDay(dayIndex, { cardio: { ...day.cardio!, minutes: Number(e.target.value) } })
                    }
                  />
                  <span>分钟</span>
                  <button className="text-neutral-400 hover:text-red-500" onClick={() => toggleCardio(dayIndex)}>
                    移除
                  </button>
                </div>
              ) : (
                <button
                  className="text-xs text-neutral-500 hover:text-neutral-700"
                  onClick={() => toggleCardio(dayIndex)}
                >
                  + 添加有氧
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        className="text-sm text-neutral-600 hover:text-neutral-800"
        onClick={addDay}
      >
        + 添加一天
      </button>

      <div className="flex gap-2 pt-2">
        <button
          className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-medium text-white"
          onClick={() => save(false)}
        >
          保存修改
        </button>
        <button
          className="rounded-md border border-neutral-400 hover:border-neutral-500 px-4 py-2 text-sm text-neutral-800"
          onClick={() => save(true)}
        >
          另存为新计划
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {detailFor && <ExerciseDetailSheet name={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  )
}
