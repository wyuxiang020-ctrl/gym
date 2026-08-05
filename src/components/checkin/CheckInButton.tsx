import { useState } from 'react'
import type { CheckInMode } from '../../lib/checkIn'

const INELIGIBLE_HINT: Record<CheckInMode, string | null> = {
  open: null,
  workout: '记录今天的训练后可以打卡',
  workout_and_meal: '记录今天的训练和饮食后可以打卡',
}

const BURST_DOTS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2
  return { x: Math.cos(angle) * 36, y: Math.sin(angle) * 36 }
})

export function CheckInButton({
  checkedIn,
  eligible,
  mode,
  onCheckIn,
}: {
  checkedIn: boolean
  eligible: boolean
  mode: CheckInMode
  onCheckIn: () => void
}) {
  const [celebrating, setCelebrating] = useState(false)

  function handleClick() {
    onCheckIn()
    setCelebrating(true)
    window.setTimeout(() => setCelebrating(false), 650)
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <button
          className={`font-heading min-h-11 w-full rounded-xl text-lg font-semibold transition-colors ${
            checkedIn ? 'animate-pop border-2 border-primary bg-primary/10 text-primary' : ''
          } ${
            checkedIn
              ? ''
              : eligible
                ? 'bg-primary text-white active:bg-primary-dark'
                : 'bg-neutral-200 text-neutral-400'
          }`}
          disabled={checkedIn || !eligible}
          onClick={handleClick}
        >
          {checkedIn ? '今天已打卡 ✓' : '打卡'}
        </button>
        {celebrating && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {BURST_DOTS.map((d, i) => (
              <span
                key={i}
                className="animate-burst absolute h-1.5 w-1.5 rounded-full bg-primary"
                style={{ '--burst-x': `${d.x}px`, '--burst-y': `${d.y}px` } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </div>
      {!checkedIn && !eligible && INELIGIBLE_HINT[mode] && (
        <p className="text-center text-xs text-neutral-500">{INELIGIBLE_HINT[mode]}</p>
      )}
    </div>
  )
}
