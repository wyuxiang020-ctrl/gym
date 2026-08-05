import { useState } from 'react'
import type { StrengthEntry } from '../../lib/types'
import { getLastStrengthEntry } from '../../lib/store'
import { Stepper } from './Stepper'
import { AiBadge } from '../AiBadge'
import { ExercisePicker } from './ExercisePicker'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'

function volumeOf(entry: StrengthEntry): number {
  return entry.sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
}

function formatSets(entry: StrengthEntry): string {
  return entry.sets.map((s) => `${s.weight}kg×${s.reps}`).join(', ')
}

export function StrengthLogger({
  date,
  entries,
  onAddExercise,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onRemoveEntry,
}: {
  date: string
  entries: StrengthEntry[]
  onAddExercise: (name: string) => void
  onAddSet: (entryId: string) => void
  onUpdateSet: (entryId: string, setIndex: number, patch: Partial<StrengthEntry['sets'][number]>) => void
  onRemoveSet: (entryId: string, setIndex: number) => void
  onRemoveEntry: (entryId: string) => void
}) {
  const [detailFor, setDetailFor] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <ExercisePicker onSelect={onAddExercise} />

      <div className="space-y-3">
        {entries.map((entry) => {
          const last = getLastStrengthEntry(entry.name, date)
          return (
            <div key={entry.id} className="animate-fade-in rounded-lg border border-neutral-300 bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <button
                      className="text-sm font-medium text-neutral-900 underline decoration-dotted underline-offset-2"
                      onClick={() => setDetailFor(entry.name)}
                    >
                      {entry.name}
                    </button>
                    {entry.source === 'nl' && <AiBadge />}
                  </div>
                  {last && <div className="text-xs text-neutral-500">上次:{formatSets(last)}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-500">
                    容量 {volumeOf(entry).toLocaleString()} kg·次 · 估算 {entry.estKcal} kcal
                  </div>
                  <button
                    className="text-xs text-neutral-400 hover:text-red-500"
                    onClick={() => onRemoveEntry(entry.id)}
                  >
                    删除动作
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {entry.sets.map((set, i) => (
                  <div key={i} className="animate-fade-in flex items-center gap-3 rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1.5">
                    <span className="w-5 text-xs text-neutral-400">{i + 1}</span>
                    <Stepper
                      value={set.weight}
                      step={2.5}
                      onChange={(v) => onUpdateSet(entry.id, i, { weight: v })}
                      suffix="kg"
                      showPlateColor
                    />
                    <span className="text-xs text-neutral-400">×</span>
                    <Stepper value={set.reps} step={1} onChange={(v) => onUpdateSet(entry.id, i, { reps: v })} />
                    <label className="ml-auto flex items-center gap-1 text-xs text-neutral-600">
                      <input
                        type="checkbox"
                        checked={set.done}
                        onChange={(e) => onUpdateSet(entry.id, i, { done: e.target.checked })}
                      />
                      完成
                    </label>
                    <button
                      className="text-xs text-neutral-400 hover:text-red-500"
                      onClick={() => onRemoveSet(entry.id, i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="text-xs text-neutral-600 hover:text-neutral-800"
                onClick={() => onAddSet(entry.id)}
              >
                + 加一组
              </button>
            </div>
          )
        })}
      </div>

      {detailFor && <ExerciseDetailSheet name={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  )
}
