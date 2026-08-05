type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function TodayIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  )
}

export function WorkoutIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 12h2M20 12h2" />
      <path d="M6 12h12" />
      <rect x="4" y="9" width="3" height="6" rx="1" />
      <rect x="17" y="9" width="3" height="6" rx="1" />
    </svg>
  )
}

export function MealIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 12h16a8 6 0 0 1-16 0z" />
      <path d="M12 12V7" />
      <path d="M11 3.5c.8-.8 1.2.8.5 1.5" />
    </svg>
  )
}

export function BodyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M7 21l1.5-9M17 21l-1.5-9M6 12l1-4.2a1 1 0 0 1 1-.8h8a1 1 0 0 1 1 .8l1 4.2z" />
    </svg>
  )
}

export function RecordsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  )
}
