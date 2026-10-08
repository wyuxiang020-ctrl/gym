import { useState } from 'react'
import * as store from '../lib/store'
import type { DayLog, Profile } from '../lib/types'
import { useToast } from '../lib/toast'
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
  const { showToast } = useToast()

  const target = profile.waterTargetMl ?? (weightKg ? Math.round(weightKg * 30) : 2000)

  function add(ml: number) {
    const nextWater = dayLog.water + ml
    if (!Number.isFinite(nextWater) || nextWater > 20_000) {
      showToast('单日饮水记录最多为 20,000 ml')
      return
    }
    store.setWater(date, nextWater)
    setDayLog(store.getDayLog(date))
  }

  function setTarget(ml: number) {
    const updated = { ...profile, waterTargetMl: ml }
    store.saveProfile(updated)
    onProfileChange(updated)
  }

  return <WaterCard waterMl={dayLog.water} targetMl={target} onAdd={add} onSetTarget={setTarget} />
}
