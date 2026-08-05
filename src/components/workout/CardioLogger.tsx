import { useState } from 'react'
import type { CardioEntry } from '../../lib/types'
import { CARDIO_TYPE_LABELS, calcCardioKcal, type CardioActivity, type Intensity } from '../../lib/met'
import { IntensityPicker } from './IntensityPicker'
import { AiBadge } from '../AiBadge'

type CardioType = Exclude<CardioActivity, 'strength'>

function emptyDraft() {
  return {
    type: 'run' as CardioType,
    minutes: 20,
    distance: '',
    avgHr: '',
    intensity: 'mid' as Intensity,
  }
}

export function CardioLogger({
  entries,
  weightKg,
  onAdd,
  onRemove,
}: {
  entries: CardioEntry[]
  weightKg: number | null
  onAdd: (entry: Omit<CardioEntry, 'id' | 'estKcal' | 'source'>) => void
  onRemove: (id: string) => void
}) {
  const [draft, setDraft] = useState(emptyDraft())

  const previewKcal = weightKg
    ? calcCardioKcal(draft.type, draft.intensity, weightKg, draft.minutes)
    : null

  return (
    <div className="space-y-4">
      <form
        className="space-y-3 rounded-lg border border-neutral-300 bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault()
          onAdd({
            type: CARDIO_TYPE_LABELS[draft.type],
            minutes: draft.minutes,
            distance: draft.distance === '' ? undefined : Number(draft.distance),
            avgHr: draft.avgHr === '' ? undefined : Number(draft.avgHr),
            intensity: draft.intensity,
          })
          setDraft(emptyDraft())
        }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            项目
            <select
              className="rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as CardioType }))}
            >
              {(Object.keys(CARDIO_TYPE_LABELS) as CardioType[]).map((key) => (
                <option key={key} value={key}>
                  {CARDIO_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            时长(分钟)
            <input
              type="number"
              className="rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
              value={draft.minutes}
              onChange={(e) => setDraft((d) => ({ ...d, minutes: Number(e.target.value) }))}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            距离(km,可选)
            <input
              type="number"
              step="0.1"
              className="rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
              value={draft.distance}
              onChange={(e) => setDraft((d) => ({ ...d, distance: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            平均心率(可选)
            <input
              type="number"
              className="rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
              value={draft.avgHr}
              onChange={(e) => setDraft((d) => ({ ...d, avgHr: e.target.value }))}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <IntensityPicker value={draft.intensity} onChange={(v) => setDraft((d) => ({ ...d, intensity: v }))} />
          {previewKcal != null && (
            <span className="text-xs text-neutral-500">预计估算 {previewKcal} kcal</span>
          )}
        </div>

        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-medium text-white"
        >
          添加有氧记录
        </button>
      </form>

      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="animate-fade-in flex items-center justify-between rounded-md bg-card border border-neutral-300 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-1.5 text-neutral-800">
                {entry.type} · {entry.minutes} 分钟
                {entry.distance != null && ` · ${entry.distance}km`}
                {entry.avgHr != null && ` · 心率 ${entry.avgHr}`}
                {entry.source === 'nl' && <AiBadge />}
              </span>
              <span className="flex items-center gap-2 text-xs text-neutral-500">
                估算 {entry.estKcal} kcal
                <button className="text-neutral-400 hover:text-red-500" onClick={() => onRemove(entry.id)}>
                  删除
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
