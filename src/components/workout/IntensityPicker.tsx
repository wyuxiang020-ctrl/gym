import type { Intensity } from '../../lib/met'

const LABELS: Record<Intensity, string> = { low: '低强度', mid: '中强度', high: '高强度' }

const ACTIVE_STYLE: Record<Intensity, string> = {
  low: 'border-plate-green text-plate-green bg-plate-green/10',
  mid: 'border-plate-yellow text-plate-yellow bg-plate-yellow/10',
  high: 'border-plate-red text-plate-red bg-plate-red/10',
}

export function IntensityPicker({
  value,
  onChange,
}: {
  value: Intensity
  onChange: (value: Intensity) => void
}) {
  return (
    <div className="flex gap-1">
      {(['low', 'mid', 'high'] as const).map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={`rounded-md px-2 py-1 text-xs border font-medium ${
            value === level ? ACTIVE_STYLE[level] : 'border-neutral-300 text-neutral-600 hover:border-neutral-400'
          }`}
        >
          {LABELS[level]}
        </button>
      ))}
    </div>
  )
}
