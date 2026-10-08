import { useState } from 'react'
import { MeasurementSection } from './MeasurementSection'
import { MeasurementChart } from './MeasurementChart'
import { MetricsPanel } from './MetricsPanel'
import type { Measurement, Profile } from '../lib/types'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  )
}

const TREND_FIELDS: { key: 'weight' | 'bodyFat' | 'waist'; label: string; unit: string }[] = [
  { key: 'weight', label: '体重', unit: 'kg' },
  { key: 'bodyFat', label: '体脂率', unit: '%' },
  { key: 'waist', label: '腰围', unit: 'cm' },
]

function MeasurementTrend({ measurements }: { measurements: Measurement[] }) {
  const [field, setField] = useState<'weight' | 'bodyFat' | 'waist'>('weight')
  const current = TREND_FIELDS.find((f) => f.key === field)!

  return (
    <div className="space-y-3 rounded-lg border border-neutral-300 bg-card p-3">
      <div className="flex gap-1.5">
        {TREND_FIELDS.map((f) => (
          <button
            key={f.key}
            onClick={() => setField(f.key)}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              field === f.key ? 'border-primary text-primary' : 'border-neutral-300 text-neutral-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <MeasurementChart measurements={measurements} field={current.key} label={current.label} unit={current.unit} />
    </div>
  )
}

export function BodyTab({
  profile,
  measurements,
  onEditProfile,
  onAddMeasurement,
  onDeleteMeasurementAt,
}: {
  profile: Profile
  measurements: Measurement[]
  onEditProfile: () => void
  onAddMeasurement: (m: Measurement) => void
  onDeleteMeasurementAt: (index: number) => void
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">身体档案</h2>
        <button className="text-sm text-primary" onClick={onEditProfile}>
          编辑档案
        </button>
      </div>

      <Section title="估算指标">
        <MetricsPanel profile={profile} measurements={measurements} />
      </Section>

      <Section title="身体维度趋势">
        <MeasurementTrend measurements={measurements} />
      </Section>

      <Section title="身体测量">
        <MeasurementSection measurements={measurements} onAdd={onAddMeasurement} onDeleteAt={onDeleteMeasurementAt} />
      </Section>
    </div>
  )
}
