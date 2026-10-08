import { useEffect, useRef, useState } from 'react'
import { OriginalIdleRenderer } from './OriginalIdleRenderer'
import { IDLE_DURATION } from './idleMotion'
import './gentle.css'
import './idle.css'

const SOURCE = '/companion-assets/d-panda/design/D2-character-accessories.png'
const SHADOW = '/companion-assets/d-panda/gentle/ground-original.svg'

export default function IdleSample() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<OriginalIdleRenderer | null>(null)
  const clock = useRef(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState(false)
  const [backdrop, setBackdrop] = useState('paper')

  useEffect(() => {
    let disposed = false
    let engine: OriginalIdleRenderer | null = null
    const fail = (message: string) => { if (!disposed) { setError(message); setReady(false); setPlaying(false) } }
    const target = canvas.current!
    try {
      engine = new OriginalIdleRenderer(target)
      renderer.current = engine
      const ground = new Image(); ground.src = SHADOW
      void Promise.all([engine.initialize(), ground.decode()]).then(() => {
        if (!disposed) { engine!.draw(clock.current); setReady(true) }
      }).catch(() => fail('原画素材暂时无法加载，请刷新重试。'))
    } catch (reason) { fail(reason instanceof Error ? reason.message : '原画动画无法初始化，请刷新重试。') }
    const resize = new ResizeObserver(() => { if (!disposed) engine?.draw(clock.current) })
    resize.observe(target)
    const lost = (event: Event) => { event.preventDefault(); fail('动画画面暂时中断。请刷新重试，原图核对仍然可用。') }
    const hide = () => { if (document.hidden) setPlaying(false) }
    target.addEventListener('webglcontextlost', lost)
    document.addEventListener('visibilitychange', hide)
    return () => {
      disposed = true; resize.disconnect(); engine?.dispose(); renderer.current = null
      target.removeEventListener('webglcontextlost', lost); document.removeEventListener('visibilitychange', hide)
    }
  }, [])

  useEffect(() => { if (ready && !error) renderer.current?.draw(time) }, [time, ready, error])

  useEffect(() => {
    if (!playing || !ready || error) return
    let frame = 0
    const started = performance.now() - clock.current
    const tick = (now: number) => {
      const next = Math.min(IDLE_DURATION, now - started)
      clock.current = next; setTime(next)
      if (next < IDLE_DURATION) frame = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, ready, error])

  function seek(next: number) {
    const clamped = Math.max(0, Math.min(IDLE_DURATION, next))
    setPlaying(false); clock.current = clamped; setTime(clamped)
  }

  function play() {
    if (!ready || error) return
    setReference(false)
    if (clock.current >= IDLE_DURATION) { clock.current = 0; setTime(0) }
    setPlaying(true)
  }

  const phase = time < 200 ? '原画站姿' : time < 2120 ? '胸腹轻起 · 头爪跟随' : time < 2600 ? '轻轻眨眼' : time < 5480 ? '慢慢呼气 · 放松' : '回到原画站姿'
  return <main className="original-lab gentle-lab idle-lab" data-version="D-idle-original" data-playing={playing}>
    <header className="original-header"><a href="/">GYM <span>/ D 熊猫</span></a><a href="/?companion-lab=1&review=originals">返回原图核对 ↗</a></header>
    <section className="original-intro"><p className="original-eyebrow">D PANDA / 呼吸与眨眼</p><h1>呼吸一下，轻轻眨眼。</h1><p>原画局部动画 · 6 秒 · 点击播放</p><a className="original-gentle-link" href="/?companion-lab=1&review=actions">查看三个新动作 ↗</a></section>
    <div className="original-layout">
      <section className="original-stage" aria-label="原画待机样片">
        <div className="original-stage-heading"><h2>{reference ? '同位置原图 · 静止对照' : phase}</h2><span>{playing ? '正在播放' : time === IDLE_DURATION ? '已完成' : '暂停检查'}</span></div>
        <div className={`gentle-plane idle-plane gentle-backdrop-${backdrop}`}>
          <img className="gentle-layer gentle-ground" src={SHADOW} alt="" hidden={reference || !!error} />
          <canvas ref={canvas} className="idle-canvas" aria-label="熊猫呼吸、眨眼和头爪跟随动画" aria-hidden={reference || !!error} style={{ visibility: reference || error ? 'hidden' : 'visible' }} />
          {reference && <svg className="gentle-layer gentle-reference" viewBox="50 140 390 475" role="img" aria-label="同位置空手站姿原图"><image href={SOURCE} width="1536" height="1024" /></svg>}
          {error && <div className="gentle-loading" role="alert"><p>{error}</p><button onClick={() => window.location.reload()}>重新加载</button></div>}
          {!ready && !error && <p className="gentle-loading" role="status">正在加载原画…</p>}
        </div>
        <div className="original-view-options gentle-compare" role="group" aria-label="原画对照">
          <button aria-pressed={!reference} onClick={() => { seek(0); setReference(false) }}>动画角色</button>
          <button aria-pressed={reference} onClick={() => { seek(0); setReference(true) }}>同位置原图</button>
        </div>
        <p className="original-caption">切换对照时回到原画站姿。脚底保持贴地，脸部随头一起移动。</p>
      </section>
      <aside className="original-controls gentle-controls" aria-label="待机样片控制">
        <h2>这一段里，它会……</h2><p>轻轻吸气，头和前爪稍晚跟上；眨一次眼，再慢慢放松。</p>
        <div className="gentle-playback"><button className="gentle-play" disabled={!ready || !!error} onClick={() => playing ? setPlaying(false) : play()}>{playing ? '暂停' : time >= IDLE_DURATION ? '重新播放' : time > 0 ? '继续播放' : '播放 6 秒样片'}</button><button onClick={() => seek(0)}>回到原位</button></div>
        <label className="gentle-timeline">逐帧查看 <output>{(time / 1000).toFixed(2)} / 6.00 秒</output><input aria-label="样片进度" type="range" min="0" max={IDLE_DURATION} step="1" value={time} disabled={!ready || reference || !!error} onChange={event => seek(Number(event.target.value))} /></label>
        <div className="gentle-frame-buttons"><button disabled={!ready || reference || time <= 0 || !!error} onClick={() => seek(clock.current - 1000 / 30)}>上一帧</button><button disabled={!ready || reference || time >= IDLE_DURATION || !!error} onClick={() => seek(clock.current + 1000 / 30)}>下一帧</button><span>每步 1/30 秒</span></div>
        <section className="idle-checkpoints"><h3>停在这里看</h3><div><button disabled={!ready || reference || !!error} onClick={() => seek(1800)}>吸气顶点</button><button disabled={!ready || reference || !!error} onClick={() => seek(2370)}>闭眼瞬间</button><button disabled={!ready || reference || !!error} onClick={() => seek(3600)}>呼气跟随</button></div></section>
        <section className="gentle-background-controls"><h3>检查边缘与接触</h3><div role="group" aria-label="检查背景">{[['paper','浅色'],['dark','深色'],['checker','透明棋盘']].map(([id, label]) => <button key={id} aria-pressed={backdrop === id} onClick={() => setBackdrop(id)}>{label}</button>)}</div><p>可检查轮廓、腕结和脚底，或回到原图对照。</p></section>
        <section className="gentle-note"><h3>仍然是这只熊猫</h3><p>头部五官一起移动；身体和前爪只做小幅变化，动作结束后恢复原画。眨眼沿用 D2 表情板中的闭眼设计。</p><p>播放一次，默认静止。当前仅做这一段待机。</p></section>
      </aside>
    </div>
    <details className="original-source gentle-source"><summary>查看素材来源与处理范围</summary><p>站姿取自 D2-character-accessories.png；闭眼取自 D2-expressions.png 右下角“放松”表情。原始文件完整保留，闭眼区域对齐到原站姿眼部，眼斑外缘保留原画。</p><p>身体使用连续的原图网格，分区控制头、胸腹、前爪和腕结的节奏，脚底固定；没有新增眼睑绘画或补画遮挡区。动态局部变形与纹理采样不能称为每一帧逐像素不变。</p><p><a href="/companion-assets/d-panda/design/D2-expressions.png" target="_blank" rel="noreferrer">查看闭眼来源原图 ↗</a> · <a href="/?companion-lab=1&review=gentle-v1">查看上一版整体轻摆 ↗</a></p></details>
  </main>
}
