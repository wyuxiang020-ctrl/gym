import { useState } from 'react'
import { PlanSection } from './PlanSection'
import { WorkoutSection } from './workout/WorkoutSection'
import { ExerciseLibraryTab } from './workout/ExerciseLibraryTab'
import type { Plan, PlanDay, Profile } from '../lib/types'

const TABS = [
  { key: 'library', label: '动作库' },
  { key: 'plan', label: '训练计划' },
  { key: 'log', label: '训练记录' },
] as const

export function WorkoutTab({
  date,
  profile,
  weightKg,
  plans,
  onCreatePlan,
  onUpdatePlan,
  onSetActivePlan,
  onDeletePlan,
}: {
  date: string
  profile: Profile
  weightKg: number | null
  plans: Plan[]
  onCreatePlan: (plan: { name: string; days: PlanDay[]; isActive?: boolean }) => void
  onUpdatePlan: (id: string, patch: { name: string; days: PlanDay[] }) => void
  onSetActivePlan: (id: string) => void
  onDeletePlan: (id: string) => void
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('log')

  return (
    <div className="space-y-4">
      <header className="page-heading"><p className="eyebrow">专注每一次完成</p><h2>今天，练什么？</h2><div className="training-library-links"><a href="/?equipment-scan=1">扫描器械 ↗</a></div></header>
      <div className="workout-subnav flex gap-2" aria-label="训练栏目">
        {TABS.map((t) => (
          <button
            key={t.key}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 flex-1 rounded-md border text-sm font-medium ${
              tab === t.key ? 'border-primary text-primary' : 'border-neutral-300 text-neutral-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'log' && <WorkoutSection date={date} weightKg={weightKg} plans={plans} />}

      {tab === 'plan' && (
        <PlanSection
          profile={profile}
          plans={plans}
          onCreatePlan={onCreatePlan}
          onUpdatePlan={onUpdatePlan}
          onSetActivePlan={onSetActivePlan}
          onDeletePlan={onDeletePlan}
        />
      )}

      {tab === 'library' && <ExerciseLibraryTab />}
    </div>
  )
}
