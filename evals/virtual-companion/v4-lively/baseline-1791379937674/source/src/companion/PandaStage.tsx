import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createPandaRig } from './pandaRig'
import type { CameraView, CompanionPose, DisplayMode, RenderStats } from './types'

interface PandaStageProps {
  getPose: (now: number) => CompanionPose
  display: DisplayMode
  pixelSize: 2 | 4 | 6
  view: CameraView
  onStats?: (stats: RenderStats) => void
  onError?: (message: string) => void
  onNotice?: (message: string) => void
}

const quantile = (values: number[], portion: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * portion))] ?? 0
}

export function PandaStage(props: PandaStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const live = useRef(props)
  useEffect(() => { live.current = props }, [props])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'default' })
    } catch {
      live.current.onError?.('角色画面无法启动。此实验需要支持 WebGL 2 的浏览器，请重试或更换浏览器。')
      return
    }

    const canvas = renderer.domElement
    canvas.setAttribute('aria-label', '原创熊猫三维关节实验画面')
    canvas.setAttribute('role', 'img')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)
    host.appendChild(canvas)
    const scene = new THREE.Scene()
    const rig = createPandaRig()
    scene.add(rig.root)
    scene.add(new THREE.HemisphereLight('#fffdfa', '#cbbfb0', 1.8))
    const sun = new THREE.DirectionalLight('#fffdfa', 1.8)
    sun.position.set(-3, 5, 6)
    scene.add(sun)
    const groundGeometry = new THREE.CircleGeometry(1, 48)
    const groundMaterial = new THREE.MeshBasicMaterial({ color: '#af9676', transparent: true, opacity: 0.23, depthWrite: false })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.name = 'contact-shadow-disc'
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0.008
    ground.scale.set(1.02, 0.48, 1)
    scene.add(ground)
    const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 30)
    let disposed = false
    let failed = false
    let contextLost = false
    let frame = 0
    let sizeDirty = true
    let cachedDisplay: DisplayMode | undefined
    let cachedPixelSize = 0
    let cachedView: CameraView | undefined
    let width = 0
    let height = 0
    let dpr = 1
    let pixelFallback = false
    let previousNow = 0
    let sampleStart = 0
    let intervals: number[] = []
    let renderCount = 0

    const reportFailure = (message: string) => {
      if (disposed || failed) return
      failed = true
      cancelAnimationFrame(frame)
      live.current.onError?.(message)
    }

    const syncLayout = () => {
      const nextWidth = Math.max(1, Math.floor(host.clientWidth))
      const nextHeight = Math.max(1, Math.floor(host.clientHeight))
      const nextDpr = Math.max(1, window.devicePixelRatio || 1)
      const { display, pixelSize, view } = live.current
      if (sizeDirty || nextWidth !== width || nextHeight !== height || nextDpr !== dpr || display !== cachedDisplay || pixelSize !== cachedPixelSize) {
        width = nextWidth
        height = nextHeight
        dpr = nextDpr
        cachedDisplay = display
        cachedPixelSize = pixelSize
        sizeDirty = false
        if (display === 'pixel' && pixelFallback) {
          live.current.onNotice?.('此设备的像素显示不可用，当前为清晰画面。重新加载角色后可再尝试。')
        }
        // The same live scene is drawn into a smaller framebuffer each frame.
        // CSS nearest-neighbour expansion affects only this canvas, never the UI.
        const pixelated = display === 'pixel' && !pixelFallback
        const scale = pixelated ? 1 / pixelSize : Math.min(dpr, 2)
        try {
          renderer.setPixelRatio(scale)
          renderer.setSize(width, height, false)
          canvas.style.imageRendering = pixelated ? 'pixelated' : 'auto'
          if (pixelated && (!CSS.supports('image-rendering', 'pixelated') || canvas.width < 32 || canvas.height < 32)) {
            throw new Error('Pixel buffer is too small or nearest-neighbour presentation is unavailable')
          }
        } catch {
          if (!pixelated) throw new Error('Unable to resize render buffer')
          pixelFallback = true
          renderer.setPixelRatio(Math.min(dpr, 2))
          renderer.setSize(width, height, false)
          canvas.style.imageRendering = 'auto'
          live.current.onNotice?.('此设备的像素显示不可用，已回退为清晰画面。关节动作保持一致。')
        }
        canvas.dataset.displayMode = display === 'pixel' && !pixelFallback ? 'pixel' : 'clear'
        canvas.dataset.actualDisplay = canvas.dataset.displayMode
        canvas.dataset.pixelSize = String(display === 'pixel' && !pixelFallback ? pixelSize : 1)
        canvas.dataset.bufferSize = `${canvas.width}x${canvas.height}`
        canvas.dataset.dpr = String(dpr)
        const aspect = width / height
        const visibleHeight = Math.max(3.65, 3.90 / aspect)
        camera.left = -visibleHeight * aspect / 2
        camera.right = visibleHeight * aspect / 2
        camera.top = visibleHeight / 2
        camera.bottom = -visibleHeight / 2
        camera.updateProjectionMatrix()
      }
      if (cachedView !== view) {
        cachedView = view
        const angle = view === 'side' ? Math.PI / 2 : view === 'three-quarter' ? Math.PI / 5 : 0
        camera.position.set(Math.sin(angle) * 7, 2.0, Math.cos(angle) * 7)
        camera.lookAt(0, 1.48, 0)
        canvas.dataset.view = view
      }
    }

    const render = (now: number) => {
      if (disposed || failed || contextLost || document.hidden) return
      try {
        syncLayout()
        rig.applyPose(live.current.getPose(now))
        canvas.dataset.pose = JSON.stringify({
          left: { shoulder: rig.left.shoulder.rotation.z, elbow: rig.left.elbow.rotation.z },
          right: { shoulder: -rig.right.shoulder.rotation.z, elbow: -rig.right.elbow.rotation.z },
        })
        renderer.render(scene, camera)
        renderCount += 1
        canvas.dataset.renderFrame = String(renderCount)
      } catch {
        reportFailure('角色渲染中断，请退出实验后重新进入。摄像头跟随应一同停止。')
        return
      }
      if (previousNow > 0) intervals.push(now - previousNow)
      previousNow = now
      if (sampleStart === 0) sampleStart = now
      if (now - sampleStart >= 1000) {
        const buffer = renderer.getDrawingBufferSize(new THREE.Vector2())
        live.current.onStats?.({
          fps: intervals.length * 1000 / (now - sampleStart),
          frameP50Ms: quantile(intervals, 0.50),
          frameP95Ms: quantile(intervals, 0.95),
          width, height, dpr,
          bufferWidth: buffer.x, bufferHeight: buffer.y,
          pixelSize: cachedDisplay === 'pixel' && !pixelFallback ? cachedPixelSize : 1,
        })
        sampleStart = now
        intervals = []
      }
      frame = requestAnimationFrame(render)
    }

    const resetSamples = () => {
      previousNow = 0
      sampleStart = 0
      intervals = []
    }
    const onVisibility = () => {
      cancelAnimationFrame(frame)
      resetSamples()
      if (!document.hidden && !disposed && !failed && !contextLost) frame = requestAnimationFrame(render)
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      cancelAnimationFrame(frame)
      live.current.onError?.('图形上下文已丢失，角色与跟随已暂停。请退出实验后重新进入。')
    }
    const onContextRestored = () => {
      // Do not silently resume a camera-driven scene after a graphics failure.
      contextLost = false
      failed = true
      live.current.onNotice?.('图形上下文已恢复；请退出后重新进入实验，再主动开启相机。')
    }
    const onResize = () => { sizeDirty = true }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(onResize)
    observer?.observe(host)
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    if (!document.hidden) frame = requestAnimationFrame(render)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      rig.dispose()
      groundGeometry.dispose()
      groundMaterial.dispose()
      scene.clear()
      renderer.renderLists.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [])

  return <div ref={hostRef} className="panda-stage" style={{ width: '100%', height: '100%', minHeight: 300 }} />
}
