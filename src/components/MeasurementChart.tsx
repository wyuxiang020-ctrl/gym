import type { Measurement } from '../lib/types'
import { useState } from 'react'

const W = 300
const H = 120
const PAD = 10

export function MeasurementChart({
  measurements,
  field,
  label,
  unit,
}: {
  measurements: Measurement[]
  field: 'weight' | 'bodyFat' | 'waist'
  label: string
  unit: string
}) {
  const [limit, setLimit] = useState(30)
  const [selectedDate, setSelectedDate] = useState('')
  const allPoints = measurements
    .filter((m): m is Measurement & Record<typeof field, number> => m[field] != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  const points = limit ? allPoints.slice(-limit) : allPoints
  const selected = points.find(point => point.date === selectedDate) ?? points.at(-1)

  if (points.length < 2) {
    return <p className="text-xs text-neutral-500">至少需要两条包含{label}的测量记录才能画出趋势线。</p>
  }

  const values = points.map((p) => p[field])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = (W - PAD * 2) / (points.length - 1)

  const coords = values.map((v, i) => {
    const x = PAD + i * stepX
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2)
    return [x, y] as const
  })

  return (
    <div className="space-y-3">
      <div className="chart-controls"><label>显示范围<select aria-label="测量趋势范围" value={limit} onChange={event => setLimit(Number(event.target.value))}><option value={7}>最近 7 条</option><option value={30}>最近 30 条</option><option value={0}>全部测量</option></select></label><label>查看日期<select aria-label="测量读值日期" value={selected?.date} onChange={event => setSelectedDate(event.target.value)}>{points.map(point => <option key={point.date} value={point.date}>{point.date}</option>)}</select></label></div>
      <p className="chart-reading" aria-live="polite">{selected?.date} · {label} <strong>{selected?.[field]}</strong> {unit}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={`${label}趋势，${points.length}条测量；读值可通过上方日期选择查看`}>
        <polyline
          points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          fill="none"
          className="stroke-primary"
          strokeWidth="2"
        />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={points[i].date === selected?.date ? 5 : 2.5} className="fill-primary" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-neutral-400">
        <span>
          {points[0].date} · {values[0]}
          {unit}
        </span>
        <span>
          {points[points.length - 1].date} · {values[values.length - 1]}
          {unit}
        </span>
      </div>
    </div>
  )
}
