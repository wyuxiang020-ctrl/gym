import { useState } from 'react'
import { EXERCISE_DETAILS } from '../../lib/exerciseDetails'
import { patternFor } from '../../lib/exercisePatterns'
import { parseExerciseResource } from '../../lib/exerciseResource'
import * as store from '../../lib/store'
import { ExerciseStepCards } from './ExerciseStepCards'

function VideoField({ name }: { name: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(() => store.getExerciseVideo(name))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(videoUrl ?? '')
  const [videoError, setVideoError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedResource = videoUrl ? parseExerciseResource(videoUrl) : null

  function save() {
    const parsed = parseExerciseResource(draft)
    if (!parsed.ok) { setError(parsed.error); return }
    try {
      store.setExerciseVideo(name, parsed.resource.url)
      setVideoUrl(parsed.resource.url)
      setDraft(parsed.resource.url)
      setEditing(false)
      setVideoError(false)
      setError(null)
    } catch {
      setError('保存失败，原链接未更改；输入内容已保留，请稍后重试或先复制备份。')
    }
  }

  function remove() {
    try {
      store.removeExerciseVideo(name)
      setVideoUrl(null)
      setDraft('')
      setEditing(false)
      setError(null)
    } catch {
      setError('删除失败，原链接仍保留，请稍后重试。')
    }
  }

  if (videoUrl && !editing) {
    return (
      <div className="space-y-1.5">
        {savedResource?.ok && savedResource.resource.kind === 'video' && !videoError && (
          <video
            src={savedResource.resource.url}
            preload="none"
            controls
            loop
            muted
            playsInline
            className="w-full rounded-md bg-neutral-900"
            onError={() => setVideoError(true)}
          />
        )}
        {videoError && <p className="text-xs text-amber-700">视频无法在这里播放，可以在新标签页打开原链接，或更换链接。</p>}
        {savedResource?.ok ? (
          <div className="space-y-1">
            <p className="break-all text-xs text-neutral-500">来源网站：{savedResource.resource.hostname}</p>
            <a
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
              href={savedResource.resource.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              在新标签页打开教学资料 ↗
            </a>
          </div>
        ) : <p className="text-xs text-amber-700">原链接不符合安全格式，已暂停打开；可以修改或删除。</p>}
        <p className="text-xs text-neutral-500">这是你收藏的第三方资料，Gym 未审校其内容；外部网站可能需要登录。关闭新标签页可返回当前记录。</p>
        <div className="flex gap-3 text-xs">
          <button className="min-h-11 text-neutral-500" onClick={() => { setEditing(true); setError(null) }}>
            换一个链接
          </button>
          <button className="min-h-11 text-red-500" onClick={remove}>
            删除资料链接
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-neutral-500">
        收藏你认可的教学网页或视频链接。普通网页由你点击后在新标签页打开；.mp4 等视频直链可在这里播放。仅保存在当前浏览器。
      </p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm text-neutral-900"
          aria-label="教学资料链接"
          type="url"
          placeholder="https://..."
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null) }}
        />
        <button
          className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-3 text-sm font-medium text-white"
          onClick={save}
        >
          保存资料链接
        </button>
      </div>
      {editing && (
        <button className="min-h-11 text-xs text-neutral-400" onClick={() => { setEditing(false); setDraft(videoUrl ?? ''); setError(null) }}>
          取消
        </button>
      )}
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function ExerciseDetailSheet({ name, onClose }: { name: string; onClose: () => void }) {
  const detail = EXERCISE_DETAILS[name]
  const pattern = patternFor(name)

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-[520px] space-y-3 overflow-y-auto rounded-t-2xl bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold text-neutral-900">{name}</h3>
          <button className="min-h-11 px-2 text-neutral-400" onClick={onClose}>
            ✕
          </button>
        </div>

        {detail ? (
          <>
            <p className="text-xs text-neutral-500">主要肌群:{detail.muscle}</p>
            <ExerciseStepCards detail={detail} pattern={pattern} />
          </>
        ) : (
          <p className="text-sm text-neutral-500">这个动作还没有收录详细要领。</p>
        )}

        <div className="border-t border-neutral-200 pt-3">
          <p className="mb-1 text-sm font-medium text-neutral-900">我的教学资料</p>
          <VideoField name={name} />
        </div>
      </div>
    </div>
  )
}
