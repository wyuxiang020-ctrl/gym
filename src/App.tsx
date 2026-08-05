import { useState } from 'react'
import { BodyTab } from './components/BodyTab'
import { BottomTabBar, type TabKey } from './components/BottomTabBar'
import { MealTab } from './components/MealTab'
import { ProfileForm } from './components/ProfileForm'
import { RecordsTab } from './components/RecordsTab'
import { WorkoutTab } from './components/WorkoutTab'
import { TodayTab } from './components/checkin/TodayTab'
import * as store from './lib/store'
import { todayStr } from './lib/date'
import type { Measurement, Plan, PlanDay, Profile } from './lib/types'

function latestWeightKg(measurements: Measurement[]): number | null {
  const withWeight = measurements
    .filter((m): m is Measurement & { weight: number } => m.weight != null)
    .sort((a, b) => b.date.localeCompare(a.date))
  return withWeight[0]?.weight ?? null
}

function App() {
  const [profile, setProfile] = useState<Profile | null>(() => store.getProfile())
  const [measurements, setMeasurements] = useState<Measurement[]>(() => store.getMeasurements())
  const [plans, setPlans] = useState<Plan[]>(() => store.getPlans())
  const [editingProfile, setEditingProfile] = useState(false)
  const [tab, setTab] = useState<TabKey>('today')

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
        <h1 className="font-heading mb-6 text-2xl font-semibold text-neutral-900">Gym</h1>

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

        {tab === 'records' && <RecordsTab />}
      </div>

      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  )
}

export default App
