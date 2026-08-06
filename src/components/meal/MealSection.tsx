import { useState } from 'react'
import type { FoodItem, Meal } from '../../lib/types'
import { compressForAnalysis, compressForThumb } from '../../lib/imageCompress'
import { defaultSlot, SLOT_LABELS, type Slot } from '../../lib/mealSlot'
import { FoodItemsEditor } from './FoodItemsEditor'
import { RecipeBuilder } from './RecipeBuilder'
import { AiBadge } from '../AiBadge'

async function callParseMeal(text: string) {
  const res = await fetch('/api/parse-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? '解析失败')
  return (body.result?.items ?? []) as Meal['items']
}

async function callAnalyzePhoto(base64: string) {
  const res = await fetch('/api/analyze-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg' }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? '识别失败')
  return (body.result?.items ?? []) as Meal['items']
}

export function MealSection({
  meals,
  onAddMeal,
  onDeleteMeal,
  onUpdateNote,
  onRecalc,
}: {
  meals: Meal[]
  onAddMeal: (meal: Omit<Meal, 'id'>) => void
  onDeleteMeal: (id: string) => void
  onUpdateNote: (id: string, note: string) => void
  onRecalc: (id: string) => void
}) {
  const [tab, setTab] = useState<'text' | 'photo' | 'manual' | 'recipe'>('text')
  const [slot, setSlot] = useState<Slot>(defaultSlot())

  const [text, setText] = useState('')
  const [textItems, setTextItems] = useState<Meal['items'] | null>(null)
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState<string | null>(null)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoThumb, setPhotoThumb] = useState<string | null>(null)
  const [photoApiBase64, setPhotoApiBase64] = useState<string | null>(null)
  const [photoItems, setPhotoItems] = useState<Meal['items'] | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  const [manualItems, setManualItems] = useState<Meal['items']>([])

  async function handleParseText() {
    if (!text.trim()) return
    setTextLoading(true)
    setTextError(null)
    try {
      setTextItems(await callParseMeal(text))
    } catch (err) {
      setTextError(err instanceof Error ? err.message : '解析失败')
    } finally {
      setTextLoading(false)
    }
  }

  function confirmText() {
    if (!textItems) return
    onAddMeal({ slot, rawText: text, items: textItems, confirmed: true })
    setText('')
    setTextItems(null)
  }

  async function handlePhotoSelected(file: File) {
    setPhotoFile(file)
    setPhotoItems(null)
    setPhotoError(null)
    const [thumb, forApi] = await Promise.all([compressForThumb(file), compressForAnalysis(file)])
    setPhotoPreviewUrl(thumb.dataUrl)
    setPhotoThumb(thumb.base64)
    setPhotoApiBase64(forApi.base64)
  }

  async function handleAnalyzePhoto() {
    if (!photoApiBase64) return
    setPhotoLoading(true)
    setPhotoError(null)
    try {
      setPhotoItems(await callAnalyzePhoto(photoApiBase64))
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : '识别失败')
    } finally {
      setPhotoLoading(false)
    }
  }

  function confirmPhoto() {
    if (!photoItems) return
    onAddMeal({ slot, photoThumb: photoThumb ?? undefined, items: photoItems, confirmed: true })
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setPhotoThumb(null)
    setPhotoApiBase64(null)
    setPhotoItems(null)
  }

  function confirmManual() {
    if (manualItems.length === 0) return
    onAddMeal({ slot, items: manualItems, confirmed: true })
    setManualItems([])
  }

  function confirmRecipe(items: FoodItem[]) {
    onAddMeal({ slot, items, confirmed: true })
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-xs text-neutral-600">
        时段
        <select
          className="rounded-md bg-card border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
          value={slot}
          onChange={(e) => setSlot(e.target.value as Slot)}
        >
          {(Object.keys(SLOT_LABELS) as Slot[]).map((s) => (
            <option key={s} value={s}>
              {SLOT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2 text-xs">
        {(['text', 'photo', 'manual', 'recipe'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 border ${
              tab === t ? 'border-primary text-primary' : 'border-neutral-300 text-neutral-600'
            }`}
          >
            {t === 'text' ? '文字记录' : t === 'photo' ? '拍照记录' : t === 'manual' ? '手动添加' : '搭配菜谱'}
          </button>
        ))}
      </div>

      {tab === 'text' && (
        <div className="space-y-2 rounded-lg border border-neutral-300 bg-card p-3">
          <textarea
            className="w-full rounded-md bg-neutral-100 border border-neutral-300 px-3 py-2 text-sm text-neutral-900"
            rows={2}
            placeholder="中午吃了一碗牛肉面加一个卤蛋"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="min-h-11 rounded-md bg-primary hover:bg-primary-dark disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
            disabled={textLoading || !text.trim()}
            onClick={handleParseText}
          >
            {textLoading ? '解析中…' : '解析'}
          </button>
          {textError && <p className="text-xs text-red-500">{textError}</p>}
          {textItems && (
            <div className="space-y-2 border-t border-neutral-300 pt-2">
              <FoodItemsEditor items={textItems} onChange={setTextItems} aiGenerated />
              <button
                className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-medium text-white"
                onClick={confirmText}
              >
                确认写入
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'photo' && (
        <div className="space-y-2 rounded-lg border border-neutral-300 bg-card p-3">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="text-xs text-neutral-600"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handlePhotoSelected(file)
            }}
          />
          {photoPreviewUrl && (
            <img src={photoPreviewUrl} alt="预览" className="h-24 w-24 rounded-md object-cover" />
          )}
          {photoFile && !photoItems && (
            <button
              className="min-h-11 rounded-md bg-primary hover:bg-primary-dark disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
              disabled={photoLoading}
              onClick={handleAnalyzePhoto}
            >
              {photoLoading ? '识别中…' : '识别照片'}
            </button>
          )}
          {photoError && <p className="text-xs text-red-500">{photoError}</p>}
          <p className="text-xs text-neutral-400">拍照估算是粗略参考,和实际可能有明显差距。</p>
          {photoItems && (
            <div className="space-y-2 border-t border-neutral-300 pt-2">
              <FoodItemsEditor items={photoItems} onChange={setPhotoItems} aiGenerated />
              <button
                className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-medium text-white"
                onClick={confirmPhoto}
              >
                确认写入
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'manual' && (
        <div className="space-y-2 rounded-lg border border-neutral-300 bg-card p-3">
          <FoodItemsEditor items={manualItems} onChange={setManualItems} />
          {manualItems.length > 0 && (
            <button
              className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-4 py-2 text-sm font-medium text-white"
              onClick={confirmManual}
            >
              保存这一餐
            </button>
          )}
        </div>
      )}

      {tab === 'recipe' && <RecipeBuilder onAddToMeal={confirmRecipe} />}

      <div className="space-y-2">
        {meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} onDelete={() => onDeleteMeal(meal.id)} onUpdateNote={onUpdateNote} onRecalc={onRecalc} />
        ))}
      </div>
    </div>
  )
}

function MealCard({
  meal,
  onDelete,
  onUpdateNote,
  onRecalc,
}: {
  meal: Meal
  onDelete: () => void
  onUpdateNote: (id: string, note: string) => void
  onRecalc: (id: string) => void
}) {
  const totalKcal = meal.items.reduce((s, i) => s + i.kcal, 0)
  const hasLowConfidence = meal.items.some((i) => i.confidence === 'low')

  return (
    <div className="animate-fade-in rounded-lg border border-neutral-300 bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-900">
          {SLOT_LABELS[meal.slot]} · {totalKcal} kcal
          {(meal.rawText || meal.photoThumb) && <AiBadge />}
        </span>
        <button className="text-xs text-neutral-400 hover:text-red-500" onClick={onDelete}>
          删除
        </button>
      </div>
      <div className="text-xs text-neutral-600">
        {meal.items.map((i) => `${i.name} ${i.grams}g`).join(' · ')}
      </div>
      {hasLowConfidence && (
        <p className="text-xs text-amber-700">部分食物估算把握较低,建议核对克数。</p>
      )}
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1 text-xs text-neutral-800"
          placeholder="备注,如「米饭大概只吃了半碗」"
          value={meal.note ?? ''}
          onChange={(e) => onUpdateNote(meal.id, e.target.value)}
        />
        <button
          className="rounded-md border border-neutral-400 hover:border-neutral-500 px-2 py-1 text-xs text-neutral-700 disabled:opacity-40"
          disabled={!meal.note?.trim()}
          onClick={() => onRecalc(meal.id)}
        >
          按备注重算
        </button>
      </div>
    </div>
  )
}
