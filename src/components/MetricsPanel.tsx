import type { Measurement, Profile } from '../lib/types'
import {
  calcAge,
  calcBMI,
  calcBMR,
  calcTDEE,
  calcWaistToHeightRatio,
  calcWeeklyWeightChangePercent,
  isLossRateTooFast,
  isTargetBelowHealthyBmi,
} from '../lib/calculations'

function latestWithField<K extends keyof Measurement>(
  measurements: Measurement[],
  field: K,
): Measurement | null {
  const withField = measurements
    .filter((m) => m[field] != null)
    .sort((a, b) => b.date.localeCompare(a.date))
  return withField[0] ?? null
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-neutral-300 bg-card px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-display text-2xl text-neutral-900">
        {value}
        {unit && <span className="ml-1 text-sm font-sans font-normal normal-case tracking-normal text-neutral-500">{unit}</span>}
      </div>
    </div>
  )
}

const BMI_BRACKETS = [
  { label: '偏瘦', range: '< 18.5', test: (v: number) => v < 18.5 },
  { label: '正常', range: '18.5 - 23.9', test: (v: number) => v >= 18.5 && v < 24 },
  { label: '超重', range: '24.0 - 27.9', test: (v: number) => v >= 24 && v < 28 },
  { label: '肥胖', range: '≥ 28.0', test: (v: number) => v >= 28 },
]

function BmiReferenceTable({ bmi }: { bmi: number }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-neutral-500">
          <th className="py-1 font-normal">分类</th>
          <th className="py-1 font-normal">BMI 区间(中国成人标准)</th>
        </tr>
      </thead>
      <tbody>
        {BMI_BRACKETS.map((b) => (
          <tr key={b.label} className={`border-t border-neutral-200 ${b.test(bmi) ? 'bg-neutral-100' : ''}`}>
            <td className="py-1 text-neutral-800">{b.label}</td>
            <td className="py-1 text-neutral-800">{b.range}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function MetricsPanel({
  profile,
  measurements,
}: {
  profile: Profile
  measurements: Measurement[]
}) {
  const latestWeightM = latestWithField(measurements, 'weight')
  const latestWaistM = latestWithField(measurements, 'waist')
  const age = calcAge(profile.birthYear)

  const weeklyChange = calcWeeklyWeightChangePercent(measurements)
  const lossTooFast = isLossRateTooFast(weeklyChange)
  const targetTooLow =
    profile.targetWeight != null && isTargetBelowHealthyBmi(profile.targetWeight, profile.height)

  if (!latestWeightM?.weight) {
    return (
      <p className="text-sm text-neutral-500">添加一条包含体重的测量记录后,这里会显示估算指标。</p>
    )
  }

  const weight = latestWeightM.weight
  const bmi = calcBMI(weight, profile.height)
  const bmr = calcBMR({ gender: profile.gender, weightKg: weight, heightCm: profile.height, age })
  const tdee = calcTDEE(bmr, profile.activityLevel)
  const waistRatio =
    latestWaistM?.waist != null ? calcWaistToHeightRatio(latestWaistM.waist, profile.height) : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="BMI" value={bmi.toFixed(1)} />
        <Stat label="BMR(基础代谢)" value={Math.round(bmr).toString()} unit="kcal/天" />
        <Stat label="TDEE(每日总消耗)" value={Math.round(tdee).toString()} unit="kcal/天" />
        {waistRatio != null && <Stat label="腰高比" value={waistRatio.toFixed(2)} />}
      </div>

      <div className="space-y-1 text-xs text-neutral-500">
        <p>以上均为估算值。BMR 公式(Mifflin-St Jeor)的个体误差可达 ±15%。</p>
        <p>BMI 是粗略指标,不区分肌肉和脂肪。</p>
        {waistRatio == null && <p>添加一条包含腰围的测量记录后可显示腰高比,它比 BMI 更能反映腹部脂肪。</p>}
      </div>

      <BmiReferenceTable bmi={bmi} />

      {(targetTooLow || lossTooFast) && (
        <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {targetTooLow && <p>目标体重对应的 BMI 低于 18.5,这个区间通常不被认为是健康范围。</p>}
          {lossTooFast && <p>最近的体重变化速度超过体重的 1%/周,如果是主动减脂,速度偏快。</p>}
        </div>
      )}
    </div>
  )
}
