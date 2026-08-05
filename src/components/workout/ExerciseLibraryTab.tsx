import { useState } from 'react'
import { EXERCISE_LIBRARY } from '../../lib/exerciseLibrary'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'

export function ExerciseLibraryTab() {
  const [category, setCategory] = useState(EXERCISE_LIBRARY[0].category)
  const [query, setQuery] = useState('')
  const [detailFor, setDetailFor] = useState<string | null>(null)

  const exercises = query.trim()
    ? EXERCISE_LIBRARY.flatMap((c) => c.exercises).filter((name) => name.includes(query.trim()))
    : (EXERCISE_LIBRARY.find((c) => c.category === category)?.exercises ?? [])

  return (
    <div className="space-y-3">
      <input
        className="w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm text-neutral-900"
        placeholder="搜索动作名称"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!query.trim() && (
        <div className="flex gap-1.5 overflow-x-auto">
          {EXERCISE_LIBRARY.map((c) => (
            <button
              key={c.category}
              onClick={() => setCategory(c.category)}
              className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium ${
                category === c.category ? 'border-primary text-primary bg-primary/10' : 'border-neutral-300 text-neutral-600'
              }`}
            >
              {c.category}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {exercises.map((name) => (
          <button
            key={name}
            onClick={() => setDetailFor(name)}
            className="min-h-11 rounded-lg border border-neutral-300 bg-card px-3 text-left text-sm text-neutral-800 active:bg-neutral-100"
          >
            {name}
          </button>
        ))}
        {exercises.length === 0 && <p className="col-span-2 text-sm text-neutral-500">没有找到匹配的动作。</p>}
      </div>

      {detailFor && <ExerciseDetailSheet name={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  )
}
