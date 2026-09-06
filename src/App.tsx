import { useState } from 'react'
import { BodyTab } from './components/BodyTab'
import { BottomTabBar, type TabKey } from './components/BottomTabBar'
import { MealTab } from './components/MealTab'
import { ProfileForm } from './components/ProfileForm'
import { RecordsTab } from './components/RecordsTab'
import { WorkoutTab } from './components/WorkoutTab'
import { TodayTab } from './components/checkin/TodayTab'
import { DemoAccessControl } from './components/DemoAccessControl'
import * as store from './lib/store'
import { todayStr } from './lib/date'
import { ToastProvider } from './lib/ToastContext'
import type { Measurement, Plan, PlanDay, Profile } from './lib/types'
import syntheticPortfolioData from '../docs/portfolio/fixtures/synthetic-demo-data.json'

function latestWeightKg(measurements: Measurement[]): number | null {
  const withWeight = measurements
    .filter((m): m is Measurement & { weight: number } => m.weight != null)
    .sort((a, b) => b.date.localeCompare(a.date))
  return withWeight[0]?.weight ?? null
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

function AppContent() {
  const searchParams = new URLSearchParams(window.location.search)
  const portfolioDemo = import.meta.env.DEV && searchParams.get('portfolio-demo') === '1'
  const portfolioState = searchParams.get('portfolio-state') ?? 'partial'
  if (portfolioDemo && localStorage.getItem('gym-data-v1') === null) {
    const demoData = structuredClone(syntheticPortfolioData)
    const demoToday = demoData.dayLogs['2026-09-06']
    if (portfolioState === 'incomplete') {
      demoToday.checkedIn = false
      demoToday.strength.forEach((entry) => {
        entry.estKcal = 0
        entry.sets.forEach((set) => { set.done = false })
      })
      demoToday.cardio.forEach((entry) => {
        entry.done = false
        entry.estKcal = 0
      })
    }
    if (portfolioState === 'complete') {
      demoToday.checkedIn = true
      demoToday.strength.forEach((entry) => entry.sets.forEach((set) => { set.done = true }))
      demoToday.cardio.forEach((entry) => { entry.done = true })
    }
    store.importData(JSON.stringify(demoData))
  }
  const [storageIssue, setStorageIssue] = useState<string | null>(() => store.getStorageIssue())
  const [profile, setProfile] = useState<Profile | null>(() => store.getProfile())
  const [measurements, setMeasurements] = useState<Measurement[]>(() => store.getMeasurements())
  const [plans, setPlans] = useState<Plan[]>(() => store.getPlans())
  const [editingProfile, setEditingProfile] = useState(false)
  const [tab, setTab] = useState<TabKey>('today')

  function reloadImportedData() {
    setStorageIssue(store.getStorageIssue())
    setProfile(store.getProfile())
    setMeasurements(store.getMeasurements())
    setPlans(store.getPlans())
    setEditingProfile(false)
    setTab('today')
  }

  function saveProfile(p: Profile) {
    store.saveProfile(p)
    setProfile(p)
    setEditingProfile(false)
  }

  function addMeasurement(m: Measurement) {
    store.addMeasurement(m)
    setMeasurements(store.getMeasurements())
  }

  function deleteMeasurementAt(index: number) {
    store.deleteMeasurementAt(index)
    setMeasurements(store.getMeasurements())
  }

  function createPlan(plan: { name: string; days: PlanDay[]; isActive?: boolean }) {
    store.addPlan(plan)
    setPlans(store.getPlans())
  }

  function updatePlan(id: string, patch: { name: string; days: PlanDay[] }) {
    store.updatePlan(id, patch)
    setPlans(store.getPlans())
  }

  function setActivePlan(id: string) {
    store.setActivePlan(id)
    setPlans(store.getPlans())
  }

  function deletePlan(id: string) {
    store.deletePlan(id)
    setPlans(store.getPlans())
  }

  if (storageIssue) {
    return (
      <div className="min-h-screen bg-app-bg px-4 py-10">
        <div className="mx-auto w-full max-w-[520px] space-y-6">
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-semibold text-neutral-900">本地数据需要恢复</h1>
            <p className="text-sm text-neutral-600">
              为避免覆盖原记录，应用已暂停普通写入。请先导出当前原始数据，再导入一份有效备份。
            </p>
          </div>
          <RecordsTab onImportSuccess={reloadImportedData} />
        </div>
      </div>
    )
  }

  if (!profile || editingProfile) {
    return (
      <div className="min-h-screen bg-app-bg px-4 py-10">
        <div className="mx-auto w-full max-w-[520px] space-y-6">
          <h1 className="font-heading text-2xl font-semibold text-neutral-900">
            {profile ? '编辑档案' : '先建立身体档案'}
          </h1>
          <ProfileForm initial={profile} onSave={saveProfile} />
        </div>
      </div>
    )
  }

  const weightKg = latestWeightKg(measurements)
  const date = todayStr()

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="mx-auto w-full max-w-[520px] px-4 pb-24 pt-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold text-neutral-900">Gym</h1>
          <div className="flex items-center gap-2">
            {portfolioDemo && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
                合成演示{portfolioState === 'incomplete' ? '·未完成' : portfolioState === 'complete' ? '·已完成' : '·部分完成'}
              </span>
            )}
            <DemoAccessControl />
          </div>
        </div>

        {tab === 'today' && <TodayTab date={date} profile={profile} />}

        {tab === 'workout' && (
          <WorkoutTab
            date={date}
            profile={profile}
            weightKg={weightKg}
            plans={plans}
            onCreatePlan={createPlan}
            onUpdatePlan={updatePlan}
            onSetActivePlan={setActivePlan}
            onDeletePlan={deletePlan}
          />
        )}

        {tab === 'meal' && (
          <MealTab date={date} profile={profile} weightKg={weightKg} onProfileChange={setProfile} />
        )}

        {tab === 'body' && (
          <BodyTab
            profile={profile}
            measurements={measurements}
            onEditProfile={() => setEditingProfile(true)}
            onAddMeasurement={addMeasurement}
            onDeleteMeasurementAt={deleteMeasurementAt}
          />
        )}

        {tab === 'records' && <RecordsTab onImportSuccess={reloadImportedData} />}
      </div>

      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  )
}

export default App
