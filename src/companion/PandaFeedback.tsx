import { useEffect, useRef, useState } from 'react'
import { companionClip } from './companionCatalog'
import { OriginalIdleRenderer } from './OriginalIdleRenderer'
import { librarySample } from './libraryMotion'

const ROOT = '/companion-assets/d-panda/'

export default function PandaFeedback({ clipId, reduced }: { clipId: string; reduced: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const clip = companionClip(clipId)
  useEffect(() => {
    if (reduced) return
    const target = canvas.current!
    let disposed = false, failed = false, frame = 0, engine: OriginalIdleRenderer | undefined
    let time = 0
    const stop = () => { cancelAnimationFrame(frame); frame = 0 }
    const fail = () => { failed = true; if (!disposed) { stop(); setReady(false); engine?.dispose() } }
    const hidden = () => { if (document.hidden) stop() }
    const lost = (event: Event) => { event.preventDefault(); fail() }
    const resize = new ResizeObserver(() => { if (!disposed) engine?.draw(time) })
    try {
      engine = new OriginalIdleRenderer(target, { width: clip.crop[2], height: clip.crop[3], stage: [480, 560], placement: [clip.scale, ...clip.offset], texture: ROOT + clip.texture, eyes: clip.motion === 'idle' ? ROOT + 'idle/closed-eyes-original.svg' : undefined, sample: milliseconds => librarySample(clip, milliseconds) })
      void engine.initialize().then(() => {
        if (disposed || failed) return
        setReady(true)
        const start = performance.now()
        const tick = (now: number) => {
          if (disposed || document.hidden) return
          time = Math.min(now - start, clip.duration)
          engine?.draw(time)
          if (time < clip.duration) frame = requestAnimationFrame(tick)
        }
        if (!document.hidden) frame = requestAnimationFrame(tick)
      }).catch(fail)
      resize.observe(target)
    } catch { fail() }
    document.addEventListener('visibilitychange', hidden); target.addEventListener('webglcontextlost', lost)
    return () => { disposed = true; stop(); resize.disconnect(); engine?.dispose(); document.removeEventListener('visibilitychange', hidden); target.removeEventListener('webglcontextlost', lost) }
  }, [clip, reduced])
  return <div className="workout-panda-art" data-clip={clip.id}>
    {(!ready || reduced) && <img src={ROOT + clip.texture} alt="D 熊猫原画形象" onError={event => { const fallback = ROOT + 'gentle/stand-original.svg'; if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback }} />}
    {!reduced && <canvas ref={canvas} aria-label="D 熊猫原画反馈" style={{ visibility: ready ? 'visible' : 'hidden' }} />}
  </div>
}
