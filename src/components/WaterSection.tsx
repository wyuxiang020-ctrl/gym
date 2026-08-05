import { useState } from 'react'
import * as store from '../lib/store'
import type { DayLog, Profile } from '../lib/types'
import { WaterCard } from './WaterCard'

export function WaterSection({
  date,
  profile,
  weightKg,
  onProfileChange,
}: {
  date: string
  profile: Profile
  weightKg: number | null
  onProfileChange: (profile: Profile) => void
}) {
  const [dayLog, setDayLog] = useState<DayLog>(() => store.getDayLog(date))

  const target = profile.waterTargetMl ?? (weightKg ? Math.round(weightKg * 30) : 2000)

  function add(ml: number) {
    store.setWater(date, dayLog.water + ml)
    setDayLog(store.getDayLog(date))
  }

  function setTarget(ml: number) {
    const updated = { ...profile, waterTargetMl: ml }
    store.saveProfile(updated)
    onProfileChange(updated)
  }

  return <WaterCard waterMl={dayLog.water} targetMl={target} onAdd={add} onSetTarget={setTarget} />
}
