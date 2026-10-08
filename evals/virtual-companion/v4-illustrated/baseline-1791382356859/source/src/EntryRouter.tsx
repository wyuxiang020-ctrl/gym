import { Suspense, lazy } from 'react'
import { EntryBoundary } from './EntryBoundary'

const CompanionLab = lazy(() => import('./companion/CompanionLab'))
const App = lazy(() => import('./App'))

export function EntryRouter() {
  const experiment = new URLSearchParams(window.location.search).get('companion-lab') === '1'
  return <EntryBoundary><Suspense fallback={<p style={{ padding: 32 }}>正在加载页面…</p>}>
    {experiment ? <CompanionLab /> : <App />}
  </Suspense></EntryBoundary>
}
