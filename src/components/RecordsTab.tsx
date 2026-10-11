import { useRef, useState } from 'react'
import * as store from '../lib/store'
import type { DayLog } from '../lib/types'
import { dayVolume } from '../lib/checkIn'
import { confirmedMissingWeight, validCompletedSet } from '../lib/strength'

interface PendingImport {
  fileName: string
  json: string
}

export function RecordsTab({ onImportSuccess, initialDate }: { onImportSuccess?: () => void; initialDate?: string }) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [dayLogs, setDayLogs] = useState<Record<string, DayLog>>(() => store.getDayLogsMap())
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const storageIssue = store.getStorageIssue()

  const sortedDates = Object.keys(dayLogs).sort((a, b) => b.localeCompare(a))

  function handleImportFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setPendingImport(null)
      setImportMsg('导入失败：备份文件不能超过 10 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = String(reader.result)
        store.validateImportData(json)
        setPendingImport({ fileName: file.name, json })
        setImportMsg(null)
      } catch (error) {
        setPendingImport(null)
        const detail = error instanceof Error ? error.message : '文件格式不对'
        setImportMsg(`导入失败:${detail}`)
      }
    }
    reader.readAsText(file)
  }

  function confirmImport() {
    if (!pendingImport) return
    try {
      store.downloadExport(`gym-data-before-import-${new Date().getTime()}.json`)
      store.importData(pendingImport.json)
      setDayLogs(store.getDayLogsMap())
      setPendingImport(null)
      setImportMsg('导入成功。替换前的数据已下载为安全备份，应用已载入新数据。')
      onImportSuccess?.()
    } catch (error) {
      const detail = error instanceof Error ? error.message : '文件格式不对'
      setImportMsg(`导入失败:${detail}`)
    }
  }

  return (
    <div className="records-page space-y-6">
      <header className="page-heading"><p className="eyebrow">记录进步</p><h2>每一组，都算数。</h2><p>查看实际保存的训练与饮食记录。</p></header>
      {selectedDate && <section className="selected-record" aria-label="所选日期记录"><div className="section-heading"><h3>{selectedDate}</h3><button onClick={() => setSelectedDate(undefined)}>查看全部日期</button></div><p>{dayLogs[selectedDate] ? `力量 ${dayLogs[selectedDate].strength.length} 项 · 有氧 ${dayLogs[selectedDate].cardio.length} 项 · 已完成力量 ${dayLogs[selectedDate].strength.flatMap(entry => entry.sets).filter(validCompletedSet).length} 组` : '这天还没有记录。完成训练后，记录会出现在这里。'}</p></section>}
      <details className="backup-panel space-y-2" open>
        <summary>数据备份 <span>导出 / 导入 JSON</span></summary>
        {storageIssue && (
          <div className="space-y-1 rounded-lg border border-red-300 bg-red-50 p-3" role="alert">
            <p className="text-sm font-medium text-red-800">已保护原始数据,当前暂停写入</p>
            <p className="text-xs text-red-700">
              {storageIssue}。原始 JSON 仍保存在浏览器中,请先点“导出 JSON”备份,再导入一份有效文件。
            </p>
          </div>
        )}
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
              e.currentTarget.value = ''
            }}
          />
        </div>
        {pendingImport && (
          <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3" role="alert">
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900">确认替换当前数据？</p>
              <p className="break-all text-xs text-amber-800">
                已验证「{pendingImport.fileName}」格式有效。继续后会替换当前全部数据，并先自动下载一份当前数据作为安全备份。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-11 rounded-md bg-amber-700 px-3 text-sm font-medium text-white"
                onClick={confirmImport}
              >
                下载安全备份并导入
              </button>
              <button
                className="min-h-11 rounded-md border border-amber-400 px-3 text-sm text-amber-900"
                onClick={() => setPendingImport(null)}
              >
                取消
              </button>
            </div>
          </div>
        )}
        {importMsg && <p className="text-xs text-neutral-500">{importMsg}</p>}
      </details>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">历史记录</h2>
        {sortedDates.length === 0 && <p className="text-sm text-neutral-500">还没有记录。</p>}
        <div className="space-y-1.5">
          {sortedDates.filter(date => !selectedDate || date === selectedDate).map((date) => {
            const log = dayLogs[date]
            const vol = dayVolume(log)
            const missingCount = log.strength.flatMap(entry => entry.sets).filter(set => validCompletedSet(set) && confirmedMissingWeight(set)).length
            return (
              <details key={date} className="history-entry rounded-lg border border-neutral-200 bg-card px-3 py-2 text-sm" open={date === selectedDate || undefined}>
                <summary aria-label={`展开 ${date} 记录`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900">{date}</span>
                  {log.checkedIn && <span className="text-xs text-primary">已打卡</span>}
                </div>
                </summary>
                <div className="text-xs text-neutral-500">
                  力量 {log.strength.length} 项 · 有氧 {log.cardio.length} 项 · 饮食 {log.meals.length} 餐 · 已知重量容量{' '}
                  {vol} kg·次
                </div>
                {missingCount > 0 && <p className="text-xs text-amber-800">{missingCount} 组已完成但重量未记录，未计入容量；此数值不是完整训练总量。</p>}
                <ul className="history-details">{log.strength.map(entry => <li key={entry.id}><strong>{entry.name}</strong><span>{entry.sets.filter(validCompletedSet).length} / {entry.sets.length} 组完成</span></li>)}{log.cardio.map(entry => <li key={entry.id}><strong>{entry.type}</strong><span>{entry.minutes} 分钟 · {entry.done === false ? '待完成' : '已记录'}</span></li>)}</ul>
              </details>
            )
          })}
        </div>
      </section>
    </div>
  )
}
