import type { DayLog } from '../../lib/types'
import { dayVolume, hasAnyRecord } from '../../lib/checkIn'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function MonthHeatmap({ dayLogs, today }: { dayLogs: Record<string, DayLog>; today: string }) {
  const [year, month] = today.split('-').map(Number)
  const startWeekday = new Date(year, month - 1, 1).getDay()
  const numDays = new Date(year, month, 0).getDate()

  const dateKeys = Array.from({ length: numDays }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`)
  const maxVolume = Math.max(1, ...dateKeys.map((k) => dayVolume(dayLogs[k])))

  const cells: (string | null)[] = [...Array(startWeekday).fill(null), ...dateKeys]

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateKey, i) => {
          if (!dateKey) return <div key={i} />
          const log = dayLogs[dateKey]
          const record = hasAnyRecord(log)
          const vol = dayVolume(log)
          const opacity = record ? Math.max(0.18, vol / maxVolume) : 0
          const isToday = dateKey === today
          const day = Number(dateKey.slice(-2))
          return (
            <div
              key={dateKey}
              className={`flex aspect-square items-center justify-center rounded-md border text-[11px] ${
                isToday ? 'border-primary' : 'border-neutral-200'
              }`}
              style={record ? { background: `rgba(200,16,46,${opacity})` } : { background: '#fff' }}
            >
              <span className={record && opacity > 0.55 ? 'text-white' : 'text-neutral-500'}>{day}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
