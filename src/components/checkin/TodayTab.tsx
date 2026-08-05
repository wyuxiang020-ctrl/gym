import { useEffect, useState } from 'react'
import * as store from '../../lib/store'
import type { DayLog, Profile } from '../../lib/types'
import { calcStreak, checkInEligible, type CheckInMode } from '../../lib/checkIn'
import { totalLifetimeVolume } from '../../lib/pet'
import { CheckInButton } from './CheckInButton'
import { MonthHeatmap } from './MonthHeatmap'
import { StreakCard } from './StreakCard'
import { PetCard } from './PetCard'

function emptyDayLog(date: string): DayLog {
  return { date, checkedIn: false, strength: [], cardio: [], meals: [], water: 0 }
}

export function TodayTab({ date, profile }: { date: string; profile: Profile }) {
  const mode: CheckInMode = profile.checkInMode ?? 'open'
  const [dayLogs, setDayLogs] = useState<Record<string, DayLog>>(() => store.getDayLogsMap())
  const todayLog = dayLogs[date] ?? emptyDayLog(date)

  useEffect(() => {
    if (mode === 'open' && !todayLog.checkedIn) {
      store.setCheckedIn(date, true)
      setDayLogs(store.getDayLogsMap())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, mode])

  function checkIn() {
    store.setCheckedIn(date, true)
    setDayLogs(store.getDayLogsMap())
  }

  const eligible = checkInEligible(todayLog, mode)
  const streak = calcStreak(dayLogs, date)
  const totalVolume = totalLifetimeVolume(dayLogs)

  return (
    <div className="space-y-5">
      <CheckInButton checkedIn={todayLog.checkedIn} eligible={eligible} mode={mode} onCheckIn={checkIn} />

      <PetCard totalVolume={totalVolume} />

      <StreakCard streak={streak} />

      <div className="rounded-xl bg-card p-3 shadow-sm">
        <MonthHeatmap dayLogs={dayLogs} today={date} />
      </div>
    </div>
  )
}
