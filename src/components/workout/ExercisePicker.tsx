import { useState } from 'react'
import { EXERCISE_LIBRARY } from '../../lib/exerciseLibrary'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'

const CATEGORY_ACTIVE_STYLE: Record<string, string> = {
  胸: 'border-plate-red text-plate-red bg-plate-red/10',
  背: 'border-plate-blue text-plate-blue bg-plate-blue/10',
  肩: 'border-plate-yellow text-plate-yellow bg-plate-yellow/10',
  手臂: 'border-plate-green text-plate-green bg-plate-green/10',
  腿: 'border-plate-gray text-plate-gray bg-plate-gray/10',
  核心: 'border-primary text-primary bg-primary/10',
}

export function ExercisePicker({
  onSelect,
  addLabel = '添加',
  customPlaceholder = '自定义动作名称',
}: {
  onSelect: (name: string) => void
  addLabel?: string
  customPlaceholder?: string
}) {
  const [category, setCategory] = useState(EXERCISE_LIBRARY[0].category)
  const [customName, setCustomName] = useState('')
  const [detailFor, setDetailFor] = useState<string | null>(null)

  return (
    <div className="space-y-2 rounded-lg border border-neutral-300 bg-card p-3">
      <div className="flex gap-1.5 overflow-x-auto">
        {EXERCISE_LIBRARY.map((c) => (
          <button
            key={c.category}
            type="button"
            onClick={() => setCategory(c.category)}
            className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium ${
              category === c.category
                ? (CATEGORY_ACTIVE_STYLE[c.category] ?? 'border-primary text-primary bg-primary/10')
                : 'border-neutral-300 text-neutral-600'
            }`}
          >
            {c.category}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {EXERCISE_LIBRARY.find((c) => c.category === category)?.exercises.map((name) => (
          <div key={name} className="flex min-h-11 items-stretch overflow-hidden rounded-md border border-neutral-300">
            <button
              type="button"
              onClick={() => onSelect(name)}
              className="bg-neutral-100 px-3 text-sm text-neutral-800 active:bg-neutral-200"
            >
              {name}
            </button>
            <button
              type="button"
              onClick={() => setDetailFor(name)}
              className="border-l border-neutral-300 bg-card px-2 text-xs text-neutral-400"
              title="查看动作要领"
            >
              ⓘ
            </button>
          </div>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!customName.trim()) return
          onSelect(customName.trim())
          setCustomName('')
        }}
      >
        <input
          className="flex-1 rounded-md bg-card border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
          placeholder={customPlaceholder}
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
        />
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 text-sm font-medium text-white"
        >
          {addLabel}
        </button>
      </form>

      {detailFor && <ExerciseDetailSheet name={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  )
}
