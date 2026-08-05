import type { FoodItem } from '../../lib/types'
import { AiBadge } from '../AiBadge'

function emptyItem(): FoodItem {
  return { name: '', grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, confidence: 'high' }
}

export function FoodItemsEditor({
  items,
  onChange,
  allowAdd = true,
  aiGenerated = false,
}: {
  items: FoodItem[]
  onChange: (items: FoodItem[]) => void
  allowAdd?: boolean
  aiGenerated?: boolean
}) {
  function update(i: number, patch: Partial<FoodItem>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className={`rounded-md border px-3 py-2 space-y-1.5 ${
            item.confidence === 'low' ? 'border-amber-300 bg-amber-50' : 'border-neutral-300 bg-neutral-100'
          }`}
        >
          <div className="flex items-center gap-2">
            {aiGenerated && <AiBadge />}
            <input
              className="flex-1 bg-transparent text-sm text-neutral-900 outline-none"
              placeholder="食物名称"
              value={item.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                item.confidence === 'low'
                  ? 'bg-amber-100 text-amber-700'
                  : item.confidence === 'mid'
                    ? 'bg-neutral-200 text-neutral-600'
                    : 'bg-primary/10 text-primary'
              }`}
            >
              {item.confidence === 'low' ? '把握低' : item.confidence === 'mid' ? '把握中' : '把握高'}
            </span>
            <button className="text-xs text-neutral-400 hover:text-red-500" onClick={() => remove(i)}>
              ✕
            </button>
          </div>

          <div className="grid grid-cols-5 gap-2 text-xs text-neutral-500">
            <label className="flex flex-col gap-0.5">
              克数
              <input
                type="number"
                className="rounded bg-card border border-neutral-300 px-1.5 py-1 text-neutral-800"
                value={item.grams}
                onChange={(e) => update(i, { grams: Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              kcal
              <input
                type="number"
                className="rounded bg-card border border-neutral-300 px-1.5 py-1 text-neutral-800"
                value={item.kcal}
                onChange={(e) => update(i, { kcal: Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              蛋白质g
              <input
                type="number"
                className="rounded bg-card border border-neutral-300 px-1.5 py-1 text-neutral-800"
                value={item.protein}
                onChange={(e) => update(i, { protein: Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              碳水g
              <input
                type="number"
                className="rounded bg-card border border-neutral-300 px-1.5 py-1 text-neutral-800"
                value={item.carbs}
                onChange={(e) => update(i, { carbs: Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              脂肪g
              <input
                type="number"
                className="rounded bg-card border border-neutral-300 px-1.5 py-1 text-neutral-800"
                value={item.fat}
                onChange={(e) => update(i, { fat: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
      ))}

      {allowAdd && (
        <button
          className="text-xs text-neutral-600 hover:text-neutral-800"
          onClick={() => onChange([...items, emptyItem()])}
        >
          + 添加一项
        </button>
      )}
    </div>
  )
}
