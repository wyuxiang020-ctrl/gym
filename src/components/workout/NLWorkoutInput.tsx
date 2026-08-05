import { useState } from 'react'
import type { CardioEntry, StrengthEntry } from '../../lib/types'
import { CARDIO_TYPE_LABELS, type CardioActivity, type Intensity } from '../../lib/met'
import { IntensityPicker } from './IntensityPicker'
import { Stepper } from './Stepper'
import { AiBadge } from '../AiBadge'

type ParsedStrength = Omit<StrengthEntry, 'id' | 'source' | 'estKcal'>
type ParsedCardio = Omit<CardioEntry, 'id' | 'source' | 'estKcal'>
type ParsedResult = { strength: ParsedStrength[]; cardio: ParsedCardio[] }

async function callParseWorkout(text: string): Promise<ParsedResult> {
  const res = await fetch('/api/parse-workout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(body.error ?? '解析失败')
  }
  const result = body.result as Partial<ParsedResult>
  return { strength: result.strength ?? [], cardio: result.cardio ?? [] }
}

export function NLWorkoutInput({ onConfirm }: { onConfirm: (result: ParsedResult) => void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedResult | null>(null)

  async function parse() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await callParseWorkout(text)
      setPreview(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败')
    } finally {
      setLoading(false)
    }
  }

  function updateStrength(i: number, patch: Partial<ParsedStrength>) {
    setPreview((p) => (p ? { ...p, strength: p.strength.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) } : p))
  }

  function removeStrength(i: number) {
    setPreview((p) => (p ? { ...p, strength: p.strength.filter((_, idx) => idx !== i) } : p))
  }

  function updateCardio(i: number, patch: Partial<ParsedCardio>) {
    setPreview((p) => (p ? { ...p, cardio: p.cardio.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) } : p))
  }

  function removeCardio(i: number) {
    setPreview((p) => (p ? { ...p, cardio: p.cardio.filter((_, idx) => idx !== i) } : p))
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-300 bg-card p-3">
      <label className="flex flex-col gap-1 text-xs text-neutral-600">
        自然语言记录训练(文字或语音转写)
        <textarea
          className="rounded-md bg-neutral-100 border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
          rows={2}
          placeholder="今天卧推 60 公斤做了 4 组,前三组 8 次最后一组 6 次,然后深蹲 80 三组 10 次,最后跑步机走了 20 分钟"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <button
        className="min-h-11 rounded-md bg-primary hover:bg-primary-dark disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
        disabled={loading || !text.trim()}
        onClick={parse}
      >
        {loading ? '解析中…' : '解析'}
      </button>

      {error && (
        <p className="text-xs text-red-500">
          {error}
          {!preview && '(原始文字已保留,可以直接手动记录或重试)'}
        </p>
      )}

      {preview && (
        <div className="space-y-3 border-t border-neutral-300 pt-3">
          {preview.strength.map((s, i) => (
            <div
              key={i}
              className={`space-y-2 rounded-md border px-3 py-2 ${
                s.uncertain?.length ? 'border-amber-300 bg-amber-50' : 'border-neutral-300 bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <AiBadge />
                <input
                  className="flex-1 bg-transparent text-sm text-neutral-900 outline-none"
                  value={s.name}
                  onChange={(e) => updateStrength(i, { name: e.target.value })}
                />
                <button className="text-xs text-neutral-400 hover:text-red-500" onClick={() => removeStrength(i)}>
                  删除
                </button>
              </div>
              <div className="space-y-1">
                {s.sets.map((set, si) => (
                  <div key={si} className="flex items-center gap-3">
                    <span className="w-5 text-xs text-neutral-400">{si + 1}</span>
                    <Stepper
                      value={set.weight}
                      step={2.5}
                      suffix="kg"
                      showPlateColor
                      onChange={(v) =>
                        updateStrength(i, { sets: s.sets.map((x, xi) => (xi === si ? { ...x, weight: v } : x)) })
                      }
                    />
                    <span className="text-xs text-neutral-400">×</span>
                    <Stepper
                      value={set.reps}
                      step={1}
                      onChange={(v) =>
                        updateStrength(i, { sets: s.sets.map((x, xi) => (xi === si ? { ...x, reps: v } : x)) })
                      }
                    />
                    <button
                      className="text-xs text-neutral-400 hover:text-red-500"
                      onClick={() => updateStrength(i, { sets: s.sets.filter((_, xi) => xi !== si) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {s.uncertain?.length ? (
                <p className="text-xs text-amber-700">没把握:{s.uncertain.join('; ')}</p>
              ) : null}
              {s.note && <p className="text-xs text-neutral-500">未识别:{s.note}</p>}
            </div>
          ))}

          {preview.cardio.map((c, i) => (
            <div
              key={i}
              className={`space-y-2 rounded-md border px-3 py-2 ${
                c.uncertain?.length ? 'border-amber-300 bg-amber-50' : 'border-neutral-300 bg-neutral-100'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <AiBadge />
                <select
                  className="rounded-md bg-card border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
                  value={c.type}
                  onChange={(e) => updateCardio(i, { type: e.target.value })}
                >
                  {(Object.keys(CARDIO_TYPE_LABELS) as CardioActivity[])
                    .filter((k): k is Exclude<CardioActivity, 'strength'> => k !== 'strength')
                    .map((key) => (
                      <option key={key} value={CARDIO_TYPE_LABELS[key]}>
                        {CARDIO_TYPE_LABELS[key]}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  className="w-20 rounded-md bg-card border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
                  value={c.minutes}
                  onChange={(e) => updateCardio(i, { minutes: Number(e.target.value) })}
                />
                <span className="text-xs text-neutral-500">分钟</span>
                <IntensityPicker value={c.intensity as Intensity} onChange={(v) => updateCardio(i, { intensity: v })} />
                <button className="ml-auto text-xs text-neutral-400 hover:text-red-500" onClick={() => removeCardio(i)}>
                  删除
                </button>
              </div>
              {c.uncertain?.length ? (
                <p className="text-xs text-amber-700">没把握:{c.uncertain.join('; ')}</p>
              ) : null}
              {c.note && <p className="text-xs text-neutral-500">未识别:{c.note}</p>}
            </div>
          ))}

          {preview.strength.length === 0 && preview.cardio.length === 0 && (
            <p className="text-xs text-neutral-500">没有识别出训练内容。</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-medium text-white"
              onClick={() => {
                onConfirm(preview)
                setPreview(null)
                setText('')
              }}
            >
              确认写入
            </button>
            <button
              className="rounded-md border border-neutral-400 hover:border-neutral-500 px-4 py-2 text-sm text-neutral-800"
              onClick={parse}
              disabled={loading}
            >
              重新解析
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
