import { useState } from 'react'
import type { StrengthEntry } from '../../lib/types'
import { getLastStrengthEntry } from '../../lib/store'
import { Stepper } from './Stepper'
import { AiBadge } from '../AiBadge'
import { ExercisePicker } from './ExercisePicker'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'
import { WeightEditor } from './WeightEditor'
import { setVolume, validCompletedSet, validEstimatedSet, confirmedMissingWeight, resolvedWeight, WEIGHT_LABELS } from '../../lib/strength'

function volumeOf(entry: StrengthEntry): number {
  return entry.sets.reduce((sum, set) => sum + setVolume(set), 0)
}

function completedTimedSetCount(entry: StrengthEntry): number {
  return entry.sets.filter((set) => validCompletedSet(set) && set.durationSeconds !== undefined).length
}

function formatSet(set: StrengthEntry['sets'][number]): string {
  const weightLabel = confirmedMissingWeight(set) ? '重量未记录（已确认缺失）' : WEIGHT_LABELS[set.weightState ?? 'unknown']
  if (set.durationSeconds !== undefined) {
    return `${set.weightState === 'known' ? `${set.weight}kg` : weightLabel}×${set.durationSeconds}秒`
  }
  return `${set.weightState === 'known' ? `${set.weight}kg` : weightLabel}×${set.reps ?? 0}`
}

function formatSets(entry: StrengthEntry): string {
  return entry.sets.filter((set) => set.done).map(formatSet).join(', ')
}

export function StrengthLogger({
  date,
  entries,
  onAddExercise,
  onAddSet,
  onUpdateSet,
  onClearNotice,
  onRemoveSet,
  onRemoveEntry,
}: {
  date: string
  entries: StrengthEntry[]
  onAddExercise: (name: string) => void
  onAddSet: (entryId: string) => void
  onUpdateSet: (entryId: string, setIndex: number, patch: Partial<StrengthEntry['sets'][number]>) => boolean | void
  onClearNotice: (entryId: string) => void
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
          const volume = volumeOf(entry)
          const timedSets = completedTimedSetCount(entry)
          const missingCount = entry.sets.filter(set => validCompletedSet(set) && confirmedMissingWeight(set)).length
          const estimatedCount = entry.sets.filter(validEstimatedSet).length
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
                    <button className="min-h-9 rounded border border-neutral-300 px-2 text-xs text-neutral-600" onClick={() => setDetailFor(entry.name)}>动作要领</button>
                    {entry.source === 'nl' && <AiBadge />}
                    {entry.source === 'mixed' && <AiBadge assisted />}
                  </div>
                  {last && <div className="text-xs text-neutral-500">上次:{formatSets(last)}</div>}
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-500">
                    {missingCount > 0 && volume === 0 ? '重量容量未计算' : volume > 0 || timedSets === 0 ? `${missingCount > 0 ? '部分' : ''}容量 ${volume.toLocaleString()} kg·次` : ''}
                    {volume > 0 && timedSets > 0 ? ' · ' : ''}
                    {timedSets > 0 ? `计时 ${timedSets} 组` : ''} · {missingCount > 0 && estimatedCount === 0 ? '未估算热量' : `${missingCount > 0 ? '部分' : ''}估算 ${entry.estKcal} kcal`}
                  </div>
                  <button
                    className="text-xs text-neutral-400 hover:text-red-500"
                    onClick={() => onRemoveEntry(entry.id)}
                  >
                    删除动作
                  </button>
                </div>
              </div>

              {missingCount > 0 && <p className="text-xs text-amber-800">已完成记录中 {missingCount} 组重量未记录；可用于训练完成判断，不计入重量容量与热量估算，汇总并非完整总量。</p>}

              {(entry.uncertain?.length || entry.note) && (
                <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs">
                  {entry.uncertain?.length ? (
                    <p className="text-amber-800">待核对：{entry.uncertain.join('；')}</p>
                  ) : null}
                  {entry.note && <p className="text-amber-700">备注：{entry.note}</p>}
                  <button
                    className="text-amber-800 underline underline-offset-2"
                    onClick={() => onClearNotice(entry.id)}
                  >
                    已处理，清除提示
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                {entry.sets.map((set, i) => (
                  <div key={`${i}:${entry.sets.length}`} className="animate-fade-in flex flex-wrap items-center gap-x-2 gap-y-2 rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1.5">
                    <span className="w-5 text-xs text-neutral-400">{i + 1}</span>
                    <select
                      aria-label={`第 ${i + 1} 组记录方式`}
                      className="rounded-md border border-neutral-300 bg-card px-2 py-1 text-xs text-neutral-700"
                      value={set.durationSeconds !== undefined ? 'duration' : 'reps'}
                      onChange={(event) =>
                        onUpdateSet(
                          entry.id,
                          i,
                          event.target.value === 'duration'
                            ? {
                                reps: undefined,
                                durationSeconds: set.durationSeconds ?? 30,
                              }
                            : { reps: set.reps ?? 8, durationSeconds: undefined },
                        )
                      }
                    >
                      <option value="reps">次数</option>
                      <option value="duration">计时</option>
                    </select>
                    <WeightEditor set={set} onChange={(patch) => onUpdateSet(entry.id, i, patch)} />
                    <span className="text-xs text-neutral-400">×</span>
                    {set.durationSeconds !== undefined ? (
                      <Stepper
                        value={set.durationSeconds}
                        step={5}
                        min={1}
                        max={86400}
                        suffix="秒"
                        onChange={(v) => onUpdateSet(entry.id, i, { durationSeconds: v })}
                      />
                    ) : (
                      <Stepper
                        value={set.reps ?? 0}
                        step={1}
                        min={1}
                        max={1000}
                        onChange={(v) => onUpdateSet(entry.id, i, { reps: v })}
                      />
                    )}
                    <label className="ml-auto flex items-center gap-1 text-xs text-neutral-600">
                      <input
                        type="checkbox"
                        checked={set.done}
                        disabled={!resolvedWeight(set) && !confirmedMissingWeight(set) && !set.done}
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
