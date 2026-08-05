import { useEffect, useState } from 'react'
import type { Plan, PlanDay } from '../lib/types'
import { ExercisePicker } from './workout/ExercisePicker'
import { ExerciseDetailSheet } from './workout/ExerciseDetailSheet'

type Exercise = PlanDay['exercises'][number]

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
  const [dragDay, setDragDay] = useState<number | null>(null)
  const [dragExercise, setDragExercise] = useState<{ dayIndex: number; exIndex: number } | null>(null)
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null)
  const [detailFor, setDetailFor] = useState<string | null>(null)

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
    updateDay(dayIndex, {
      exercises: [...days[dayIndex].exercises, { name, sets: 3, repRange: '8-12' }],
    })
    setPickerOpenFor(null)
  }

  function removeExercise(dayIndex: number, exIndex: number) {
    updateDay(dayIndex, { exercises: days[dayIndex].exercises.filter((_, i) => i !== exIndex) })
  }

  function addDay() {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
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
            draggable
            onDragStart={() => setDragDay(dayIndex)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragDay != null) reorderDays(dragDay, dayIndex)
              setDragDay(null)
            }}
            className="rounded-lg border border-neutral-300 bg-card p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="cursor-grab text-neutral-400" title="拖动排序">⠿</span>
              <input
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
              {day.exercises.map((ex, exIndex) => (
                <div
                  key={exIndex}
                  draggable
                  onDragStart={() => setDragExercise({ dayIndex, exIndex })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragExercise && dragExercise.dayIndex === dayIndex) {
                      reorderExercises(dayIndex, dragExercise.exIndex, exIndex)
                    }
                    setDragExercise(null)
                  }}
                  className="animate-fade-in flex flex-wrap items-center gap-2 rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1.5"
                >
                  <span className="cursor-grab text-neutral-700 text-xs" title="拖动排序">⠿</span>
                  <input
                    className="flex-1 min-w-[100px] bg-transparent text-sm text-neutral-900 outline-none"
                    value={ex.name}
                    onChange={(e) => updateExercise(dayIndex, exIndex, { name: e.target.value })}
                  />
                  <input
                    type="number"
                    className="w-14 bg-card border border-neutral-300 rounded px-1 py-0.5 text-xs text-neutral-800"
                    value={ex.sets}
                    onChange={(e) => updateExercise(dayIndex, exIndex, { sets: Number(e.target.value) })}
                    title="组数"
                  />
                  <span className="text-xs text-neutral-400">组 ×</span>
                  <input
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
              ))}
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
                    className="w-24 bg-neutral-100 border border-neutral-300 rounded px-2 py-1 text-neutral-800"
                    value={day.cardio.type}
                    onChange={(e) => updateDay(dayIndex, { cardio: { ...day.cardio!, type: e.target.value } })}
                  />
                  <input
                    type="number"
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
          onClick={() => onSave({ name, days })}
        >
          保存修改
        </button>
        <button
          className="rounded-md border border-neutral-400 hover:border-neutral-500 px-4 py-2 text-sm text-neutral-800"
          onClick={() => onSaveAsNew({ name: `${name} 副本`, days })}
        >
          另存为新计划
        </button>
      </div>

      {detailFor && <ExerciseDetailSheet name={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  )
}
