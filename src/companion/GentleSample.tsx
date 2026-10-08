import { useEffect, useRef, useState } from 'react'
import './gentle.css'

const DURATION = 4800
const CHARACTER = '/companion-assets/d-panda/gentle/stand-original.svg'
const SHADOW = '/companion-assets/d-panda/gentle/ground-original.svg'
const SOURCE = '/companion-assets/d-panda/design/D2-character-accessories.png'
const FRAMES: Keyframe[] = [
  { transform: 'rotate(0deg)', offset: 0, easing: 'linear' },
  { transform: 'rotate(0deg)', offset: 0.08, easing: 'ease-in-out' },
  { transform: 'rotate(-1.2deg)', offset: 0.28, easing: 'linear' },
  { transform: 'rotate(-1.2deg)', offset: 0.36, easing: 'ease-in-out' },
  { transform: 'rotate(1deg)', offset: 0.60, easing: 'linear' },
  { transform: 'rotate(1deg)', offset: 0.68, easing: 'ease-in-out' },
  { transform: 'rotate(0deg)', offset: 0.91, easing: 'linear' },
  { transform: 'rotate(0deg)', offset: 1 },
]

export default function GentleSample() {
  const sprite = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [reference, setReference] = useState(false)
  const [backdrop, setBackdrop] = useState('paper')

  useEffect(() => {
    const target = sprite.current!
    const motion = target.animate(FRAMES, { duration: DURATION, fill: 'both' })
    motion.pause(); motion.currentTime = 0; animation.current = motion
    motion.onfinish = () => { setPlaying(false); setTime(DURATION) }
    const hide = () => {
      if (document.hidden) { motion.pause(); setPlaying(false); setTime(Number(motion.currentTime) || 0) }
    }
    document.addEventListener('visibilitychange', hide)
    let disposed = false
    void Promise.all([CHARACTER, SHADOW, SOURCE].map(async url => {
      const image = new Image(); image.src = url; await image.decode()
    })).then(() => { if (!disposed) setReady(true) }).catch(() => { if (!disposed) setError(true) })
    return () => { disposed = true; motion.cancel(); animation.current = null; document.removeEventListener('visibilitychange', hide) }
  }, [])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => { setTime(Number(animation.current?.currentTime) || 0); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  function seek(next: number) {
    const position = Math.max(0, Math.min(DURATION, next))
    animation.current?.pause()
    if (animation.current) animation.current.currentTime = position
    setPlaying(false); setTime(position)
  }

  function play() {
    if (!ready || error) return
    setReference(false)
    if (time >= DURATION && animation.current) animation.current.currentTime = 0
    animation.current?.play(); setPlaying(true)
  }

  return <main className="original-lab gentle-lab" data-version="D-gentle-original" data-playing={playing}>
    <header className="original-header"><a href="/">GYM <span>/ D 熊猫</span></a><a href="/?companion-lab=1&review=originals">返回原图核对 ↗</a></header>
    <section className="original-intro"><p className="original-eyebrow">D PANDA / 第一段轻摆样片</p><h1>轻轻摆动，再回到原位。</h1><p>同一张空手站姿原画 · 4.8 秒 · 点击播放</p></section>
    <div className="original-layout">
      <section className="original-stage" aria-label="轻摆样片画面">
        <div className="original-stage-heading"><h2>{reference ? '原图对照 · 静止' : '空手站姿 · 轻摆'}</h2><span>{playing ? '正在播放' : time === DURATION ? '已回正' : '静止检查'}</span></div>
        <div className={`gentle-plane gentle-backdrop-${backdrop}`} data-testid="gentle-plane">
          <img className="gentle-layer gentle-ground" src={SHADOW} alt="" hidden={reference || error} />
          <div className="gentle-layer gentle-sprite" ref={sprite} hidden={reference || error} data-testid="gentle-sprite">
            <img src={CHARACTER} alt="从已确认原稿中提取的空手熊猫" draggable={false} />
          </div>
          {reference && <svg className="gentle-layer gentle-reference" viewBox="50 140 390 475" role="img" aria-label="同位置、同尺寸的站姿原图"><image href={SOURCE} width="1536" height="1024" /></svg>}
          {error && <p className="gentle-loading" role="alert">原画素材暂时无法加载，请刷新重试。</p>}
          {!ready && !error && <p className="gentle-loading" role="status">正在加载原画…</p>}
        </div>
        <div className="original-view-options gentle-compare" role="group" aria-label="原画对照">
          <button aria-pressed={!reference} onClick={() => { seek(0); setReference(false) }}>透明角色</button>
          <button aria-pressed={reference} onClick={() => { seek(0); setReference(true) }}>同位置原图</button>
        </div>
        <p className="original-caption">切换对照时自动回正，脸型、五官和身体比例可直接核对。</p>
      </section>
      <aside className="original-controls gentle-controls" aria-label="样片控制">
        <h2>先看这一小段</h2><p>静止 → 向一侧轻倾 → 停一下 → 向另一侧轻倾 → 回正。</p>
        <div className="gentle-playback">
          <button className="gentle-play" disabled={!ready || error} onClick={() => playing ? seek(Number(animation.current?.currentTime) || 0) : play()}>{playing ? '暂停' : time >= DURATION ? '重新播放' : time > 0 ? '继续播放' : '播放 4.8 秒样片'}</button>
          <button onClick={() => seek(0)}>回到原位</button>
        </div>
        <label className="gentle-timeline">逐帧查看 <output>{(time / 1000).toFixed(2)} / 4.80 秒</output><input aria-label="样片进度" type="range" min="0" max={DURATION} step="1" value={time} disabled={!ready || reference} onChange={event => seek(Number(event.target.value))} /></label>
        <div className="gentle-frame-buttons"><button disabled={!ready || reference || time <= 0} onClick={() => seek(time - 1000 / 30)}>上一帧</button><button disabled={!ready || reference || time >= DURATION} onClick={() => seek(time + 1000 / 30)}>下一帧</button><span>每步 1/30 秒</span></div>
        <section className="gentle-background-controls"><h3>检查透明边缘</h3><div role="group" aria-label="检查背景">{[['paper','浅色'],['dark','深色'],['checker','透明棋盘']].map(([id, label]) => <button key={id} aria-pressed={backdrop === id} onClick={() => setBackdrop(id)}>{label}</button>)}</div><p>毛尖、耳朵、爪子和腕结都可在不同背景下检查。</p></section>
        <section className="gentle-note"><h3>这段样片的范围</h3><p>熊猫原画整体轻倾，最大 1.2°，大小保持固定。表情、四肢姿势和身体轮廓保持原稿。</p><p>只播放一次；可随时暂停，离开页面会停止。当前还没有加入眨眼、抬手或其他动作。</p></section>
      </aside>
    </div>
    <details className="original-source gentle-source"><summary>查看原画与透明处理说明</summary><p>来自 D2-character-accessories.png 的空手站姿。角色素材内嵌未经修改的原 PNG，仅添加背景透明遮罩；没有生成或重画熊猫，原图核对页面保持可用。</p><p>原图的地面阴影单独保留，角色围绕脚底整体旋转。边缘透明度与旋转时的浏览器采样会影响边缘显示，不能把动态截图宣称为与静态原稿逐像素相同。</p><p><a href={CHARACTER} target="_blank" rel="noreferrer">查看透明角色素材 ↗</a> · <a href={SOURCE} target="_blank" rel="noreferrer">查看原始设计板 ↗</a></p></details>
  </main>
}
