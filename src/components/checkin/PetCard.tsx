import { useState } from 'react'
import { currentPetLevel, nextPetLevel, PET_LEVELS } from '../../lib/pet'
import { PetMascot } from '../icons/PetMascot'

const FEED_BURST = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2
  return { x: Math.cos(angle) * 28, y: Math.sin(angle) * 28 - 10 }
})

export function PetCard({ totalVolume }: { totalVolume: number }) {
  const [feeding, setFeeding] = useState(false)
  const level = currentPetLevel(totalVolume)
  const next = nextPetLevel(totalVolume)

  const progress = next
    ? Math.min(100, Math.round(((totalVolume - level.minVolume) / (next.minVolume - level.minVolume)) * 100))
    : 100

  function feed() {
    setFeeding(true)
    window.setTimeout(() => setFeeding(false), 600)
  }

  return (
    <div className="space-y-2 rounded-xl bg-card p-4 text-center shadow-sm">
      <div className="relative mx-auto h-24 w-24">
        <PetMascot level={level.level} className={`h-24 w-24 ${feeding ? 'animate-pop' : 'animate-bounce'}`} />
        {feeding && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {FEED_BURST.map((d, i) => (
              <span
                key={i}
                className="animate-burst absolute h-1.5 w-1.5 rounded-full bg-plate-yellow"
                style={{ '--burst-x': `${d.x}px`, '--burst-y': `${d.y}px` } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </div>

      <div className="font-heading text-sm text-neutral-900">{level.name}</div>
      <div className="text-xs text-neutral-500">
        历史训练容量 {totalVolume.toLocaleString()} kg·次
        {next && ` · 还差 ${(next.minVolume - totalVolume).toLocaleString()} 长大成「${next.name}」`}
      </div>

      {next && (
        <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      <button
        onClick={feed}
        className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 text-sm font-medium text-white"
      >
        投喂
      </button>
      <p className="text-[10px] text-neutral-400">
        {PET_LEVELS.map((l) => l.name).join(' → ')} · 练得越多,宠物长得越大
      </p>
    </div>
  )
}
