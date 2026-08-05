import { useRef, useState } from 'react'
import * as store from '../lib/store'
import type { DayLog } from '../lib/types'
import { dayVolume } from '../lib/checkIn'

export function RecordsTab() {
  const [dayLogs] = useState<Record<string, DayLog>>(() => store.getDayLogsMap())
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sortedDates = Object.keys(dayLogs).sort((a, b) => b.localeCompare(a))

  function handleImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        store.importData(String(reader.result))
        setImportMsg('导入成功,刷新页面查看')
      } catch {
        setImportMsg('导入失败,文件格式不对')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">数据备份</h2>
        <div className="flex gap-2">
          <button
            className="min-h-11 flex-1 rounded-lg border border-neutral-300 bg-card text-sm text-neutral-700"
            onClick={() => store.downloadExport()}
          >
            导出 JSON
          </button>
          <button
            className="min-h-11 flex-1 rounded-lg border border-neutral-300 bg-card text-sm text-neutral-700"
            onClick={() => fileInputRef.current?.click()}
          >
            导入 JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImportFile(f)
            }}
          />
        </div>
        {importMsg && <p className="text-xs text-neutral-500">{importMsg}</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">历史记录</h2>
        {sortedDates.length === 0 && <p className="text-sm text-neutral-500">还没有记录。</p>}
        <div className="space-y-1.5">
          {sortedDates.map((date) => {
            const log = dayLogs[date]
            const vol = dayVolume(log)
            return (
              <div key={date} className="rounded-lg border border-neutral-200 bg-card px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900">{date}</span>
                  {log.checkedIn && <span className="text-xs text-primary">已打卡</span>}
                </div>
                <div className="text-xs text-neutral-500">
                  力量 {log.strength.length} 项 · 有氧 {log.cardio.length} 项 · 饮食 {log.meals.length} 餐 · 容量{' '}
                  {vol} kg·次
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
