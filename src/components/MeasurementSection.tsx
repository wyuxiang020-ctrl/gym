import { useState } from 'react'
import type { Measurement } from '../lib/types'
import { todayStr } from '../lib/date'

function emptyDraft(): Measurement {
  return { date: todayStr() }
}

export function MeasurementSection({
  measurements,
  onAdd,
  onDeleteAt,
}: {
  measurements: Measurement[]
  onAdd: (m: Measurement) => void
  onDeleteAt: (index: number) => void
}) {
  const [draft, setDraft] = useState<Measurement>(emptyDraft())
  const [knowsBodyFat, setKnowsBodyFat] = useState(true)
  const [showMore, setShowMore] = useState(false)

  function update<K extends keyof Measurement>(key: K, value: Measurement[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  const sorted = [...measurements]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.date.localeCompare(a.m.date))

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onAdd(draft)
          setDraft(emptyDraft())
          setShowMore(false)
        }}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            日期
            <input
              type="date"
              className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
              value={draft.date}
              onChange={(e) => update('date', e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            体重 (kg)
            <input
              type="number"
              step="0.1"
              className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
              value={draft.weight ?? ''}
              onChange={(e) => update('weight', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            体脂率 (%)
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                disabled={!knowsBodyFat}
                className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900 disabled:opacity-40"
                value={draft.bodyFat ?? ''}
                onChange={(e) => update('bodyFat', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </div>
            <label className="flex items-center gap-1 text-xs text-neutral-500">
              <input
                type="checkbox"
                checked={!knowsBodyFat}
                onChange={(e) => {
                  setKnowsBodyFat(!e.target.checked)
                  if (e.target.checked) update('bodyFat', undefined)
                }}
              />
              不知道
            </label>
          </label>

          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            腰围 (cm)
            <input
              type="number"
              step="0.1"
              className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
              value={draft.waist ?? ''}
              onChange={(e) => update('waist', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </label>
        </div>

        <button
          type="button"
          className="text-xs text-neutral-600 hover:text-neutral-800 underline underline-offset-2"
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? '收起' : '更多围度'}
        </button>

        {showMore && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm text-neutral-600">
              胸围 (cm)
              <input
                type="number"
                step="0.1"
                className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
                value={draft.chest ?? ''}
                onChange={(e) => update('chest', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-600">
              臀围 (cm)
              <input
                type="number"
                step="0.1"
                className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
                value={draft.hip ?? ''}
                onChange={(e) => update('hip', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-600">
              臂围 (cm)
              <input
                type="number"
                step="0.1"
                className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
                value={draft.arm ?? ''}
                onChange={(e) => update('arm', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-600">
              大腿围 (cm)
              <input
                type="number"
                step="0.1"
                className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
                value={draft.thigh ?? ''}
                onChange={(e) => update('thigh', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-medium text-white"
        >
          添加测量记录
        </button>
      </form>

      {sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-neutral-500 border-b border-neutral-300">
                <th className="py-1 pr-4">日期</th>
                <th className="py-1 pr-4">体重</th>
                <th className="py-1 pr-4">体脂率</th>
                <th className="py-1 pr-4">腰围</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ m, i }) => (
                <tr key={i} className="border-b border-neutral-200 text-neutral-800">
                  <td className="py-1 pr-4">{m.date}</td>
                  <td className="py-1 pr-4">{m.weight ?? '—'}</td>
                  <td className="py-1 pr-4">{m.bodyFat ?? '—'}</td>
                  <td className="py-1 pr-4">{m.waist ?? '—'}</td>
                  <td className="py-1 text-right">
                    <button
                      className="text-xs text-neutral-500 hover:text-red-500"
                      onClick={() => onDeleteAt(i)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
