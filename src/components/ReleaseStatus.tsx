import { useState } from 'react'

export const RELEASE_LABEL = '器械与熊猫陪练 · 2026-10-09'

export function ReleaseStatus() {
  const [state, setState] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle')
  async function check() {
    setState('checking')
    try {
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
      if (registration) await Promise.race([registration.update(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))])
      setState('ready')
    } catch { setState('error') }
  }
  return <section aria-label="应用版本" style={{ fontSize: 12, lineHeight: 1.7, margin: '10px 0', color: '#637455' }}>
    <span>{RELEASE_LABEL}</span>{' · '}
    <button style={{ minHeight: 44, padding: '0 8px', textDecoration: 'underline' }} disabled={state === 'checking'} onClick={check}>{state === 'checking' ? '正在检查…' : '检查更新'}</button>
    {(state === 'ready' || state === 'error') && <p role="status">{state === 'ready' ? '已检查更新。请先完成正在编辑的记录，再刷新页面。' : '暂时无法检查更新，请确认联网后重试。'}{state === 'ready' && <button style={{ minHeight: 44, padding: '0 8px', textDecoration: 'underline' }} onClick={() => window.location.reload()}>刷新页面</button>}</p>}
  </section>
}
