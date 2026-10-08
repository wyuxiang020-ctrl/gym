import { useCallback, useEffect, useRef, useState } from 'react'
import { PandaStage } from './PandaStage'
import { copyPose, REST_POSE, type DisplayMode, type RenderStats } from './types'
import { D_VIEWS, type DView } from './dpanda/model'
import { D_ACTIONS, duration, mirrorFrame, withExpression, type DAction, type RaiseSide } from './dpanda/motion'
import { D_EXPRESSIONS, type ExpressionId } from './dpanda/expressions'
import { DPlayer } from './dpanda/player'
import type { MirrorSession, MirrorMetrics, MirrorState } from './mirror/MirrorSession'
import './companion.css'

type Mode = 'preset' | 'mirror'
const labels: Record<string, string> = { idle: '空手准备', preparing: '准备中', tracking: '正在跟随', partial: '一侧暂时看不清', lost: '跟随已暂停', error: '暂时无法跟随', stopped: '摄像头已停止' }
const boards = [
  ['D2-character-accessories.png', 'D2 · 本体与道具'], ['D2-expressions.png', 'D2 · 常态表情'], ['D2-key-poses.png', 'D2 · 常态姿势'],
  ['D3-movement.png', 'D3 · 动作峰值'], ['D3-expressions.png', 'D3 · 夸张表情'], ['D4-hand-interaction.png', 'D4 · 抬手互动'], ['D1-character-turnaround.png', 'D1 · 初始转面'],
]
export default function CompanionLab() {
  const [mode, setMode] = useState<Mode>('preset')
  const [display, setDisplay] = useState<DisplayMode>('clear')
  const [pixelSize, setPixelSize] = useState<2 | 4 | 6>(4)
  const [view, setView] = useState<DView>('front')
  const [face, setFace] = useState<ExpressionId | 'auto'>('auto')
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [loop, setLoop] = useState(false)
  const [snapshot, setSnapshot] = useState({ action: 'idle' as DAction, time: 0, playing: false, pending: null as DAction | null, phase: '自然站立' })
  const [side, setSide] = useState<RaiseSide>('left')
  const [mirrorState, setMirrorState] = useState<MirrorState>('idle')
  const [message, setMessage] = useState('空手准备好了。点击开启后，才会请求摄像头权限。')
  const [metrics, setMetrics] = useState<MirrorMetrics | null>(null)
  const [stats, setStats] = useState<RenderStats | null>(null)
  const [renderError, setRenderError] = useState('')
  const [notice, setNotice] = useState('')
  const [renderKey, setRenderKey] = useState(0)
  const [showDesign, setShowDesign] = useState(false)
  const [board, setBoard] = useState(boards[0][0])
  const player = useRef(new DPlayer())
  const video = useRef<HTMLVideoElement>(null)
  const session = useRef<MirrorSession | null>(null)
  const generation = useRef(0)
  const activeMode = useRef<Mode>('preset')
  const expressionChoice = useRef<ExpressionId | 'auto'>('auto')
  const mirrorPose = useRef(copyPose(REST_POSE))
  const highSince = useRef<number | null>(null)
  const wasHigh = useRef(false)
  const sync = useCallback(() => {
    const p = player.current, now = performance.now(), time = p.time(now)
    setSnapshot({ action: p.action, time, playing: p.playing, pending: p.pending, phase: p.frame(now).phase })
  }, [])
  const getPose = useCallback((now: number) => activeMode.current === 'mirror'
    ? mirrorFrame(mirrorPose.current, now, highSince.current)
    : withExpression(player.current.frame(now), expressionChoice.current), [])
  const stopMirror = useCallback((reason = '摄像头已停止。需要时请再次主动开启。') => {
    generation.current++; session.current?.dispose(); session.current = null
    mirrorPose.current = copyPose(REST_POSE); highSince.current = null; wasHigh.current = false
    setMirrorState('stopped'); setMessage(reason)
    setMetrics(previous => previous ? { ...previous, activeTracks: 0, inFlight: false, poseHz: 0 } : null)
  }, [])
  useEffect(() => {
    const p = player.current; p.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!p.reduced && !document.hidden) p.resume(performance.now())
    const timer = window.setInterval(sync, 80)
    const hidden = () => {
      if (!document.hidden) return
      p.pause(performance.now()); sync()
      if (activeMode.current === 'mirror') stopMirror('页面已隐藏，摄像头与跟随已停止。返回后请主动开启。')
    }
    document.addEventListener('visibilitychange', hidden)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hidden); generation.current++; session.current?.dispose(); session.current = null }
  }, [sync, stopMirror])
  function changeMode(next: Mode) {
    if (next === mode) return
    stopMirror(); player.current.reset(); activeMode.current = next; setMode(next); setView('front'); setMetrics(null); setMirrorState('idle'); sync()
    setFace('auto'); expressionChoice.current = 'auto'
    setMessage(next === 'mirror' ? '已跳过道具准备，帽子和竹子放在旁边。点击开启后才会请求相机。' : '普通表演无需摄像头。')
  }
  async function startMirror() {
    stopMirror(); const token = generation.current
    setMirrorState('preparing'); setMessage('正在准备摄像头，请按浏览器提示选择是否允许。'); setMetrics(null)
    try {
      const { MirrorSession: Session } = await import('./mirror/MirrorSession')
      if (token !== generation.current || activeMode.current !== 'mirror' || document.hidden || !video.current) return
      const next = new Session({ video: video.current,
        onState: (state, detail) => { if (generation.current === token) { setMirrorState(state); setMessage(detail) } },
        onPose: pose => {
          if (generation.current !== token) return
          mirrorPose.current = pose
          const high = Math.max(pose.left.shoulder, pose.right.shoulder) > 1.6
          if (high && !wasHigh.current) highSince.current = performance.now()
          if (!high) highSince.current = null
          wasHigh.current = high
        },
        onMetrics: value => { if (generation.current === token) setMetrics(value) },
      })
      session.current = next; await next.start()
    } catch {
      if (generation.current !== token) return
      session.current?.dispose(); session.current = null; setMirrorState('error'); setMessage('跟随资源无法加载。可以重试，或返回角色表演。')
    }
  }
  function play(action: DAction) { player.current.request(action, performance.now()); sync() }
  function seek(value: number) { player.current.seek(value); sync() }
  const onRenderError = useCallback((detail: string) => {
    player.current.pause(performance.now()); sync(); setRenderError(detail); stopMirror('角色画布已暂停，摄像头已停止。恢复后请主动开启。')
  }, [sync, stopMirror])
  const activeCamera = ['preparing', 'tracking', 'partial', 'lost'].includes(mirrorState)
  const action = D_ACTIONS.find(a => a.id === snapshot.action)!
  return <main className="companion-lab" data-companion-mode={mode} data-mirror-state={mirrorState} data-playing={snapshot.playing} data-action={snapshot.action} data-view={view} data-version="D1">
    <header className="lab-header"><a className="lab-brand" href="/" onClick={() => stopMirror()}>GYM<span> / D 熊猫</span></a><a className="lab-exit" href="/" onClick={() => stopMirror()}>退出实验 ↗</a></header>
    <section className="lab-intro"><div><p className="lab-eyebrow">D PANDA / 新的陪伴</p><h1>短短的爪，满满的精神。</h1><p className="lab-lead">可以安静陪着你，也可以一起动起来。</p></div><span className="lab-version">D 熊猫 · 全新制作</span></section>
    <div className="lab-layout">
      <section className="lab-stage-card" aria-label="D 熊猫角色画面">
        <div className="lab-stage-heading"><span><i className="lab-dot" />{mode === 'preset' ? '角色表演' : labels[mirrorState]}</span><span>同一只 D · 清晰与像素</span></div>
        <div className="lab-stage-canvas" aria-label="实时 D 熊猫">
          {!renderError && <PandaStage key={renderKey} getPose={getPose} display={display} pixelSize={pixelSize} view={view} onStats={setStats} onError={onRenderError} onNotice={setNotice} />}
          {renderError && <div className="lab-render-error" role="alert"><strong>角色画面暂不可用</strong><p>{renderError}</p><button onClick={() => { setRenderError(''); setRenderKey(k => k + 1) }}>重新加载角色</button></div>}
        </div>
        <div className="lab-view-row" role="group" aria-label="角色转面">{D_VIEWS.map(v => <button key={v.id} disabled={mode === 'mirror' && v.id !== 'front'} aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>)}</div>
        <div className="lab-stage-caption"><span>{mode === 'preset' ? snapshot.phase : '空手 · 正面跟随'}</span><span>腕结只在自身左腕</span></div>
      </section>
      <aside className="lab-controls" aria-label="伙伴控制">
        <div className="lab-mode-tabs" role="group" aria-label="体验模式"><button aria-pressed={mode === 'preset'} onClick={() => changeMode('preset')}>角色表演</button><button aria-pressed={mode === 'mirror'} onClick={() => changeMode('mirror')}>一起动</button></div>
        <section className="lab-control-block">
          <div className="lab-segments" role="group" aria-label="显示方式"><button aria-pressed={display === 'clear'} onClick={() => setDisplay('clear')}>清晰</button><button aria-pressed={display === 'pixel'} onClick={() => setDisplay('pixel')}>像素</button></div>
          {display === 'pixel' && <div className="lab-pixel-row"><span>颗粒大小</span><div>{([[2,'细'],[4,'中'],[6,'粗']] as const).map(([size,label]) => <button key={size} aria-pressed={pixelSize === size} onClick={() => setPixelSize(size)}>{label}</button>)}</div></div>}
          {notice && <p className="lab-warning" role="status">{notice}</p>}
        </section>
        {mode === 'preset' ? <section className="lab-control-block lab-action-block">
          <h2>{action.label}</h2><p className="lab-help lab-action-hint">{action.hint}</p>
          <button className="lab-sample" disabled={!!renderError} aria-pressed={snapshot.action === 'raise'} onClick={() => play('raise')}>先看抬爪样片 <span>抬起 → 中段停 → 举高 → 放下</span></button>
          <div className="lab-character-actions" role="group" aria-label="D 熊猫动作">{D_ACTIONS.filter(a => !['raise','rise'].includes(a.id)).map(a => <button key={a.id} disabled={!!renderError} aria-pressed={snapshot.action === a.id} onClick={() => play(a.id)}>{a.label}</button>)}</div>
          {['raise','stretch'].includes(snapshot.action) && <div className="lab-segments lab-arms" role="group" aria-label="抬爪方向">{([['right','画面左爪'],['left','画面右爪'],['both','两只一起']] as const).map(([value,label]) => <button key={value} aria-pressed={side === value} onClick={() => { setSide(value); player.current.side = value; seek(0) }}>{label}</button>)}</div>}
          {snapshot.pending && <p className="lab-queue" role="status">先完成收势，再开始「{D_ACTIONS.find(a => a.id === snapshot.pending)?.label}」。</p>}
          <div className="lab-playback"><button className="lab-primary" disabled={!!renderError} onClick={() => { const p = player.current, now = performance.now(); if (p.playing) p.pause(now); else if (p.action === 'rest' && p.time(now) >= duration('rest')) p.request('rise', now); else { if (p.time(now) >= duration(p.action)) p.seek(0); p.resume(now) } sync() }}>{snapshot.playing ? '暂停动作' : '播放动作'}</button><button className="lab-secondary" onClick={() => seek(0)}>回到开头</button><button className="lab-secondary" onClick={() => play(snapshot.action === 'rest' ? 'rise' : 'idle')}>{snapshot.action === 'rest' ? '起身' : '收势结束'}</button></div>
          <label className="lab-timeline">动作进度 <span>{(snapshot.time / 1000).toFixed(1)} / {(action.duration / 1000).toFixed(1)} 秒</span><input aria-label="动作进度" type="range" min={0} max={action.duration} step={20} value={snapshot.time} onChange={e => seek(Number(e.target.value))} /></label>
          <div className="lab-preferences"><label className="lab-loop"><input type="checkbox" checked={loop} onChange={e => { setLoop(e.target.checked); player.current.loop = e.target.checked }} />循环表演</label><label className="lab-loop"><input type="checkbox" checked={reduced} onChange={e => { setReduced(e.target.checked); player.current.setReduced(e.target.checked, performance.now()); sync() }} />减少动态</label></div>
          <label className="lab-expression-label">表情 <select aria-label="表情" value={face} onChange={e => { const value = e.target.value as ExpressionId | 'auto'; setFace(value); expressionChoice.current = value }}><option value="auto">跟随表演</option>{D_EXPRESSIONS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
          <p className="lab-tip">暂停可检查身体、表情和道具。跳跃途中换动作会先落地；这些表演不代表健身教学。</p>
        </section> : <section className="lab-control-block lab-action-block">
          <h2>你抬手，它跟上</h2><p className="lab-help">停住就保持，放下就回落。两只手分别跟随；帽子和竹子先放在旁边。</p>
          <div className="lab-camera-preview"><video ref={video} playsInline muted autoPlay aria-label="镜像摄像头预览" />{!activeCamera && <span>摄像头未开启</span>}</div>
          <p className="lab-privacy">点击后才请求权限。本机处理，不录音、不保存或上传画面。请让肩、肘、手腕都在画面中。</p>
          <button className="lab-primary lab-camera-button" disabled={!!renderError} onClick={() => activeCamera ? stopMirror() : void startMirror()}>{activeCamera ? '停止摄像头' : '开启摄像头'}</button>
          <div className={`lab-camera-status lab-camera-status-${mirrorState}`} role="status"><strong>{labels[mirrorState]}</strong><p>{message}</p></div>
          <p className="lab-tip">画面同侧对应：你抬右手，画面右侧带腕结的熊猫左爪抬起。表情只是回应，不识别情绪或手指，不计次或评分。</p>
        </section>}
      </aside>
    </div>
    <section className="lab-design"><button className="lab-secondary" onClick={() => setShowDesign(v => !v)} aria-expanded={showDesign}>查看导入的设计原图</button>{showDesign && <div><select aria-label="设计原图" value={board} onChange={e => setBoard(e.target.value)}>{boards.map(([file,label]) => <option key={file} value={file}>{label}</option>)}</select><img src={`/companion-assets/d-panda/design/${board}`} alt={boards.find(b => b[0] === board)?.[1]} /><p>七张原图完整保留；上方角色为据此重新制作的可编辑连续动画。</p></div>}</section>
    <div className="lab-footnotes"><p>独立伙伴入口，不修改训练记录。</p><p>形象依据：2026-10-08 D 熊猫交付包</p></div>
    <details className="lab-diagnostics"><summary>运行状态与验证范围</summary><p>当前使用本机二维曲线绘制。真实相机与物理手机表现需单独实测；桌面帧率不等于抬手端到端延迟。</p><dl><div><dt>绘制频率</dt><dd>{stats ? `${stats.fps.toFixed(1)} FPS` : '等待采样'}</dd></div><div><dt>帧间隔 p50 / p95</dt><dd>{stats ? `${stats.frameP50Ms.toFixed(1)} / ${stats.frameP95Ms.toFixed(1)} ms` : '—'}</dd></div><div><dt>绘制缓冲</dt><dd>{stats ? `${stats.bufferWidth} × ${stats.bufferHeight}` : '—'}</dd></div><div><dt>姿态更新</dt><dd>{metrics ? `${metrics.poseHz.toFixed(1)} Hz` : '未开启'}</dd></div></dl></details>
  </main>
}
