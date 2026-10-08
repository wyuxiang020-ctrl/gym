import { useEffect, useRef, useState } from 'react'
import { OriginalIdleRenderer } from './OriginalIdleRenderer'
import { ACTIONS, actionDefinition, actionPhase, actionPose, deformAction, type ActionId } from './actionMotion'
import './gentle.css'
import './idle.css'
import './actions.css'

const ROOT = '/companion-assets/d-panda/'

export default function ActionSamples() {
  const [selected, setSelected] = useState<ActionId>('encourage')
  const pending = useRef<ActionId | null>(null)
  const [requested, setRequested] = useState<ActionId | null>(null)
  const activePlayer = useRef(false)
  function select(id: ActionId) {
    if (id === selected) { pending.current = null; setRequested(null); return }
    if (activePlayer.current) {
      pending.current = id; setRequested(id)
    } else { pending.current = null; setRequested(null); setSelected(id) }
  }
  function finished() {
    const next = pending.current
    if (next) { pending.current = null; setRequested(null); setSelected(next) }
  }
  return <main className="original-lab gentle-lab idle-lab actions-lab" data-version="D-original-actions" data-nod-revision="2" data-action={selected}>
    <header className="original-header"><a href="/">GYM <span>/ D 熊猫</span></a><nav><a href="/?companion-lab=1&review=idle">呼吸与眨眼</a><a href="/?companion-lab=1&review=originals">原图核对 ↗</a></nav></header>
    <section className="original-intro"><p className="original-eyebrow">D PANDA / 三个小动作</p><h1>打个招呼，舒展一下。</h1><p>点头鼓励 · 扶帽致意 · 轻轻伸展</p></section>
    <div className="actions-picker" role="group" aria-label="选择动作">{ACTIONS.map((action, index) => <button key={action.id} data-action-choice={action.id} aria-pressed={selected === action.id} onClick={() => select(action.id)}><span>0{index + 1}</span><strong>{action.title}</strong><small>{action.duration / 1000} 秒{requested === action.id ? ' · 等当前动作收稳' : ''}</small></button>)}</div>
    {requested && <p className="actions-pending" role="status">当前动作收稳后，切换到{actionDefinition(requested).title}。<button onClick={() => { pending.current = null; setRequested(null) }}>取消切换</button></p>}
    <ActionPlayer key={selected} id={selected} onFinished={finished} playerRef={activePlayer} />
    <details className="original-source gentle-source"><summary>原稿与动画参考</summary><p>点头使用 D2 空手站姿；扶帽使用 D2“招呼·戴帽”；伸展使用 D2 八姿势中的“轻轻伸展”。各段直接沿用对应原画，原 PNG 完整保留，没有新绘制角色。</p><p>动作从对应原画姿势出发并回到该姿势。扶帽段保持爪与帽檐接触；伸展段保留原稿的抬爪与闭眼造型。三个样片分别审看，切换属于样片选择。</p><p>依据 <a href="https://www.adobe.com/creativecloud/animation/discover/principles-of-animation.html" target="_blank" rel="noreferrer">Adobe 动画原则</a> 与 <a href="https://esotericsoftware.com/blog/Offsetting-Spine-Tips-2" target="_blank" rel="noreferrer">Spine 错时动画教程</a>，加入准备、弧线、不同速度和头爪跟随。使用原图局部变形，动态帧会经过纹理采样。</p></details>
  </main>
}

function ActionPlayer({ id, onFinished, playerRef }: { id: ActionId; onFinished: () => void; playerRef: React.RefObject<boolean> }) {
  const definition = actionDefinition(id)
  const canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<OriginalIdleRenderer | null>(null), clock = useRef(0)
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('')
  const [reference, setReference] = useState(false), [backdrop, setBackdrop] = useState('paper')
  const finished = useRef(onFinished)
  useEffect(() => { finished.current = onFinished }, [onFinished])
  useEffect(() => { playerRef.current = playing }, [playing, playerRef])
  const [x, y, width, height] = definition.crop
  const [offsetX, offsetY] = definition.offset
  const layerStyle = { left: `${offsetX / 480 * 100}%`, top: `${offsetY / 560 * 100}%`, width: `${width * definition.scale / 480 * 100}%`, height: `${height * definition.scale / 560 * 100}%` }

  useEffect(() => {
    let disposed = false, engine: OriginalIdleRenderer | null = null
    const target = canvas.current!
    const fail = (message: string) => { if (!disposed) { setError(message); setReady(false); setPlaying(false) } }
    try {
      engine = new OriginalIdleRenderer(target, {
        width, height, stage: [480, 560], placement: [definition.scale, offsetX, offsetY], texture: ROOT + definition.texture,
        eyes: id === 'encourage' ? ROOT + 'idle/closed-eyes-original.svg' : undefined,
        sample: milliseconds => { const pose = actionPose(id, milliseconds); return { blink: pose.blink, deform: (px, py) => deformAction(id, px, py, pose) } },
      })
      renderer.current = engine
      const shadow = new Image(); shadow.src = ROOT + definition.shadow
      void Promise.all([engine.initialize(), shadow.decode()]).then(() => { if (!disposed) { engine!.draw(clock.current); setReady(true) } }).catch(() => fail('原画素材暂时无法加载，请重试。'))
    } catch { fail('动画暂时无法初始化，请刷新重试；原图核对仍可使用。') }
    const resize = new ResizeObserver(() => { if (!disposed) engine?.draw(clock.current) }); resize.observe(target)
    const lost = (event: Event) => { event.preventDefault(); fail('动画画面暂时中断，请重新加载。') }
    const hide = () => { if (document.hidden) setPlaying(false) }
    target.addEventListener('webglcontextlost', lost); document.addEventListener('visibilitychange', hide)
    return () => { disposed = true; resize.disconnect(); engine?.dispose(); renderer.current = null; target.removeEventListener('webglcontextlost', lost); document.removeEventListener('visibilitychange', hide) }
  }, [id, width, height, definition, offsetX, offsetY])

  useEffect(() => { if (ready && !error) renderer.current?.draw(time) }, [time, ready, error])
  useEffect(() => {
    if (!playing || !ready || error) return
    let frame = 0
    const started = performance.now() - clock.current
    const tick = (now: number) => {
      const next = Math.min(definition.duration, now - started)
      clock.current = next; setTime(next)
      if (next < definition.duration) frame = requestAnimationFrame(tick)
      else { setPlaying(false); finished.current() }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, ready, error, definition.duration])
  function seek(next: number) { const value = Math.max(0, Math.min(definition.duration, next)); setPlaying(false); clock.current = value; setTime(value) }
  function play() { if (!ready || error) return; setReference(false); if (clock.current >= definition.duration) { clock.current = 0; setTime(0) }; setPlaying(true) }
  return <div className="original-layout" data-playing={playing} data-duration={definition.duration}>
    <section className="original-stage" aria-label={`${definition.title}样片`}>
      <div className="original-stage-heading"><h2>{reference ? '同位置原图' : actionPhase(id, time)}</h2><span>{playing ? '正在播放' : time === definition.duration ? '已完成' : '暂停检查'}</span></div>
      <div className={`gentle-plane actions-plane gentle-backdrop-${backdrop}`}>
        <img className="gentle-layer gentle-ground" style={layerStyle} src={ROOT + definition.shadow} alt="" hidden={reference || !!error} />
        <canvas ref={canvas} className="idle-canvas" aria-label={`${definition.title}原画动画`} aria-hidden={reference || !!error} style={{ visibility: reference || error ? 'hidden' : 'visible' }} />
        {reference && <svg className="gentle-layer gentle-reference" style={layerStyle} viewBox={`${x} ${y} ${width} ${height}`} role="img" aria-label={`${definition.title}来源原图`}><image href={ROOT + 'design/' + definition.source} width="1536" height="1024" /></svg>}
        {error && <div className="gentle-loading" role="alert"><p>{error}</p><button onClick={() => window.location.reload()}>重新加载</button></div>}
        {!ready && !error && <p className="gentle-loading" role="status">正在加载原画…</p>}
      </div>
      <div className="original-view-options gentle-compare" role="group" aria-label="原画对照"><button aria-pressed={!reference} onClick={() => { seek(0); setReference(false) }}>动画角色</button><button aria-pressed={reference} onClick={() => { seek(0); setReference(true) }}>同位置原图</button></div>
      <p className="original-caption">{id === 'hat' ? '爪与帽檐保持接触，脚底贴地。' : id === 'stretch' ? '保留原稿伸展姿势，双脚稳定支撑。' : '轻轻收一下下巴，点一次头，慢慢抬回。'}</p>
    </section>
    <aside className="original-controls gentle-controls" aria-label="动作播放控制"><h2>{definition.title}</h2><p>{definition.description}</p>
      <div className="gentle-playback"><button className="gentle-play" disabled={!ready || !!error} onClick={() => playing ? setPlaying(false) : play()}>{playing ? '暂停' : time >= definition.duration ? '重新播放' : time > 0 ? '继续播放' : `播放 ${definition.duration / 1000} 秒样片`}</button><button onClick={() => seek(0)}>回到原位</button></div>
      <label className="gentle-timeline">逐帧查看 <output>{(time / 1000).toFixed(2)} / {(definition.duration / 1000).toFixed(2)} 秒</output><input aria-label="样片进度" type="range" min="0" max={definition.duration} step="1" value={time} disabled={!ready || reference || !!error} onChange={event => seek(Number(event.target.value))} /></label>
      <div className="gentle-frame-buttons"><button disabled={!ready || reference || time <= 0 || !!error} onClick={() => seek(clock.current - 1000 / 30)}>上一帧</button><button disabled={!ready || reference || time >= definition.duration || !!error} onClick={() => seek(clock.current + 1000 / 30)}>下一帧</button><span>每步 1/30 秒</span></div>
      <section className="idle-checkpoints"><h3>看一看节奏</h3><div>{definition.checkpoints.map(([label, milliseconds]) => <button key={label} disabled={!ready || reference || !!error} onClick={() => seek(milliseconds)}>{label}</button>)}</div></section>
      <section className="gentle-background-controls"><h3>检查轮廓与接触</h3><div role="group" aria-label="检查背景">{[['paper', '浅色'], ['dark', '深色'], ['checker', '透明棋盘']].map(([value, label]) => <button key={value} aria-pressed={backdrop === value} onClick={() => setBackdrop(value)}>{label}</button>)}</div></section>
      <section className="gentle-note"><h3>每一段，单独看看</h3><p>点击播放一次，结束后停住。播放中切换动作，会等当前动作收稳；暂停时可直接选择其他样片。</p><p>可用“同位置原图”查看这段动作所用的原稿。</p></section>
    </aside>
  </div>
}
