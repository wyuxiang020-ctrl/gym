import { useEffect, useRef, useState } from 'react'
import { ALL_CLIPS, EXPRESSION_CLIPS, MOTION_CLIPS, companionClip, type Clip } from './companionCatalog'
import { libraryPhase, librarySample } from './libraryMotion'
import { OriginalIdleRenderer } from './OriginalIdleRenderer'
import PixelControl from './PixelControl'
import { ReleaseStatus } from '../components/ReleaseStatus'
import './gentle.css'
import './idle.css'
import './library.css'

const ROOT = '/companion-assets/d-panda/'
type Playback = 'once' | 'loop' | 'sequence'

function Thumbnail({ clip }: { clip: Clip }) {
  const [x, y, width, height] = clip.crop
  const cropPath = clip.id === 'rest' ? `M${x + 75} ${y}H${x + width}V${y + height}H${x}V${y + 195}H${x + 75}Z` : clip.id === 'celebrate' ? `M${x} ${y}H${x + width}V${y + 244}H${x + 260}V${y + height}H${x}Z` : `M${x} ${y}h${width}v${height}h-${width}Z`
  return <svg viewBox={clip.crop.join(' ')} aria-hidden="true"><defs><clipPath id={`thumb-${clip.id}`}><path d={cropPath} /></clipPath></defs><image href={ROOT + 'design/' + clip.source} width="1536" height="1024" clipPath={`url(#thumb-${clip.id})`} /></svg>
}

export default function OriginalCompanion() {
  const [selection, setSelected] = useState(() => companionClip(new URLSearchParams(location.search).get('clip') ?? 'idle'))
  const selected = companionClip(selection.id)
  const [category, setCategory] = useState(selected.category)
  const [requested, setRequested] = useState<Clip | null>(null)
  const [mode, setMode] = useState<Playback>('once')
  const [pixel, setPixel] = useState(0)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [autoStart, setAutoStart] = useState(false), [retry, setRetry] = useState(0)
  const playing = useRef(false), pending = useRef<Clip | null>(null)
  const list = category === 'actions' ? MOTION_CLIPS : EXPRESSION_CLIPS
  const modeRef = useRef(mode), selectedRef = useRef(selected)
  const lastSelected = useRef(selected.id)
  modeRef.current = mode; selectedRef.current = selected
  useEffect(() => {
    if (lastSelected.current !== selected.id && matchMedia('(max-width: 760px)').matches) document.querySelector('.library-stage')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    lastSelected.current = selected.id
  }, [selected, reduced])

  function activate(clip: Clip, start = false) {
    playing.current = false; pending.current = null; setRequested(null)
    setAutoStart(start); setSelected(clip); setCategory(clip.category)
    const url = new URL(location.href); url.searchParams.set('clip', clip.id); history.replaceState(null, '', url)
  }
  function select(clip: Clip) {
    if (clip.id === selected.id) { pending.current = null; setRequested(null); return }
    if (playing.current) { pending.current = clip; setRequested(clip) }
    else activate(clip)
  }
  function finish(): boolean {
    playing.current = false
    if (pending.current) { activate(pending.current, modeRef.current === 'sequence'); return false }
    if (modeRef.current === 'loop') return true
    if (modeRef.current === 'sequence') {
      const current = selectedRef.current
      const sequence = current.category === 'actions' ? MOTION_CLIPS : EXPRESSION_CLIPS
      const index = sequence.findIndex(clip => clip.id === current.id)
      if (index < sequence.length - 1) activate(sequence[index + 1], true)
      else { setMode('once'); setAutoStart(false) }
    }
    return false
  }

  return <main className="original-lab gentle-lab idle-lab companion-library" data-version="D-original-library" data-clip={selected.id} data-count={ALL_CLIPS.length}>
    <header className="original-header"><a href="/">GYM <span>/ D 熊猫</span></a><nav><a href="/?equipment-scan=1">器械扫描 ↗</a><a href="/?companion-lab=1&review=originals">七张原稿</a><a href="/">返回训练记录 ↗</a></nav></header>
    <ReleaseStatus />
    <section className="original-intro library-intro"><div><p className="original-eyebrow">D PANDA / 原画陪伴</p><h1>动起来，还是熟悉的它。</h1><p>招呼、舒展、歇一会。一起看看 D 的小表演。</p></div><div className="library-count"><strong>11 <span>段动作</span></strong><strong>12 <span>种原画表情</span></strong></div></section>
    <div className="library-layout">
      <div className="library-performance">
        <LibraryPlayer key={`${selected.id}-${selected.duration}-${retry}`} clip={selected} reduced={reduced} autoStart={autoStart} onPlaying={value => { playing.current = value }} onFinish={finish} onRetry={() => { setAutoStart(false); setRetry(value => value + 1) }} mode={mode} setMode={setMode} setReduced={setReduced} pixel={pixel} setPixel={setPixel} />
        {requested && <div className="library-pending" role="status">收稳后切换到「{requested.title}」<button onClick={() => { pending.current = null; setRequested(null) }}>取消</button></div>}
      </div>
      <aside className="library-browser" aria-label="角色内容">
        <div className="library-tabs" role="group" aria-label="内容分类"><button aria-pressed={category === 'actions'} onClick={() => setCategory('actions')}>动作 <span>11</span></button><button aria-pressed={category === 'expressions'} onClick={() => setCategory('expressions')}>表情 <span>12</span></button></div>
        <p className="library-browse-help">{category === 'actions' ? '选择一段，看看它的动作。' : '每张保留原稿的脸和表情，配合轻微动态。'}</p>
        <div className="library-grid" role="group" aria-label={category === 'actions' ? '选择动作' : '选择表情'}>{list.map((clip, index) => <button key={clip.id} data-clip-choice={clip.id} aria-pressed={selected.id === clip.id} onClick={() => select(clip)}><Thumbnail clip={clip} /><span><strong>{clip.title}</strong><small>{requested?.id === clip.id ? '等待收稳' : `${String(index + 1).padStart(2, '0')} / ${clip.duration / 1000} 秒`}</small></span></button>)}</div>
      </aside>
    </div>
    <details className="original-source library-sources"><summary>制作范围与原稿来源</summary><p>当前为原稿局部动画展示：11 段动作和 12 张动态表情肖像。动作之间通过独立片段切换，不表示角色连续完成戴帽、摘帽、转身、坐下或起身。持竹段保留迈步原姿势；小跳沿用“跃起欢呼”原稿，未把不同关键姿势混成新形象。表情保留完整原稿肖像，未拼贴到全身角色上。</p><p>七张交付 PNG 完整保留。透明素材只选择原画像素；运动通过同一原图的局部网格实现，未重新绘制角色。清晰与像素共用同一动画；人体动作检测已暂缓，当前转向<a href="/?equipment-scan=1">静态器械扫描</a>。</p><p>动画方法参考 <a href="https://esotericsoftware.com/spine-meshes" target="_blank" rel="noreferrer">Spine 原图网格</a>、<a href="https://esotericsoftware.com/blog/Timing-and-Spacing-Animating-with-Spine-3" target="_blank" rel="noreferrer">Spine 时间与间距</a> 与 <a href="https://www.adobe.com/creativecloud/animation/discover/principles-of-animation.html" target="_blank" rel="noreferrer">Adobe 动画原则</a>。<a href="/?companion-lab=1&review=actions">查看原时长的三个历史样片 ↗</a></p></details>
  </main>
}

type PlayerProps = { clip: Clip; reduced: boolean; autoStart: boolean; onPlaying: (value: boolean) => void; onFinish: () => boolean; onRetry: () => void; mode: Playback; setMode: (value: Playback) => void; setReduced: (value: boolean) => void; pixel: number; setPixel: (value:number)=>void }

function LibraryPlayer({ clip, reduced, autoStart, onPlaying, onFinish, onRetry, mode, setMode, setReduced, pixel, setPixel }: PlayerProps) {
  const canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<OriginalIdleRenderer | null>(null), clock = useRef(0)
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('')
  const [reference, setReference] = useState(false), [backdrop, setBackdrop] = useState('paper')
  const callbacks = useRef({ onPlaying, onFinish }), reducedRef = useRef(reduced)
  const startOnMount = useRef(autoStart)
  callbacks.current = { onPlaying, onFinish }; reducedRef.current = reduced
  const [x, y, width, height] = clip.crop, [offsetX, offsetY] = clip.offset
  const layerStyle = { left: `${offsetX / 480 * 100}%`, top: `${offsetY / 560 * 100}%`, width: `${width * clip.scale / 480 * 100}%`, height: `${height * clip.scale / 560 * 100}%` }
  const sample = librarySample(clip, time, reduced)
  const shadowScale = 1 - sample.lift / 300
  function setPlayback(value: boolean) { callbacks.current.onPlaying(value); setPlaying(value) }
  function seek(value: number) { setPlayback(false); const next = Math.max(0, Math.min(clip.duration, value)); clock.current = next; setTime(next) }

  useEffect(() => {
    let disposed = false, engine: OriginalIdleRenderer | null = null
    const target = canvas.current!
    const fail = (message: string) => { if (!disposed) { setError(message); setReady(false); setPlaying(false); callbacks.current.onPlaying(false) } }
    try {
      engine = new OriginalIdleRenderer(target, { width, height, stage: [480, 560], placement: [clip.scale, offsetX, offsetY], texture: ROOT + clip.texture, eyes: clip.motion === 'idle' ? ROOT + 'idle/closed-eyes-original.svg' : undefined, sample: milliseconds => librarySample(clip, milliseconds, reducedRef.current) })
      renderer.current = engine
      const loads: Promise<unknown>[] = [engine.initialize()]
      if (clip.shadow) { const shadow = new Image(); shadow.src = ROOT + clip.shadow; loads.push(shadow.decode()) }
      void Promise.all(loads).then(() => {
        if (!disposed) { engine!.draw(0); setReady(true); if (startOnMount.current && !document.hidden) { setPlaying(true); callbacks.current.onPlaying(true) } }
      }).catch(() => fail('原画暂时没能加载，请重试。也可以先查看来源原图。'))
    } catch { fail('动画画面无法初始化，请重试，或查看来源原图。') }
    const resize = new ResizeObserver(() => { if (!disposed) engine?.draw(clock.current) }); resize.observe(target)
    const lost = (event: Event) => { event.preventDefault(); fail('动画画面中断了，请重新加载。') }
    const hide = () => { if (document.hidden) { startOnMount.current = false; setPlaying(false); callbacks.current.onPlaying(false) } }
    target.addEventListener('webglcontextlost', lost); document.addEventListener('visibilitychange', hide)
    return () => { disposed = true; resize.disconnect(); engine?.dispose(); renderer.current = null; target.removeEventListener('webglcontextlost', lost); document.removeEventListener('visibilitychange', hide); callbacks.current.onPlaying(false) }
  }, [clip, width, height, offsetX, offsetY])

  useEffect(() => { if (ready && !error) { renderer.current?.setPixelHeight(pixel); renderer.current?.draw(time) } }, [time, ready, error, reduced, pixel])
  useEffect(() => {
    if (!playing || !ready || error) return
    let frame = 0, started = performance.now() - clock.current
    const tick = (now: number) => {
      const next = Math.min(clip.duration, now - started)
      clock.current = next; setTime(next)
      if (next < clip.duration) frame = requestAnimationFrame(tick)
      else if (callbacks.current.onFinish()) { started = now; clock.current = 0; setTime(0); callbacks.current.onPlaying(true); frame = requestAnimationFrame(tick) }
      else setPlaying(false)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, ready, error, clip.duration])

  function play() { if (!ready || error) return; setReference(false); if (clock.current >= clip.duration) { clock.current = 0; setTime(0) }; setPlayback(true) }
  return <section className="original-stage library-stage" data-playing={playing} data-duration={clip.duration} data-reduced={reduced} aria-label={`${clip.title}播放区`}>
    <div className="original-stage-heading"><h2>{clip.title}</h2><span>{reference ? '来源原图' : playing ? libraryPhase(clip, time) : time >= clip.duration ? '播放完成' : '待你播放'}</span></div>
    <div className={`gentle-plane library-plane gentle-backdrop-${backdrop}`}>
      {clip.shadow && <img className="gentle-layer gentle-ground" style={{ ...layerStyle, transform: `scaleX(${shadowScale})`, opacity: 1 - sample.lift / 160 }} src={ROOT + clip.shadow} alt="" hidden={reference || !!error} />}
      <canvas ref={canvas} className="idle-canvas" aria-label={`${clip.title}原画动画`} style={{ visibility: reference || error ? 'hidden' : 'visible' }} aria-hidden={reference || !!error} />
      {reference && <svg className="gentle-layer gentle-reference" style={layerStyle} viewBox={clip.crop.join(' ')} role="img" aria-label={`${clip.title}来源原图`}><image href={ROOT + 'design/' + clip.source} width="1536" height="1024" /></svg>}
      {error && !reference && <div className="gentle-loading" role="alert"><p>{error}</p><button onClick={onRetry}>重新加载</button></div>}
      {!ready && !error && !reference && <p className="gentle-loading" role="status">正在加载原画…</p>}
    </div>
    <p className="library-description">{clip.description}</p>
    <div className="library-playback"><button className="gentle-play" disabled={!ready || !!error} onClick={() => playing ? setPlayback(false) : play()}>{playing ? '暂停' : time >= clip.duration ? '重新播放' : time > 0 ? '继续播放' : '播放动作'}</button><button onClick={() => seek(0)}>回到原位</button><button aria-pressed={reference} onClick={() => { seek(0); setReference(!reference) }}>{reference ? '返回动画' : '原图对照'}</button></div>
    <label className="gentle-timeline">播放进度 <output>{(time / 1000).toFixed(2)} / {(clip.duration / 1000).toFixed(2)} 秒</output><input aria-label="播放进度" type="range" min="0" max={clip.duration} step="1" value={time} disabled={!ready || reference || !!error} onChange={event => seek(Number(event.target.value))} /></label>
    <div className="library-options"><PixelControl value={pixel} onChange={setPixel} /><label>播放方式 <select aria-label="播放方式" value={mode} onChange={event => setMode(event.target.value as Playback)}><option value="once">播放一次</option><option value="loop">重复这一段</option><option value="sequence">依次看完本组</option></select></label><label><input type="checkbox" checked={reduced} onChange={event => { seek(0); setReduced(event.target.checked) }} />减少动态</label></div>
    <p className="library-boundary">{clip.boundary}</p>
    <details className="library-inspector"><summary>仔细看看 · 逐帧与背景</summary><div className="gentle-frame-buttons"><button disabled={!ready || reference || time <= 0 || !!error} onClick={() => seek(clock.current - 1000 / 30)}>上一帧</button><button disabled={!ready || reference || time >= clip.duration || !!error} onClick={() => seek(clock.current + 1000 / 30)}>下一帧</button><span>每步 1/30 秒</span></div><div className="library-checkpoints">{clip.checkpoints.map(([label, at]) => <button key={label} disabled={!ready || reference || !!error} onClick={() => seek(at)}>{label}</button>)}</div><div className="library-background" role="group" aria-label="检查背景">{[['paper', '浅色'], ['dark', '深色'], ['checker', '透明棋盘']].map(([value, label]) => <button key={value} aria-pressed={backdrop === value} onClick={() => setBackdrop(value)}>{label}</button>)}</div><p>来源：{clip.source} · 区域 {x}, {y}, {width}, {height}</p><a href={ROOT + 'design/' + clip.source} target="_blank" rel="noreferrer">打开完整原图 ↗</a></details>
  </section>
}
