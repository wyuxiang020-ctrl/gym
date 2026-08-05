import { useRef, useState } from 'react'

export function WaterCard({
  waterMl,
  targetMl,
  onAdd,
  onSetTarget,
}: {
  waterMl: number
  targetMl: number
  onAdd: (ml: number) => void
  onSetTarget: (ml: number) => void
}) {
  const [showCustomAmount, setShowCustomAmount] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState(String(targetMl))
  const longPressTimer = useRef<number | null>(null)
  const longPressTriggered = useRef(false)

  function startPress() {
    longPressTriggered.current = false
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true
      setShowCustomAmount(true)
    }, 500)
  }

  function endPress() {
    if (longPressTimer.current != null) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handleClick() {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      return
    }
    onAdd(250)
  }

  const pct = targetMl > 0 ? Math.min(100, Math.round((waterMl / targetMl) * 100)) : 0

  return (
    <div className="rounded-lg border border-neutral-300 bg-card p-3 space-y-2">
      <div className="flex items-center justify-between text-sm text-neutral-800">
        <span>饮水</span>
        {editingTarget ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              const v = Number(targetInput)
              if (v > 0) onSetTarget(v)
              setEditingTarget(false)
            }}
          >
            <input
              className="w-20 rounded-md bg-neutral-100 border border-neutral-300 px-2 py-0.5 text-xs text-neutral-900"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="text-xs text-primary">
              保存
            </button>
          </form>
        ) : (
          <button
            className="text-neutral-500 hover:text-neutral-700"
            onClick={() => {
              setTargetInput(String(targetMl))
              setEditingTarget(true)
            }}
          >
            {waterMl} / {targetMl} ml
          </button>
        )}
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-plate-blue), var(--color-primary))' }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-3 py-1.5 text-sm text-white select-none"
          onMouseDown={startPress}
          onMouseUp={endPress}
          onMouseLeave={endPress}
          onTouchStart={startPress}
          onTouchEnd={endPress}
          onClick={handleClick}
        >
          +250ml
        </button>
        <span className="text-xs text-neutral-400">长按自定义</span>
      </div>

      {showCustomAmount && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = Number(customAmount)
            if (v > 0) onAdd(v)
            setCustomAmount('')
            setShowCustomAmount(false)
          }}
        >
          <input
            type="number"
            autoFocus
            className="w-24 rounded-md bg-neutral-100 border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
            placeholder="ml"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
          />
          <button type="submit" className="rounded-md border border-neutral-400 px-2 py-1 text-xs text-neutral-800">
            添加
          </button>
        </form>
      )}
    </div>
  )
}
