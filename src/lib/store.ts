import type {
  CardioEntry,
  DayLog,
  GymData,
  Meal,
  Measurement,
  Plan,
  PlanDay,
  Profile,
  StrengthEntry,
} from './types'
import { todayStr } from './date'

const STORAGE_KEY = 'gym-data-v1'

function emptyData(): GymData {
  return { profile: null, measurements: [], plans: [], dayLogs: {}, exerciseVideos: {} }
}

function read(): GymData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyData()
  try {
    const parsed = JSON.parse(raw) as Partial<GymData>
    return {
      profile: parsed.profile ?? null,
      measurements: parsed.measurements ?? [],
      plans: parsed.plans ?? [],
      dayLogs: parsed.dayLogs ?? {},
      exerciseVideos: parsed.exerciseVideos ?? {},
    }
  } catch {
    return emptyData()
  }
}

function write(data: GymData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function newId() {
  return crypto.randomUUID()
}

function emptyDayLog(date: string): DayLog {
  return {
    date,
    checkedIn: false,
    strength: [],
    cardio: [],
    meals: [],
    water: 0,
  }
}

// ---- Profile ----

export function getProfile(): Profile | null {
  return read().profile
}

export function saveProfile(profile: Profile) {
  const data = read()
  data.profile = profile
  write(data)
}

// ---- Measurements ----

export function getMeasurements(): Measurement[] {
  return read().measurements
}

export function addMeasurement(m: Measurement) {
  const data = read()
  data.measurements.push(m)
  write(data)
}

export function updateMeasurementAt(index: number, patch: Partial<Measurement>) {
  const data = read()
  if (!data.measurements[index]) return
  data.measurements[index] = { ...data.measurements[index], ...patch }
  write(data)
}

export function deleteMeasurementAt(index: number) {
  const data = read()
  data.measurements.splice(index, 1)
  write(data)
}

// ---- Plans ----

export function getPlans(): Plan[] {
  return read().plans
}

export function getActivePlan(): Plan | null {
  return read().plans.find((p) => p.isActive) ?? null
}

export function addPlan(plan: { name: string; days: PlanDay[]; isActive?: boolean }): Plan {
  const data = read()
  const newPlan: Plan = {
    id: newId(),
    createdAt: new Date().toISOString(),
    name: plan.name,
    days: plan.days,
    isActive: plan.isActive ?? false,
  }
  if (newPlan.isActive) {
    data.plans.forEach((p) => (p.isActive = false))
  }
  data.plans.push(newPlan)
  write(data)
  return newPlan
}

export function updatePlan(id: string, patch: Partial<Omit<Plan, 'id'>>) {
  const data = read()
  const idx = data.plans.findIndex((p) => p.id === id)
  if (idx === -1) return
  data.plans[idx] = { ...data.plans[idx], ...patch }
  write(data)
}

export function setActivePlan(id: string) {
  const data = read()
  data.plans.forEach((p) => (p.isActive = p.id === id))
  write(data)
}

export function deletePlan(id: string) {
  const data = read()
  data.plans = data.plans.filter((p) => p.id !== id)
  write(data)
}

// ---- Day logs ----

export function getDayLog(date: string): DayLog {
  return read().dayLogs[date] ?? emptyDayLog(date)
}

export function getAllDayLogs(): DayLog[] {
  return Object.values(read().dayLogs)
}

export function getDayLogsMap(): Record<string, DayLog> {
  return read().dayLogs
}

function getOrCreateDayLog(data: GymData, date: string): DayLog {
  if (!data.dayLogs[date]) {
    data.dayLogs[date] = emptyDayLog(date)
  }
  return data.dayLogs[date]
}

export function setCheckedIn(date: string, checkedIn: boolean) {
  const data = read()
  const log = getOrCreateDayLog(data, date)
  log.checkedIn = checkedIn
  write(data)
}

export function setWater(date: string, water: number) {
  const data = read()
  const log = getOrCreateDayLog(data, date)
  log.water = water
  write(data)
}

export function updateDayLogMeta(date: string, patch: Partial<Pick<DayLog, 'bodyNote' | 'mood'>>) {
  const data = read()
  const log = getOrCreateDayLog(data, date)
  Object.assign(log, patch)
  write(data)
}

export function addStrengthEntry(date: string, entry: Omit<StrengthEntry, 'id'>): StrengthEntry {
  const data = read()
  const log = getOrCreateDayLog(data, date)
  const full: StrengthEntry = { ...entry, id: newId() }
  log.strength.push(full)
  write(data)
  return full
}

export function updateStrengthEntry(date: string, id: string, patch: Partial<Omit<StrengthEntry, 'id'>>) {
  const data = read()
  const log = data.dayLogs[date]
  if (!log) return
  const idx = log.strength.findIndex((s) => s.id === id)
  if (idx === -1) return
  log.strength[idx] = { ...log.strength[idx], ...patch }
  write(data)
}

// 查找除 excludeDate 外,最近一次同名动作的记录(用于「显示上次同一动作的数据」)
export function getLastStrengthEntry(name: string, excludeDate?: string): StrengthEntry | null {
  const data = read()
  const normalized = name.trim().toLowerCase()
  const dates = Object.keys(data.dayLogs)
    .filter((d) => d !== excludeDate)
    .sort((a, b) => b.localeCompare(a))

  for (const date of dates) {
    const match = data.dayLogs[date].strength.find((s) => s.name.trim().toLowerCase() === normalized)
    if (match) return match
  }
  return null
}

export function deleteStrengthEntry(date: string, id: string) {
  const data = read()
  const log = data.dayLogs[date]
  if (!log) return
  log.strength = log.strength.filter((s) => s.id !== id)
  write(data)
}

export function addCardioEntry(date: string, entry: Omit<CardioEntry, 'id'>): CardioEntry {
  const data = read()
  const log = getOrCreateDayLog(data, date)
  const full: CardioEntry = { ...entry, id: newId() }
  log.cardio.push(full)
  write(data)
  return full
}

export function updateCardioEntry(date: string, id: string, patch: Partial<Omit<CardioEntry, 'id'>>) {
  const data = read()
  const log = data.dayLogs[date]
  if (!log) return
  const idx = log.cardio.findIndex((c) => c.id === id)
  if (idx === -1) return
  log.cardio[idx] = { ...log.cardio[idx], ...patch }
  write(data)
}

export function deleteCardioEntry(date: string, id: string) {
  const data = read()
  const log = data.dayLogs[date]
  if (!log) return
  log.cardio = log.cardio.filter((c) => c.id !== id)
  write(data)
}

export function addMeal(date: string, meal: Omit<Meal, 'id'>): Meal {
  const data = read()
  const log = getOrCreateDayLog(data, date)
  const full: Meal = { ...meal, id: newId() }
  log.meals.push(full)
  write(data)
  return full
}

export function updateMeal(date: string, id: string, patch: Partial<Omit<Meal, 'id'>>) {
  const data = read()
  const log = data.dayLogs[date]
  if (!log) return
  const idx = log.meals.findIndex((m) => m.id === id)
  if (idx === -1) return
  log.meals[idx] = { ...log.meals[idx], ...patch }
  write(data)
}

export function deleteMeal(date: string, id: string) {
  const data = read()
  const log = data.dayLogs[date]
  if (!log) return
  log.meals = log.meals.filter((m) => m.id !== id)
  write(data)
}

// ---- Export / Import ----

export function exportData(): string {
  return JSON.stringify(read(), null, 2)
}

export function importData(json: string) {
  const parsed = JSON.parse(json) as Partial<GymData>
  write({
    profile: parsed.profile ?? null,
    measurements: parsed.measurements ?? [],
    plans: parsed.plans ?? [],
    dayLogs: parsed.dayLogs ?? {},
    exerciseVideos: parsed.exerciseVideos ?? {},
  })
}

// ---- 动作视频(自己填的直链地址) ----

export function getExerciseVideo(name: string): string | null {
  return read().exerciseVideos[name] ?? null
}

export function setExerciseVideo(name: string, url: string) {
  const data = read()
  data.exerciseVideos[name] = url
  write(data)
}

export function removeExerciseVideo(name: string) {
  const data = read()
  delete data.exerciseVideos[name]
  write(data)
}

export function downloadExport() {
  const blob = new Blob([exportData()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gym-data-${todayStr()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
