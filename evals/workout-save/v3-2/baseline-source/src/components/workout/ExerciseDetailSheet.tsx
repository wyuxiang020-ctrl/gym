import { useState } from 'react'
import { EXERCISE_DETAILS } from '../../lib/exerciseDetails'
import { patternFor } from '../../lib/exercisePatterns'
import * as store from '../../lib/store'
import { ExerciseStepCards } from './ExerciseStepCards'

function VideoField({ name }: { name: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(() => store.getExerciseVideo(name))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(videoUrl ?? '')
  const [videoError, setVideoError] = useState(false)

  function save() {
    const trimmed = draft.trim()
    if (!trimmed) return
    store.setExerciseVideo(name, trimmed)
    setVideoUrl(trimmed)
    setEditing(false)
    setVideoError(false)
  }

  function remove() {
    store.removeExerciseVideo(name)
    setVideoUrl(null)
    setDraft('')
    setEditing(false)
  }

  if (videoUrl && !editing) {
    return (
      <div className="space-y-1.5">
        {videoError ? (
          <p className="text-xs text-red-500">这个链接播放不了,换一个直链地址试试。</p>
        ) : (
          <video
            src={videoUrl}
            controls
            loop
            muted
            playsInline
            className="w-full rounded-md bg-neutral-900"
            onError={() => setVideoError(true)}
          />
        )}
        <div className="flex gap-3 text-xs">
          <button className="text-neutral-500" onClick={() => setEditing(true)}>
            换一个链接
          </button>
          <button className="text-red-500" onClick={remove}>
            删除
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-neutral-500">
        粘贴一个可以直接播放的视频地址(比如 .mp4 直链),我不会帮你跳转到其他平台搜索。
      </p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm text-neutral-900"
          placeholder="https://.../video.mp4"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="min-h-11 rounded-md bg-primary hover:bg-primary-dark px-3 text-sm font-medium text-white"
          onClick={save}
        >
          保存
        </button>
      </div>
      {editing && (
        <button className="text-xs text-neutral-400" onClick={() => setEditing(false)}>
          取消
        </button>
      )}
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
          <p className="mb-1 text-sm font-medium text-neutral-900">教学视频</p>
          <VideoField name={name} />
        </div>
      </div>
    </div>
  )
}
