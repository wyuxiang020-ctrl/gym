import { FlameIcon } from '../icons/FlameIcon'

const MILESTONES = [3, 7, 14, 30, 100]

function flameStyle(streak: number) {
  if (streak <= 0) return { color: 'text-neutral-300', size: 'h-8 w-8', animate: '' }
  if (streak < 7) return { color: 'text-plate-yellow', size: 'h-9 w-9', animate: 'animate-flicker' }
  if (streak < 30) return { color: 'text-primary', size: 'h-10 w-10', animate: 'animate-flicker' }
  return { color: 'text-primary', size: 'h-12 w-12', animate: 'animate-flicker' }
}

export function StreakCard({ streak }: { streak: number }) {
  const flame = flameStyle(streak)

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 text-center shadow-sm">
      <div className="flex items-center justify-center gap-2">
        <FlameIcon className={`${flame.color} ${flame.size} ${flame.animate}`} />
        <div className="font-display text-4xl text-primary">{streak}</div>
      </div>
      <div className="text-xs text-neutral-500">连续打卡天数</div>

      <div className="flex flex-wrap justify-center gap-1.5 pt-1">
        {MILESTONES.map((m) => {
          const reached = streak >= m
          return (
            <span
              key={m}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                reached ? 'border-primary bg-primary/10 text-primary' : 'border-neutral-300 text-neutral-400'
              }`}
            >
              {m} 天
            </span>
          )
        })}
      </div>
    </div>
  )
}
