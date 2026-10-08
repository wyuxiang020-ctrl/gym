import { useEffect, useId, useState } from 'react'
import type { StrengthSet } from '../../lib/types'
import { confirmedMissingWeight, WEIGHT_LABELS } from '../../lib/strength'

export function WeightEditor({ set, onChange, onEditingChange }: {
  set: StrengthSet
  onChange: (patch: Partial<StrengthSet>) => boolean | void
  onEditingChange?: (id: string, editing: boolean) => void
}) {
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [unit, setUnit] = useState('kg')
  const kg = Math.round(Number(text) * (unit === 'lb' ? 0.4536 : unit === 'jin' ? 0.5 : 1) * 10000) / 10000
  useEffect(() => {
    onEditingChange?.(id, editing)
    return () => onEditingChange?.(id, false)
  }, [id, editing, onEditingChange])
  function start() {
    setText(set.weight?.toString() ?? '')
    setUnit('kg')
    setEditing(true)
  }
  return <div className="flex flex-wrap items-center gap-1 text-xs">
    <select aria-label="重量状态" className="min-h-9 rounded border bg-white px-1" value={editing ? 'known' : set.weightState ?? 'unknown'} onChange={(e) => {
      const state = e.target.value as StrengthSet['weightState']
      if (state === 'known') start()
      else if (onChange({ weightState: state, weight: null, missingWeightConfirmed: undefined }) !== false) setEditing(false)
    }}>
      {Object.entries(WEIGHT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
    {editing ? <>
      <input aria-label="重量数值" type="number" min="0.001" step="any" value={text} onChange={(e) => setText(e.target.value)} className="w-20 min-h-9 rounded border px-1" />
      <select aria-label="重量单位" value={unit} onChange={(e) => setUnit(e.target.value)} className="min-h-9 rounded border">
        <option value="kg">kg</option><option value="jin">斤</option><option value="lb">磅</option>
      </select>
      <button className="min-h-9 rounded border px-2 disabled:opacity-40" disabled={!text || !Number.isFinite(kg) || kg <= 0 || kg > 1000} onClick={() => {
        if (onChange({ weightState: 'known', weight: kg, missingWeightConfirmed: undefined }) !== false) setEditing(false)
      }}>确认重量</button>
      <button className="min-h-9 rounded border px-2" onClick={() => setEditing(false)}>取消重量编辑</button>
      <span className="text-amber-700">修改尚未确认；保留原已确认值</span>
    </> : set.weightState === 'known' ? <button className="min-h-9 rounded border px-2" onClick={start}>{set.weight} kg · 修改</button> : null}
    {!editing && set.weightState === 'unknown' && <div className="space-y-1 text-amber-800">
      {confirmedMissingWeight(set) ? <>
        <span>重量未记录 · 已确认缺失</span>
        <button className="ml-2 min-h-9 rounded border px-2" onClick={() => onChange({ missingWeightConfirmed: undefined })}>撤销缺失确认</button>
      </> : <>
        <span>待核对{set.legacyWeight !== undefined ? `（旧值 ${set.legacyWeight}kg，需核对）` : ''}</span>
        <button className="ml-2 min-h-9 rounded border px-2" onClick={() => onChange({ weight: null, weightState: 'unknown', missingWeightConfirmed: true })}>确认重量未记录</button>
      </>}
      <p className="text-xs">确实记不清可确认缺失；不自动标记完成，不计入重量容量与热量估算。</p>
    </div>}
  </div>
}
