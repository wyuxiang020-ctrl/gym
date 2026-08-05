const LEVEL_COLOR: Record<number, string> = {
  0: 'fill-neutral-300',
  1: 'fill-plate-yellow',
  2: 'fill-plate-green',
  3: 'fill-plate-blue',
  4: 'fill-primary',
}

export function PetMascot({ level, className }: { level: number; className?: string }) {
  const color = LEVEL_COLOR[level] ?? 'fill-neutral-300'

  if (level === 0) {
    // 蛋:没有四肢,闭眼睡觉
    return (
      <svg viewBox="0 0 100 100" className={className}>
        <ellipse cx="50" cy="55" rx="32" ry="38" className={color} />
        <path d="M35 55q3-4 6 0" stroke="#00000055" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M59 55q3-4 6 0" stroke="#00000055" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    )
  }

  const hasHorns = level >= 2
  const hasAura = level >= 4
  const eyeShape =
    level >= 3 ? (
      <>
        <path d="M36 50l7-4M57 46l7 4" stroke="#00000066" strokeWidth="3" strokeLinecap="round" />
        <circle cx="40" cy="54" r="4" fill="#00000088" />
        <circle cx="61" cy="54" r="4" fill="#00000088" />
      </>
    ) : (
      <>
        <circle cx="40" cy="52" r="5" fill="#00000088" />
        <circle cx="61" cy="52" r="5" fill="#00000088" />
      </>
    )

  return (
    <svg viewBox="0 0 100 100" className={className}>
      {hasAura && <circle cx="50" cy="58" r="44" className="fill-primary/10" />}
      {/* 耳朵/四肢 */}
      <ellipse cx="22" cy="70" rx="9" ry="13" className={color} />
      <ellipse cx="78" cy="70" rx="9" ry="13" className={color} />
      {hasHorns && (
        <>
          <path d="M38 26l-4-10" stroke="currentColor" className="text-neutral-500" strokeWidth="3" strokeLinecap="round" />
          <path d="M62 26l4-10" stroke="currentColor" className="text-neutral-500" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {/* 身体 */}
      <ellipse cx="50" cy="58" rx="30" ry="32" className={color} />
      {eyeShape}
      <path d="M42 66q8 6 16 0" stroke="#00000066" strokeWidth="3" fill="none" strokeLinecap="round" />
      {level >= 4 && (
        <path d="M45 20l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z" className="fill-plate-yellow" />
      )}
    </svg>
  )
}
