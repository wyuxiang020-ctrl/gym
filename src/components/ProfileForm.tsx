import { useState } from 'react'
import type { Profile } from '../lib/types'
import { isTargetBelowHealthyBmi } from '../lib/calculations'

const ACTIVITY_LABELS: Record<Profile['activityLevel'], string> = {
  1: '1 · 久坐(几乎不运动)',
  2: '2 · 轻度活动(每周 1-3 次)',
  3: '3 · 中度活动(每周 3-5 次)',
  4: '4 · 高度活动(每周 6-7 次)',
  5: '5 · 极高活动(体力劳动 + 高强度训练)',
}

function emptyProfile(): Profile {
  return {
    gender: 'male',
    birthYear: new Date().getFullYear() - 25,
    height: 170,
    experience: 'beginner',
    goal: 'maintain',
    trainingDaysPerWeek: 3,
    activityLevel: 2,
  }
}

export function ProfileForm({
  initial,
  onSave,
}: {
  initial: Profile | null
  onSave: (profile: Profile) => void
}) {
  const [form, setForm] = useState<Profile>(initial ?? emptyProfile())
  const [knowsBodyFat, setKnowsBodyFat] = useState(initial?.targetBodyFat != null)

  const targetWarning =
    form.targetWeight != null && isTargetBelowHealthyBmi(form.targetWeight, form.height)

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(form)
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          性别
          <select
            className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
            value={form.gender}
            onChange={(e) => update('gender', e.target.value as Profile['gender'])}
          >
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          出生年份
          <input
            type="number"
            className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
            value={form.birthYear}
            onChange={(e) => update('birthYear', Number(e.target.value))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          身高 (cm)
          <input
            type="number"
            className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
            value={form.height}
            onChange={(e) => update('height', Number(e.target.value))}
          />
          {initial && <span className="text-xs text-neutral-500">已记录,如有变化可直接修改</span>}
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          训练经验
          <select
            className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
            value={form.experience}
            onChange={(e) => update('experience', e.target.value as Profile['experience'])}
          >
            <option value="beginner">新手</option>
            <option value="intermediate">进阶</option>
            <option value="advanced">资深</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          目标
          <select
            className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
            value={form.goal}
            onChange={(e) => update('goal', e.target.value as Profile['goal'])}
          >
            <option value="cut">减脂</option>
            <option value="bulk">增肌</option>
            <option value="maintain">维持</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          每周训练天数
          <select
            className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
            value={form.trainingDaysPerWeek}
            onChange={(e) => update('trainingDaysPerWeek', Number(e.target.value))}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} 天
              </option>
            ))}
          </select>
        </label>

        <label className="col-span-2 flex flex-col gap-1 text-sm text-neutral-600">
          日常活动量(不含训练)
          <select
            className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
            value={form.activityLevel}
            onChange={(e) => update('activityLevel', Number(e.target.value) as Profile['activityLevel'])}
          >
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <option key={n} value={n}>
                {ACTIVITY_LABELS[n]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3 border-t border-neutral-300 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            目标体重 (kg,可选)
            <input
              type="number"
              className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
              value={form.targetWeight ?? ''}
              onChange={(e) =>
                update('targetWeight', e.target.value === '' ? undefined : Number(e.target.value))
              }
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-neutral-600">
            目标体脂率 (%,可选)
            <div className="flex items-center gap-2">
              <input
                type="number"
                disabled={!knowsBodyFat}
                className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900 disabled:opacity-40"
                value={form.targetBodyFat ?? ''}
                onChange={(e) =>
                  update('targetBodyFat', e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
              <label className="flex items-center gap-1 text-xs text-neutral-500 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={!knowsBodyFat}
                  onChange={(e) => {
                    setKnowsBodyFat(!e.target.checked)
                    if (e.target.checked) update('targetBodyFat', undefined)
                  }}
                />
                不知道
              </label>
            </div>
          </label>
        </div>

        {targetWarning && (
          <p className="text-xs text-amber-700">
            提示:该目标体重对应的 BMI 低于 18.5,这个区间通常不被认为是健康范围。
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          期望身材描述(可选)
          <textarea
            className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
            rows={2}
            value={form.targetNote ?? ''}
            onChange={(e) => update('targetNote', e.target.value || undefined)}
          />
        </label>
      </div>

      <div className="space-y-2 border-t border-neutral-300 pt-4">
        <label className="flex flex-col gap-1 text-sm text-neutral-600">
          打卡定义
          <select
            className="rounded-md bg-card border border-neutral-300 px-3 py-2 text-neutral-900"
            value={form.checkInMode ?? 'open'}
            onChange={(e) => update('checkInMode', e.target.value as Profile['checkInMode'])}
          >
            <option value="open">打开 App 就算</option>
            <option value="workout">记录了训练才算</option>
            <option value="workout_and_meal">记录了训练和饮食才算</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-medium text-white"
      >
        保存档案
      </button>
    </form>
  )
}
