import { MealDaySection } from './meal/MealDaySection'
import { WaterSection } from './WaterSection'
import type { Profile } from '../lib/types'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  )
}

export function MealTab({
  date,
  profile,
  weightKg,
  onProfileChange,
}: {
  date: string
  profile: Profile
  weightKg: number | null
  onProfileChange: (profile: Profile) => void
}) {
  return (
    <div className="space-y-8">
      <Section title="今日饮食">
        <MealDaySection date={date} profile={profile} weightKg={weightKg} />
      </Section>

      <Section title="饮水">
        <WaterSection date={date} profile={profile} weightKg={weightKg} onProfileChange={onProfileChange} />
      </Section>
    </div>
  )
}
