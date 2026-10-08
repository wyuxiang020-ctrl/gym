import { useCallback, useEffect, useRef, useState } from 'react'
import { PandaStage } from './PandaStage'
import { copyPose, REST_POSE, type CameraView, type DisplayMode, type RenderStats } from './types'
import { PRESET_DURATION, presetPose, type PresetArm } from './preset'
import type { MirrorSession, MirrorMetrics, MirrorState } from './mirror/MirrorSession'
import './companion.css'

type Mode = 'preset' | 'mirror'
const stateLabels: Record<string, string> = { idle: '尚未开启', preparing: '准备中', tracking: '正在跟随', lost: '跟随已暂停', error: '暂时无法跟随', stopped: '摄像头已停止' }
const ms = (value: number | null | undefined) => value == null ? '未测' : `${value.toFixed(1)} ms`

export default function CompanionLab() {
  const [mode, setMode] = useState<Mode>('preset')
  const [display, setDisplay] = useState<DisplayMode>('clear')
  const [pixelSize, setPixelSize] = useState<2 | 4 | 6>(4)
  const [view, setView] = useState<CameraView>('front')
  const [arm, setArm] = useState<PresetArm>('both')
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [mirrorState, setMirrorState] = useState<MirrorState>('idle')
  const [message, setMessage] = useState('先选择一个模式，和熊猫一起试试。')
  const [metrics, setMetrics] = useState<MirrorMetrics | null>(null)
  const [renderStats, setRenderStats] = useState<RenderStats | null>(null)
  const [renderError, setRenderError] = useState('')
  const [notice, setNotice] = useState('')
  const [renderKey, setRenderKey] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const session = useRef<MirrorSession | null>(null)
  const generation = useRef(0)
  const activeMode = useRef<Mode>('preset')
  const clock = useRef({ playing: false, started: 0, elapsed: 0, arm: 'both' as PresetArm })
  const mirrorPose = useRef(copyPose(REST_POSE))

  const elapsed = useCallback((now: number) => Math.min(PRESET_DURATION, clock.current.elapsed + (clock.current.playing ? now - clock.current.started : 0)), [])
  const getPose = useCallback((now: number) => activeMode.current === 'preset' ? presetPose(elapsed(now), clock.current.arm) : mirrorPose.current, [elapsed])
  const stopMirror = useCallback((reason = '摄像头已停止。需要时请再次主动开启。') => {
    generation.current += 1
    session.current?.dispose()
    session.current = null
    mirrorPose.current = copyPose(REST_POSE)
    setMirrorState('stopped')
    setMetrics(previous => previous ? { ...previous, activeTracks: 0, inFlight: false, poseHz: 0 } : null)
    setMessage(reason)
  }, [])

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (!clock.current.playing) return
      const value = elapsed(performance.now())
      setProgress(value)
      if (value >= PRESET_DURATION) {
        clock.current.elapsed = PRESET_DURATION
        clock.current.playing = false
        setPlaying(false)
      }
    }, 100)
    const hide = () => {
      if (!document.hidden) return
      clock.current.elapsed = elapsed(performance.now())
      clock.current.playing = false
      setPlaying(false)
      if (activeMode.current === 'mirror') stopMirror('页面已隐藏，摄像头与跟随已停止。返回后请主动开启。')
    }
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', hide)
      generation.current += 1
      session.current?.dispose()
      session.current = null
    }
  }, [elapsed, stopMirror])

  function changeMode(next: Mode) {
    if (next === mode) return
    stopMirror()
    clock.current.playing = false
    clock.current.elapsed = 0
    activeMode.current = next
    setPlaying(false)
    setProgress(0)
    setMode(next)
    setMetrics(null)
    setMirrorState('idle')
    setView('front')
    setMessage(next === 'mirror' ? '准备好后再开启摄像头，画面仅在本机处理。' : '预设动作无需摄像头。')
  }

  function togglePlayback() {
    const now = performance.now()
    if (clock.current.playing) {
      clock.current.elapsed = elapsed(now)
      clock.current.playing = false
    } else {
      if (clock.current.elapsed >= PRESET_DURATION) clock.current.elapsed = 0
      clock.current.started = now
      clock.current.playing = true
    }
    setPlaying(clock.current.playing)
    setProgress(clock.current.elapsed)
  }

  function seek(value: number) {
    clock.current.playing = false
    clock.current.elapsed = value
    setPlaying(false)
    setProgress(value)
  }

  async function startMirror() {
    stopMirror()
    const token = generation.current
    setMirrorState('preparing')
    setMessage('正在准备摄像头，请按浏览器提示选择是否允许。')
    setMetrics(null)
    try {
      const { MirrorSession: Session } = await import('./mirror/MirrorSession')
      if (token !== generation.current || activeMode.current !== 'mirror' || document.hidden || !video.current) return
      const next = new Session({
        video: video.current,
        onState: (state, detail) => {
          if (generation.current !== token) return
          setMirrorState(state)
          setMessage(detail)
        },
        onPose: pose => { if (generation.current === token) mirrorPose.current = pose },
        onMetrics: value => { if (generation.current === token) setMetrics(value) },
      })
      session.current = next
      await next.start()
    } catch {
      if (generation.current !== token) return
      session.current?.dispose()
      session.current = null
      setMirrorState('error')
      setMessage('跟随资源无法加载。请重试，或返回预设动作。')
    }
  }

  const onRenderError = useCallback((detail: string) => {
    setRenderError(detail)
    stopMirror('角色渲染暂停，摄像头已停止。恢复画面后可重新开启。')
  }, [stopMirror])

  const activeCamera = mirrorState === 'preparing' || mirrorState === 'tracking' || mirrorState === 'lost'
  return (
    <main className="companion-lab" data-companion-mode={mode} data-mirror-state={mirrorState} data-display-mode={display} data-playing={playing} data-preset={arm} data-view={view}>
      <header className="lab-header">
        <a className="lab-brand" href="/" onClick={() => stopMirror()}>GYM<span> / 伙伴实验</span></a>
        <a className="lab-exit" href="/" onClick={() => stopMirror()}>退出实验 <span aria-hidden="true">↗</span></a>
      </header>
      <section className="lab-intro">
        <div><p className="lab-eyebrow">阶段 1 · 本地实验</p><h1>训练伙伴实验室</h1><p className="lab-lead">从一次抬手，认识你的新伙伴。</p></div>
        <span className="lab-version">原创熊猫 · V4 PoC</span>
      </section>
      <div className="lab-layout">
        <section className="lab-stage-card" aria-label="熊猫角色画面">
          <div className="lab-stage-heading"><span><i className="lab-dot" /> {mode === 'preset' ? '预设动作实验' : stateLabels[mirrorState]}</span><span>同一个角色 · 两种显示</span></div>
          <div className="lab-stage-canvas" aria-label="实时三维角色">
            {!renderError && <PandaStage key={renderKey} getPose={getPose} display={display} pixelSize={pixelSize} view={view} onStats={setRenderStats} onError={onRenderError} onNotice={setNotice} />}
            {renderError && <div className="lab-render-error" role="alert"><strong>角色画面暂不可用</strong><p>{renderError}</p><button onClick={() => { setRenderError(''); setRenderKey(k => k + 1) }}>重新加载角色</button></div>}
          </div>
          <div className="lab-view-row" role="group" aria-label="角色视角">
            {([['front', '正面'], ['three-quarter', '斜侧'], ['side', '侧面']] as const).map(([value, label]) => <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}
          </div>
          <div className="lab-stage-caption"><span>圆润一点，动作清楚一点。</span><span>实时三维渲染</span></div>
        </section>
        <aside className="lab-controls" aria-label="实验控制">
          <div className="lab-mode-tabs" role="group" aria-label="实验模式">
            <button aria-pressed={mode === 'preset'} onClick={() => changeMode('preset')}><span>01</span> 预设动作实验</button>
            <button aria-pressed={mode === 'mirror'} onClick={() => changeMode('mirror')}><span>02</span> 跟随我的抬手</button>
          </div>
          <section className="lab-control-block">
            <h2>先选一种显示</h2><p className="lab-help">动作保持一致，只改变画面的颗粒感。</p>
            <div className="lab-segments" role="group" aria-label="渲染显示">
              <button aria-pressed={display === 'clear'} onClick={() => { setDisplay('clear'); setNotice('') }}>清晰</button>
              <button aria-pressed={display === 'pixel'} onClick={() => { setDisplay('pixel'); setNotice('') }}>像素</button>
            </div>
            {display === 'pixel' && <div className="lab-pixel-row"><span>颗粒大小</span><div role="group" aria-label="像素强度">{([[2, '细'], [4, '中'], [6, '粗']] as const).map(([size, label]) => <button key={size} aria-pressed={pixelSize === size} onClick={() => setPixelSize(size)}>{label}</button>)}</div></div>}
            {notice && <p className="lab-warning" role="status">{notice}</p>}
          </section>
          {mode === 'preset' ? <section className="lab-control-block lab-action-block">
            <h2>试着抬起手</h2><p className="lab-help">用于检查角色动作，不是专业健身教学。</p>
            <div className="lab-segments lab-arms" role="group" aria-label="预设抬手">{([['screen-left', '画面左手'], ['screen-right', '画面右手'], ['both', '双手']] as const).map(([value, label]) => <button key={value} aria-pressed={arm === value} onClick={() => { clock.current.arm = value; setArm(value); seek(0) }}>{label}</button>)}</div>
            <div className="lab-playback"><button className="lab-primary" disabled={!!renderError} onClick={togglePlayback}><span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span> {playing ? '暂停动作' : '播放动作'}</button><button className="lab-secondary" onClick={() => seek(0)}>重新开始</button></div>
            <label className="lab-timeline">动作进度 <span>{(progress / 1000).toFixed(1)} / 8.0 秒</span><input aria-label="动作进度" type="range" min="0" max={PRESET_DURATION} step="50" value={progress} onChange={event => seek(Number(event.target.value))} /></label>
            <p className="lab-tip">暂停后切换显示或视角，可以仔细看看肩膀和手肘。</p>
          </section> : <section className="lab-control-block lab-action-block">
            <h2>和它一起抬手</h2><p className="lab-help">面向镜头，固定机位，让肩、肘和手腕都入镜。空手从身体两侧向外抬起，不支持交叉手臂或向镜头伸手。</p>
            <div className="lab-camera-preview"><video ref={video} playsInline muted autoPlay aria-label="镜像摄像头预览" />{!activeCamera && <span>摄像头未开启</span>}</div>
            <p className="lab-privacy">点击开启后才请求摄像头权限。本机处理，不录音，不保存或上传画面。首次开启需要加载本地模型资源。</p>
            <button className="lab-primary lab-camera-button" disabled={!!renderError} onClick={() => activeCamera ? stopMirror() : void startMirror()}>{activeCamera ? '停止摄像头' : '开启摄像头'}</button>
            <div className={`lab-camera-status lab-camera-status-${mirrorState}`} role="status"><strong>{stateLabels[mirrorState]}</strong><p>{message}</p></div>
            <p className="lab-tip">像镜子一样：你抬左手，正面画面左侧的熊猫手臂抬起。仅跟随，不评分、不纠错。遮挡或离开时暂停。</p>
          </section>}
        </aside>
      </div>
      <div className="lab-footnotes"><p><span aria-hidden="true">○</span> 实验独立运行，不修改你的训练记录。</p><p>清晰模式先看关节，像素模式再看风格。</p></div>
      <details className="lab-diagnostics"><summary>实验状态与性能</summary><p>以下是本机软件运行指标；真实手机与真人镜像体验需要另外验证。推理耗时不等于人体动作到屏幕的完整延迟。</p>
        <dl><div><dt>渲染频率</dt><dd>{renderStats ? `${renderStats.fps.toFixed(1)} FPS` : '等待采样'}</dd></div><div><dt>渲染帧间隔 p50 / p95</dt><dd>{renderStats ? `${renderStats.frameP50Ms.toFixed(1)} / ${renderStats.frameP95Ms.toFixed(1)} ms` : '—'}</dd></div><div><dt>画布 / 像素比</dt><dd>{renderStats ? `${renderStats.width} × ${renderStats.height} / ${renderStats.dpr}` : '—'}</dd></div><div><dt>绘制缓冲</dt><dd>{renderStats ? `${renderStats.bufferWidth} × ${renderStats.bufferHeight}` : '—'}</dd></div><div><dt>模型准备</dt><dd>{metrics ? ms(metrics.initMs) : '未开启'}</dd></div><div><dt>姿态更新</dt><dd>{metrics ? `${metrics.poseHz.toFixed(1)} Hz` : '未测'}</dd></div><div><dt>推理 p50 / p95</dt><dd>{metrics ? `${ms(metrics.inferenceP50Ms)} / ${ms(metrics.inferenceP95Ms)}` : '未测'}</dd></div><div><dt>丢失 / 恢复</dt><dd>{metrics ? `${metrics.losses} / ${metrics.recoveries}` : '—'}</dd></div></dl>
      </details>
    </main>
  )
}
