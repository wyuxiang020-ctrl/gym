import { useEffect, useRef, useState } from 'react'
import type { Plan, PlanDay, Profile } from '../lib/types'
import { defaultPlanName, generatePlanDays } from '../lib/planGenerator'
import { PLAN_TEMPLATES } from '../lib/planTemplates'
import { PlanEditor } from './PlanEditor'

export function PlanSection({
  profile,
  plans,
  onCreatePlan,
  onUpdatePlan,
  onSetActivePlan,
  onDeletePlan,
}: {
  profile: Profile
  plans: Plan[]
  onCreatePlan: (plan: { name: string; days: PlanDay[]; isActive?: boolean }) => void
  onUpdatePlan: (id: string, patch: { name: string; days: PlanDay[] }) => void
  onSetActivePlan: (id: string) => void
  onDeletePlan: (id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(plans.find((p) => p.isActive)?.id ?? null)
  const selected = plans.find((p) => p.id === selectedId) ?? null
  const prevPlanIds = useRef<string[]>(plans.map((p) => p.id))

  useEffect(() => {
    const newPlan = plans.find((p) => !prevPlanIds.current.includes(p.id))
    if (newPlan) setSelectedId(newPlan.id)
    prevPlanIds.current = plans.map((p) => p.id)
  }, [plans])

  function generate() {
    const days = generatePlanDays(profile)
    const name = defaultPlanName(profile)
    onCreatePlan({ name, days, isActive: plans.length === 0 })
  }

  function useTemplate(templateId: string) {
    const template = PLAN_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    onCreatePlan({ name: template.name, days: template.days, isActive: plans.length === 0 })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-medium text-white"
          onClick={generate}
        >
          根据档案生成训练计划
        </button>
        <span className="text-xs text-neutral-500">按规则生成初稿,生成后可完全编辑</span>
      </div>

      <div className="space-y-2 rounded-lg border border-neutral-300 bg-card p-3">
        <p className="text-sm font-medium text-neutral-900">或选择现成模板</p>
        <div className="space-y-2">
          {PLAN_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => useTemplate(t.id)}
              className="min-h-11 w-full rounded-md border border-neutral-300 px-3 py-2 text-left active:bg-neutral-100"
            >
              <div className="text-sm font-medium text-neutral-900">{t.name}</div>
              <div className="text-xs text-neutral-500">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {plans.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`rounded-md px-3 py-1.5 text-xs border ${
                p.id === selectedId
                  ? 'border-primary text-primary'
                  : 'border-neutral-300 text-neutral-600 hover:border-neutral-400'
              }`}
            >
              {p.name}
              {p.isActive && ' ★'}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <PlanEditor
          plan={selected}
          onSave={(patch) => onUpdatePlan(selected.id, patch)}
          onSaveAsNew={(patch) => onCreatePlan(patch)}
          onSetActive={() => onSetActivePlan(selected.id)}
          onDelete={() => {
            onDeletePlan(selected.id)
            setSelectedId(null)
          }}
        />
      )}
    </div>
  )
}
