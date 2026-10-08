import type { CompanionPose } from '../types'
import { REST_POSE } from '../types'
import { mapMirrorPose, MIRROR_LIMITS, MirrorPoseFilter } from './mapping'
import type { PoseWorkerInput, PoseWorkerOutput } from './protocol'

export type MirrorState = 'idle' | 'preparing' | 'tracking' | 'partial' | 'lost' | 'error' | 'stopped'
export interface MirrorMetrics {
  initMs: number | null
  resourceLoadMs: number | null
  modelInitMs: number | null
  inferenceP50Ms: number | null
  inferenceP95Ms: number | null
  mappingP50Ms: number | null
  mappingP95Ms: number | null
  poseHz: number
  frames: number
  acceptedFrames: number
  rejectedFrames: number
  losses: number
  recoveries: number
  activeTracks: number
  inFlight: boolean
  inputWidth: number
  inputHeight: number
}

interface MirrorOptions {
  video: HTMLVideoElement
  onState: (state: MirrorState, message: string) => void
  onPose: (pose: CompanionPose) => void
  onMetrics: (metrics: MirrorMetrics) => void
}

// Dependencies are injectable for deterministic tests; the product always uses
// these browser defaults and never substitutes synthetic camera input.
export interface MirrorPlatform {
  now: () => number
  secure: () => boolean
  capable: () => boolean
  hidden: () => boolean
  listenVisibility: (listener: () => void) => () => void
  getUserMedia: () => Promise<MediaStream>
  createWorker: () => Worker
  bitmap: (video: HTMLVideoElement, width: number, height: number) => Promise<ImageBitmap>
  later: (callback: () => void, delay: number) => number
  cancel: (id: number) => void
  asset: (path: string) => string
}

function browserPlatform(): MirrorPlatform {
  return {
    now: () => performance.now(),
    secure: () => window.isSecureContext,
    capable: () => typeof Worker === 'function' && typeof OffscreenCanvas === 'function'
      && typeof createImageBitmap === 'function' && Boolean(navigator.mediaDevices?.getUserMedia),
    hidden: () => document.hidden,
    listenVisibility: listener => {
      document.addEventListener('visibilitychange', listener)
      return () => document.removeEventListener('visibilitychange', listener)
    },
    getUserMedia: () => navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
    }),
    createWorker: () => new Worker(new URL('/companion-assets/pose-worker.js', window.location.origin)),
    bitmap: (video, width, height) => createImageBitmap(video, { resizeWidth: width, resizeHeight: height, resizeQuality: 'low' }),
    later: (callback, delay) => window.setTimeout(callback, delay),
    cancel: id => window.clearTimeout(id),
    asset: path => new URL(`/companion-assets/${path}`, window.location.origin).href,
  }
}

const emptyMetrics = (): MirrorMetrics => ({
  initMs: null, resourceLoadMs: null, modelInitMs: null,
  inferenceP50Ms: null, inferenceP95Ms: null, mappingP50Ms: null, mappingP95Ms: null,
  poseHz: 0, frames: 0, acceptedFrames: 0, rejectedFrames: 0, losses: 0, recoveries: 0,
  activeTracks: 0, inFlight: false, inputWidth: 0, inputHeight: 0,
})
const percentile = (samples: number[], quantile: number): number | null => {
  if (!samples.length) return null
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * quantile))]
}

class Cancelled extends Error {}

function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '相机权限未开启。你可以保留预设体验，或允许权限后重新开启。'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '没有找到相机，请连接设备后重试。'
  if (name === 'NotReadableError' || name === 'TrackStartError') return '相机可能被其他应用占用，请关闭占用后重试。'
  if (name === 'OverconstrainedError') return '相机不支持当前采集条件，请换用支持的相机。'
  if (name === 'SecurityError') return '浏览器安全设置阻止了相机，请检查权限和安全网址。'
  return error instanceof Error ? error.message : '镜像初始化失败，请重新开启。'
}

export class MirrorSession {
  private readonly options: MirrorOptions
  private readonly platform: MirrorPlatform
  private readonly removeVisibility: () => void
  private epoch = 0
  private disposed = false
  private state: MirrorState = 'idle'
  private stream: MediaStream | null = null
  private worker: Worker | null = null
  private timer: number | null = null
  private pending = new Set<() => void>()
  private trackListeners: Array<() => void> = []
  private filter = new MirrorPoseFilter()
  private metrics = emptyMetrics()
  private inferenceTimes: number[] = []
  private mappingTimes: number[] = []
  private poseIntervals: number[] = []
  private lastAcceptedAt: number | null = null
  private lastResultAt = 0
  private lastVideoTime = -1
  private lastSendAt = -Infinity
  private lastMetricsAt = 0
  private startedAt = 0
  private nextFrameId = 0
  private flight: { id: number; at: number } | null = null
  private goodStreak = 0
  private everTracked = false
  private displayed: CompanionPose = REST_POSE
  private armStreak = { left: 0, right: 0 }

  constructor(options: MirrorOptions, platform: MirrorPlatform = browserPlatform()) {
    this.options = options
    this.platform = platform
    this.removeVisibility = platform.listenVisibility(() => {
      if (platform.hidden() && ['preparing', 'tracking', 'partial', 'lost'].includes(this.state)) {
        this.stop('页面已隐藏，相机已停止。返回后请主动重新开启。')
      }
    })
  }

  private publish(state: MirrorState, message: string): void {
    this.state = state
    if (!this.disposed) this.options.onState(state, message)
  }

  private current(epoch: number): boolean { return epoch === this.epoch && !this.disposed }

  private wait<T>(promise: Promise<T>, timeout: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (callback: () => void) => {
        if (settled) return
        settled = true
        this.platform.cancel(timer)
        this.pending.delete(cancel)
        callback()
      }
      const cancel = () => finish(() => reject(new Cancelled()))
      const timer = this.platform.later(() => finish(() => reject(new Error(message))), timeout)
      this.pending.add(cancel)
      promise.then(value => finish(() => resolve(value)), error => finish(() => reject(error)))
    })
  }

  async start(): Promise<void> {
    if (this.disposed) return
    this.release()
    const epoch = this.epoch
    const startAt = this.platform.now()
    this.metrics = emptyMetrics()
    this.inferenceTimes = []
    this.mappingTimes = []
    this.poseIntervals = []
    this.lastAcceptedAt = null
    this.filter = new MirrorPoseFilter()
    this.goodStreak = 0
    this.everTracked = false
    this.displayed = REST_POSE
    this.armStreak = { left: 0, right: 0 }
    this.lastVideoTime = -1
    this.lastSendAt = -Infinity
    this.lastMetricsAt = 0
    this.publish('preparing', '正在等待相机权限；允许后会加载本机姿态模型。')
    this.emitMetrics(true)
    try {
      if (!this.platform.secure()) throw new Error('相机需要 HTTPS 或 localhost 安全地址。')
      if (!this.platform.capable()) throw new Error('当前浏览器不支持此镜像实验所需的相机或后台推理能力，请使用新版浏览器。')
      if (this.platform.hidden()) throw new Error('请在前台页面主动开启镜像。')
      const permission = this.platform.getUserMedia().then(stream => {
        if (!this.current(epoch)) stream.getTracks().forEach(track => track.stop())
        return stream
      })
      const stream = await this.wait(permission, 30_000, '等待相机权限超时，已取消。请确认权限后重新开启。')
      if (!this.current(epoch)) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream
      const tracks = stream.getVideoTracks()
      if (!tracks.length || tracks.every(track => track.readyState === 'ended')) throw new Error('相机没有提供有效视频轨道。')
      for (const track of tracks) {
        const ended = () => { if (this.current(epoch)) this.fail('相机已断开，请检查设备后重新开启。') }
        track.addEventListener('ended', ended)
        this.trackListeners.push(() => track.removeEventListener('ended', ended))
      }
      const video = this.options.video
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      this.publish('preparing', '正在加载本机姿态模型；画面只在本机内存中处理。')
      const worker = this.platform.createWorker()
      this.worker = worker
      const ready = new Promise<void>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<PoseWorkerOutput>) => {
          if (!this.current(epoch)) return
          const message = event.data
          if (message.type === 'ready') {
            this.metrics.resourceLoadMs = message.resourceLoadMs
            this.metrics.modelInitMs = message.initializationMs
            resolve()
          } else if (message.type === 'error') {
            const text = message.stage === 'init'
              ? '本机姿态资源加载或模型初始化失败，请检查网络与浏览器支持后重试。'
              : '本机姿态推理失败，相机已停止，请重新开启。'
            reject(new Error(text))
            this.fail(text)
          } else if (message.type === 'result') this.receive(message)
        }
        worker.onerror = () => {
          if (!this.current(epoch)) return
          const message = '姿态后台线程启动或运行失败，相机已停止。请重新开启或更换浏览器。'
          reject(new Error(message))
          this.fail(message)
        }
        worker.onmessageerror = () => {
          if (!this.current(epoch)) return
          const message = '姿态后台消息无法读取，相机已停止，请重新开启。'
          reject(new Error(message))
          this.fail(message)
        }
      })
      const init: PoseWorkerInput = {
        type: 'init', bundleUrl: this.platform.asset('vision_bundle.js'),
        wasmRoot: this.platform.asset('wasm'), modelUrl: this.platform.asset('pose_landmarker_lite.task'),
      }
      worker.postMessage(init)
      await this.wait(ready, 45_000, '本机姿态模型加载超时，相机已停止。请检查网络后重新开启。')
      if (!this.current(epoch)) return
      await this.wait(video.play(), 10_000, '相机预览启动超时，请重新开启。')
      if (!this.current(epoch)) return
      this.metrics.initMs = this.platform.now() - startAt
      this.startedAt = this.platform.now()
      this.lastResultAt = this.startedAt
      this.publish('lost', '请面向镜头，让双肩、双肘和双手完整入镜。')
      this.emitMetrics(true)
      this.tick(epoch)
    } catch (error) {
      if (error instanceof Cancelled || !this.current(epoch)) return
      this.fail(cameraError(error))
    }
  }

  private tick(epoch: number): void {
    if (!this.current(epoch)) return
    const now = this.platform.now()
    if (this.platform.hidden()) { this.stop('页面已隐藏，相机已停止。返回后请主动重新开启。'); return }
    if (this.flight && now - this.flight.at > 5_000) { this.fail('相机取帧或后台推理超时，相机已停止，请重新开启。'); return }
    if (now - this.lastResultAt > 500) this.lose('画面更新中断，已暂停跟随。')
    if (this.state === 'lost' && this.everTracked) {
      const resting = this.filter.apply(REST_POSE, now, { left: false, right: false })
      if (['left', 'right'].some(side => {
        const key = side as 'left' | 'right'
        return Math.abs(resting[key].shoulder - this.displayed[key].shoulder) > .0001 || Math.abs(resting[key].elbow - this.displayed[key].elbow) > .0001
      })) { this.displayed = resting; this.options.onPose(resting) }
    }
    if (!this.metrics.frames && now - this.startedAt > 10_000) { this.fail('未收到有效相机帧，请检查设备后重新开启。'); return }
    const video = this.options.video
    if (!this.flight && now - this.lastSendAt >= 50 && video.readyState >= 2
      && video.videoWidth > 0 && video.videoHeight > 0 && video.currentTime !== this.lastVideoTime) {
      const scale = Math.min(1, 640 / video.videoWidth, 480 / video.videoHeight)
      const width = Math.max(1, Math.round(video.videoWidth * scale))
      const height = Math.max(1, Math.round(video.videoHeight * scale))
      const id = ++this.nextFrameId
      this.flight = { id, at: now }
      this.lastSendAt = now
      this.lastVideoTime = video.currentTime
      this.metrics.inputWidth = width
      this.metrics.inputHeight = height
      this.platform.bitmap(video, width, height).then(bitmap => {
        if (!this.current(epoch)) { bitmap.close(); return }
        if (this.platform.now() - now > MIRROR_LIMITS.maxFrameAgeMs) {
          bitmap.close()
          this.flight = null
          this.metrics.rejectedFrames++
          this.lose('相机取帧过慢，已暂停跟随。')
          return
        }
        try {
          const frame: PoseWorkerInput = { type: 'frame', id, capturedAt: now, width, height, bitmap }
          this.worker!.postMessage(frame, [bitmap])
        } catch {
          bitmap.close()
          this.fail('当前浏览器无法将画面交给后台推理，请更换浏览器。')
        }
      }, () => { if (this.current(epoch)) this.fail('无法读取相机画面，请重新开启。') })
    }
    this.emitMetrics(false)
    this.timer = this.platform.later(() => this.tick(epoch), 25)
  }

  private receive(message: Extract<PoseWorkerOutput, { type: 'result' }>): void {
    if (!this.flight || message.id !== this.flight.id) return
    const capturedAt = this.flight.at
    this.flight = null
    const now = this.platform.now()
    this.lastResultAt = now
    this.metrics.frames++
    if (Number.isFinite(message.inferenceMs)) this.sample(this.inferenceTimes, message.inferenceMs)
    const mappingStart = this.platform.now()
    const mapped = mapMirrorPose(message.landmarks, message.width, message.height, capturedAt, now, true)
    if (!mapped.ok) {
      this.metrics.rejectedFrames++
      this.lose(mapped.message)
      return
    }
    this.goodStreak++
    const valid = mapped.valid ?? { left: true, right: true }
    for (const side of ['left', 'right'] as const) this.armStreak[side] = valid[side] ? this.armStreak[side] + 1 : 0
    if (this.goodStreak < 2) return
    const ready = { left: valid.left && this.armStreak.left >= 2, right: valid.right && this.armStreak.right >= 2 }
    const pose = this.filter.apply(mapped.pose, now, ready)
    this.displayed = pose
    this.options.onPose(pose)
    this.sample(this.mappingTimes, this.platform.now() - mappingStart)
    this.metrics.acceptedFrames++
    if (this.lastAcceptedAt !== null) this.sample(this.poseIntervals, now - this.lastAcceptedAt)
    this.lastAcceptedAt = now
    if (!valid.left || !valid.right) {
      if (this.state === 'tracking') this.metrics.losses++
      this.publish('partial', mapped.message ?? '一侧手臂已暂停，可靠一侧继续跟随。')
    } else if (this.state !== 'tracking') {
      if (this.everTracked) this.metrics.recoveries++
      this.everTracked = true
      this.publish('tracking', '正在跟随抬手 · 镜子关系 · 不判断动作对错')
      this.emitMetrics(true)
    }
    this.everTracked = true
  }

  private lose(message: string): void {
    if (this.state === 'tracking') this.metrics.losses++
    this.goodStreak = 0
    this.lastAcceptedAt = null
    this.armStreak = { left: 0, right: 0 }
    if (this.state !== 'lost') this.filter.pause()
    this.publish('lost', message)
  }

  private sample(samples: number[], value: number): void {
    if (!Number.isFinite(value) || value < 0) return
    samples.push(value)
    if (samples.length > 1_200) samples.shift()
  }

  private emitMetrics(force: boolean): void {
    if (this.disposed) return
    const now = this.platform.now()
    if (!force && now - this.lastMetricsAt < 500) return
    this.lastMetricsAt = now
    const medianInterval = percentile(this.poseIntervals, 0.5)
    this.metrics.inferenceP50Ms = percentile(this.inferenceTimes, 0.5)
    this.metrics.inferenceP95Ms = percentile(this.inferenceTimes, 0.95)
    this.metrics.mappingP50Ms = percentile(this.mappingTimes, 0.5)
    this.metrics.mappingP95Ms = percentile(this.mappingTimes, 0.95)
    this.metrics.poseHz = ['tracking', 'partial'].includes(this.state) && medianInterval ? 1_000 / medianInterval : 0
    this.metrics.activeTracks = this.stream?.getTracks().filter(track => track.readyState === 'live').length ?? 0
    this.metrics.inFlight = Boolean(this.flight)
    this.options.onMetrics({ ...this.metrics })
  }

  private release(): void {
    this.epoch++
    for (const cancel of [...this.pending]) cancel()
    if (this.timer !== null) this.platform.cancel(this.timer)
    this.timer = null
    for (const remove of this.trackListeners) remove()
    this.trackListeners = []
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    this.options.video.pause()
    this.options.video.srcObject = null
    if (this.worker) {
      this.worker.onmessage = null
      this.worker.onerror = null
      this.worker.onmessageerror = null
      this.worker.terminate()
      this.worker = null
    }
    this.flight = null
    this.goodStreak = 0
    this.lastAcceptedAt = null
    this.filter.pause()
  }

  private fail(message: string): void {
    this.release()
    this.publish('error', message)
    this.emitMetrics(true)
  }

  stop(reason = '镜像已停止，相机已关闭。'): void {
    if (this.disposed) return
    this.release()
    this.publish('stopped', reason)
    this.emitMetrics(true)
  }

  dispose(): void {
    if (this.disposed) return
    this.stop()
    this.disposed = true
    this.removeVisibility()
    this.inferenceTimes = []
    this.mappingTimes = []
    this.poseIntervals = []
  }
}
