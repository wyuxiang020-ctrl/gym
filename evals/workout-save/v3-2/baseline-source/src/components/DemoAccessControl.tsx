import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  DEMO_ACCESS_REQUIRED_EVENT,
  getDemoAccessCode,
  saveDemoAccessCode,
} from '../lib/apiClient'

export function DemoAccessControl() {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(() => Boolean(getDemoAccessCode()))
  const [value, setValue] = useState(() => getDemoAccessCode())

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(DEMO_ACCESS_REQUIRED_EVENT, show)
    return () => window.removeEventListener(DEMO_ACCESS_REQUIRED_EVENT, show)
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    saveDemoAccessCode(value)
    setSaved(Boolean(value.trim()))
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm"
        aria-label={saved ? '修改 AI 演示访问码' : '输入 AI 演示访问码'}
      >
        {saved ? 'AI 已解锁' : 'AI 访问码'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-5 sm:items-center sm:pb-0" role="presentation">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="demo-access-title">
            <h2 id="demo-access-title" className="text-lg font-semibold text-neutral-900">AI 演示访问</h2>
            <p className="mt-1 text-sm text-neutral-600">访问码只保存在当前浏览器标签页，用于限制公开演示的 AI 成本。</p>
            <form className="mt-4 space-y-3" onSubmit={submit}>
              <label className="block text-sm font-medium text-neutral-800" htmlFor="demo-access-code">访问码</label>
              <input
                id="demo-access-code"
                type="password"
                autoComplete="off"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="请输入演示访问码"
                className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-primary"
                autoFocus
              />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700">取消</button>
                <button type="submit" className="flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
