import { plateColorClass } from '../../lib/plateColors'

export function Stepper({
  value,
  step,
  min = 0,
  onChange,
  suffix,
  showPlateColor,
}: {
  value: number
  step: number
  min?: number
  onChange: (value: number) => void
  suffix?: string
  showPlateColor?: boolean
}) {
  const round = (v: number) => Math.round(v * 100) / 100
  const plateClass = showPlateColor ? plateColorClass(value) : null

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className="h-7 w-7 rounded-md border border-neutral-400 text-neutral-700 hover:border-neutral-500"
        onClick={() => onChange(round(Math.max(min, value - step)))}
      >
        −
      </button>
      <span className="flex w-14 items-center justify-center gap-1 text-center text-sm text-neutral-900 tabular-nums">
        {plateClass && <span className={`h-2 w-2 rounded-full ${plateClass}`} />}
        {value}
        {suffix}
      </span>
      <button
        type="button"
        className="h-7 w-7 rounded-md border border-neutral-400 text-neutral-700 hover:border-neutral-500"
        onClick={() => onChange(round(value + step))}
      >
        +
      </button>
    </div>
  )
}
