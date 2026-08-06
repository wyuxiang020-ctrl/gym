import type { ExerciseDetail } from '../../lib/exerciseDetails'
import type { MotionPattern } from '../../lib/exercisePatterns'
import { MOTION_PATTERN_CONFIG } from '../../lib/motionPatternConfig'

interface StepCard {
  type: 'correct' | 'mistake'
  text: string
}

function CardScene({ pattern, type }: { pattern: MotionPattern; type: 'correct' | 'mistake' }) {
  const config = MOTION_PATTERN_CONFIG[pattern]
  const dotColor = type === 'correct' ? 'fill-plate-green' : 'fill-plate-red'

  return (
    <svg viewBox="0 0 100 70" className="h-28 w-full bg-neutral-800">
      <rect x="25" y="50" width="50" height="5" rx="2.5" className="fill-neutral-600" />
      <g style={config.vars as React.CSSProperties} className={config.anim}>
        <circle cx="50" cy="30" r="11" className={dotColor} />
      </g>
    </svg>
  )
}

export function ExerciseStepCards({ detail, pattern }: { detail: ExerciseDetail; pattern: MotionPattern }) {
  const cards: StepCard[] = [
    ...detail.cues.map((c) => ({ type: 'correct' as const, text: c })),
    ...detail.mistakes.map((m) => ({ type: 'mistake' as const, text: m })),
  ]

  return (
    <div className="space-y-1.5">
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
        {cards.map((card, i) => (
          <div
            key={i}
            className="w-52 shrink-0 snap-center overflow-hidden rounded-xl bg-neutral-900 text-white"
          >
            <div className="relative">
              <CardScene pattern={pattern} type={card.type} />
              <span
                className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                  card.type === 'correct' ? 'bg-plate-green' : 'bg-plate-red'
                }`}
              >
                {card.type === 'correct' ? '✓' : '✗'}
              </span>
            </div>
            <p className="p-2.5 text-xs leading-snug">{card.text}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] text-neutral-400">左右滑动查看要点(示意图,非真实视频)</p>
    </div>
  )
}
