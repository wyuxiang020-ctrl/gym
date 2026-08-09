const FUR = '#C05B26' // 红棕色毛发
const FUR_DARK = '#8A3E19' // 深色斑纹
const CREAM = '#FBF1DE' // 奶白色面部/腹部
const INK = '#3A2417' // 眼鼻黑色

function Tail({ rings = 3 }: { rings?: number }) {
  // 环纹尾巴:一个红棕色底,叠加几条奶白色环纹
  return (
    <g>
      <path d="M70 66 Q92 60 90 40 Q88 24 72 24 Q80 34 76 46 Q73 58 70 66 Z" fill={FUR} />
      {Array.from({ length: rings }).map((_, i) => (
        <ellipse
          key={i}
          cx={82 - i * 5}
          cy={30 + i * 9}
          rx="4.5"
          ry="7"
          fill={CREAM}
          opacity="0.9"
          transform={`rotate(${-40 + i * 10} ${82 - i * 5} ${30 + i * 9})`}
        />
      ))}
    </g>
  )
}

export function PetMascot({ level, className }: { level: number; className?: string }) {
  if (level === 0) {
    // 幼崽:蜷缩睡觉的小团子
    return (
      <svg viewBox="0 0 100 100" className={className}>
        <path d="M22 62 Q14 42 32 36 Q42 33 40 48 Q38 58 28 60 Q34 66 22 62Z" fill={FUR} />
        <ellipse cx="52" cy="62" rx="28" ry="24" fill={FUR} />
        <ellipse cx="52" cy="68" rx="15" ry="12" fill={CREAM} />
        <path d="M42 58q3-3 6 0M56 58q3-3 6 0" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx="30" cy="30" r="7" fill={FUR} />
        <circle cx="30" cy="31" r="3.5" fill={CREAM} />
      </svg>
    )
  }

  const headR = 17 + level
  const bodyRx = 22 + level * 1.5
  const bodyRy = 20 + level

  return (
    <svg viewBox="0 0 100 100" className={className}>
      {level >= 4 && <circle cx="52" cy="58" r="44" fill={FUR} opacity="0.08" />}

      <Tail rings={Math.min(4, level + 1)} />

      {/* 身体 */}
      <ellipse cx="48" cy={64} rx={bodyRx} ry={bodyRy} fill={FUR} />
      <ellipse cx="48" cy={70} rx={bodyRx * 0.5} ry={bodyRy * 0.5} fill={CREAM} />

      {/* 头 */}
      <circle cx="48" cy="36" r={headR} fill={FUR} />
      <ellipse cx="48" cy="40" rx={headR * 0.72} ry={headR * 0.62} fill={CREAM} />

      {/* 耳朵 */}
      <circle cx="34" cy="20" r="8" fill={FUR} />
      <circle cx="34" cy="21.5" r="4" fill={CREAM} />
      <circle cx="62" cy="20" r="8" fill={FUR} />
      <circle cx="62" cy="21.5" r="4" fill={CREAM} />

      {/* 眼周斑纹 */}
      <path d="M36 34 Q40 30 44 36 Q40 42 36 34Z" fill={FUR_DARK} />
      <path d="M60 34 Q56 30 52 36 Q56 42 60 34Z" fill={FUR_DARK} />

      {/* 五官 */}
      <circle cx="42" cy="37" r="2.4" fill={INK} />
      <circle cx="54" cy="37" r="2.4" fill={INK} />
      <ellipse cx="48" cy="44" rx="2.6" ry="1.8" fill={INK} />
      <path d="M43 47q5 4 10 0" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />

      {level >= 3 && (
        <path
          d="M46 12l2 5 5 .7-3.6 3.5.9 5-4.3-2.3-4.3 2.3.9-5-3.6-3.5 5-.7z"
          fill="#EAB308"
        />
      )}
    </svg>
  )
}
