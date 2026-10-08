import { useEffect, useRef } from 'react'
import { drawIllustratedPanda } from './illustratedPanda'
import type { CameraView, CompanionPose, DisplayMode, RenderStats } from './types'

interface PandaStageProps {
  getPose: (now: number) => CompanionPose
  display: DisplayMode
  pixelSize: 2 | 4 | 6
  view: CameraView
  hat: boolean
  onStats?: (stats: RenderStats) => void
  onError?: (message: string) => void
  onNotice?: (message: string) => void
}
const quantile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
}

export function PandaStage(props: PandaStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const live = useRef(props)
  useEffect(() => { live.current = props }, [props])
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) { live.current.onError?.('角色画布无法启动，请重新加载角色。'); return }
    canvas.setAttribute('aria-label', '手绘卡通熊猫实时动作画面')
    canvas.setAttribute('role', 'img')
    canvas.style.cssText = 'width:100%;height:100%;display:block'
    canvas.dataset.renderer = 'illustrated-2d'
    host.appendChild(canvas)
    let frame = 0, disposed = false, failed = false, count = 0
    let start = 0, previous = 0, intervals: number[] = []
    let pixelFallback = false
    function render(now: number) {
      if (disposed || failed || document.hidden || !context) return
      try {
        const p = live.current
        const width = Math.max(1, host!.clientWidth), height = Math.max(1, host!.clientHeight)
        const dpr = Math.max(1, window.devicePixelRatio || 1)
        if (p.display === 'pixel' && !CSS.supports('image-rendering', 'pixelated') && !pixelFallback) {
          pixelFallback = true
          p.onNotice?.('此浏览器不支持像素显示，已使用清晰画面。')
        }
        const pixel = p.display === 'pixel' && !pixelFallback
        const resolution = pixel ? 1 / p.pixelSize : Math.min(dpr, 2)
        const bw = Math.max(1, Math.round(width * resolution)), bh = Math.max(1, Math.round(height * resolution))
        if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh }
        canvas.style.imageRendering = pixel ? 'pixelated' : 'auto'
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, bw, bh)
        const scale = Math.min(bw / 600, bh / 600)
        context.translate((bw - 600 * scale) / 2, (bh - 600 * scale) / 2)
        context.scale(scale, scale)
        const pose = p.getPose(now)
        drawIllustratedPanda(context, pose, { view: p.view, hat: p.hat })
        canvas.dataset.pose = JSON.stringify({ left: pose.left, right: pose.right })
        canvas.dataset.characterMotion = JSON.stringify(pose.motion ?? {})
        canvas.dataset.view = p.view
        canvas.dataset.hat = String(p.hat)
        canvas.dataset.displayMode = canvas.dataset.actualDisplay = pixel ? 'pixel' : 'clear'
        canvas.dataset.pixelSize = String(pixel ? p.pixelSize : 1)
        canvas.dataset.bufferSize = `${bw}x${bh}`
        canvas.dataset.dpr = String(dpr)
        canvas.dataset.renderFrame = String(++count)
        if (previous) intervals.push(now - previous)
        previous = now
        if (!start) start = now
        if (now - start >= 1000) {
          p.onStats?.({ fps: intervals.length * 1000 / (now - start), frameP50Ms: quantile(intervals, .5), frameP95Ms: quantile(intervals, .95), width, height, dpr, bufferWidth: bw, bufferHeight: bh, pixelSize: pixel ? p.pixelSize : 1 })
          intervals = []; start = now
        }
      } catch {
        failed = true
        live.current.onError?.('角色绘制中断，请重新加载角色。摄像头跟随已暂停。')
        return
      }
      frame = requestAnimationFrame(render)
    }
    const visibility = () => {
      cancelAnimationFrame(frame); previous = 0; start = 0; intervals = []
      if (!document.hidden && !failed && !disposed) frame = requestAnimationFrame(render)
    }
    document.addEventListener('visibilitychange', visibility)
    const lost = (event: Event) => { event.preventDefault(); failed = true; cancelAnimationFrame(frame); live.current.onError?.('画布已暂停，请重新加载角色。') }
    canvas.addEventListener('contextlost', lost)
    if (!document.hidden) frame = requestAnimationFrame(render)
    return () => { disposed = true; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('contextlost', lost); canvas.remove() }
  }, [])
  return <div ref={hostRef} className="panda-stage" style={{ width: '100%', height: '100%', minHeight: 300 }} />
}
