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
    <div className="meal-page space-y-8">
      <header className="page-heading"><p className="eyebrow">训练之外，也照顾自己</p><h2>吃好，再练好。</h2><p>记录今天的饮食与饮水，估算按已有档案计算。</p></header>
      <Section title="今日饮食">
        <MealDaySection date={date} profile={profile} weightKg={weightKg} />
      </Section>

      <Section title="饮水">
        <WaterSection date={date} profile={profile} weightKg={weightKg} onProfileChange={onProfileChange} />
      </Section>
    </div>
  )
}
