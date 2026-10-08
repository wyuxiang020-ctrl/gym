import { useState } from 'react'
import type { CardioEntry } from '../../lib/types'
import { CARDIO_TYPE_LABELS, calcCardioKcal, type CardioActivity, type Intensity } from '../../lib/met'
import { IntensityPicker } from './IntensityPicker'
import { AiBadge } from '../AiBadge'

type CardioType = Exclude<CardioActivity, 'strength'>

function cardioTypeKey(label: string): CardioType | null {
  return (
    (Object.keys(CARDIO_TYPE_LABELS) as CardioType[]).find((key) => CARDIO_TYPE_LABELS[key] === label) ?? null
  )
}

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
  onUpdate,
  onClearNotice,
  onRemove,
}: {
  entries: CardioEntry[]
  weightKg: number | null
  onAdd: (entry: Omit<CardioEntry, 'id' | 'estKcal' | 'source'>) => void
  onUpdate: (id: string, patch: Partial<Omit<CardioEntry, 'id'>>) => void
  onClearNotice: (id: string) => void
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
            done: true,
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
              min={1}
              max={1440}
              required
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
              min={0}
              max={1000}
              className="rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
              value={draft.distance}
              onChange={(e) => setDraft((d) => ({ ...d, distance: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            平均心率(可选)
            <input
              type="number"
              min={30}
              max={250}
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
              className="animate-fade-in space-y-2 rounded-md bg-card border border-neutral-300 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex flex-wrap items-center gap-1.5 text-neutral-800">
                  <select
                    aria-label="有氧项目"
                    className="rounded-md border border-neutral-300 bg-card px-2 py-1 text-sm text-neutral-800"
                    value={cardioTypeKey(entry.type) ?? ''}
                    onChange={(event) =>
                      onUpdate(entry.id, { type: CARDIO_TYPE_LABELS[event.target.value as CardioType] })
                  }
                >
                  <option value="" disabled>
                    {cardioTypeKey(entry.type) === null ? `原计划：${entry.type}` : '选择项目'}
                  </option>
                    {(Object.keys(CARDIO_TYPE_LABELS) as CardioType[]).map((key) => (
                      <option key={key} value={key}>
                        {CARDIO_TYPE_LABELS[key]}
                      </option>
                    ))}
                  </select>
                  · {entry.minutes} 分钟
                  {entry.distance != null && ` · ${entry.distance}km`}
                  {entry.avgHr != null && ` · 心率 ${entry.avgHr}`}
                  {entry.source === 'nl' && <AiBadge />}
                </span>
                <span className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
                  估算 {entry.estKcal} kcal
                  <label className="flex items-center gap-1 text-neutral-600">
                    <input
                      type="checkbox"
                      checked={entry.done !== false}
                      disabled={cardioTypeKey(entry.type) === null}
                      onChange={(event) => onUpdate(entry.id, { done: event.target.checked })}
                    />
                    {entry.done === false ? '待完成' : '已完成'}
                  </label>
                  <button className="text-neutral-400 hover:text-red-500" onClick={() => onRemove(entry.id)}>
                    删除
                  </button>
                </span>
              </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
