import { plateColorClass } from '../../lib/plateColors'

export function Stepper({
  value,
  step,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  onChange,
  suffix,
  showPlateColor,
}: {
  value: number
  step: number
  min?: number
  max?: number
  onChange: (value: number) => void
  suffix?: string
  showPlateColor?: boolean
}) {
  const round = (v: number) => Math.round(v * 100) / 100
  const plateClass = showPlateColor ? plateColorClass(value) : null

  return (
    <div className="stepper">
      <button
        type="button"
        className="h-7 w-7 rounded-md border border-neutral-400 text-neutral-700 hover:border-neutral-500"
        onClick={() => onChange(round(Math.max(min, value - step)))}
      >
        −
      </button>
      <span className="stepper-value">
        {plateClass && <span className={`h-2 w-2 rounded-full ${plateClass}`} />}
        {value}
        <small>{suffix}</small>
      </span>
      <button
        type="button"
        className="h-7 w-7 rounded-md border border-neutral-400 text-neutral-700 hover:border-neutral-500"
        onClick={() => onChange(round(Math.min(max, value + step)))}
      >
        +
      </button>
    </div>
  )
}
