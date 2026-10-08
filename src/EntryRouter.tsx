import { Suspense, lazy } from 'react'
import { EntryBoundary } from './EntryBoundary'

const CompanionLab = lazy(() => import('./companion/CompanionLab'))
const EquipmentPage = lazy(() => import('./equipment/EquipmentPage'))
const App = lazy(async () => {
  // Optional remote fonts must not block the training page on restricted networks.
  void import('./training-fonts.css').catch(() => {})
  return import('./App')
})

export function EntryRouter() {
  const experiment = new URLSearchParams(window.location.search).get('companion-lab') === '1'
  const equipment = new URLSearchParams(window.location.search).get('equipment-scan') === '1'
  return <EntryBoundary><Suspense fallback={<p style={{ padding: 32 }}>正在加载页面…</p>}>
    {equipment ? <EquipmentPage /> : experiment ? <CompanionLab /> : <App />}
  </Suspense></EntryBoundary>
}
