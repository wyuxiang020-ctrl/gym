import { useEffect, useId, useRef, useState } from 'react'
import { SPORT_MOTIONS, sportPose, type SportMotion } from './sportMotion'
import './sportPanda.css'

const ORIGINAL = '/companion-assets/d-panda/gentle/stand-original.svg'
let texturePromise: Promise<string> | undefined
function originalTexture() {
  // Rasterize the source SVG once at its native size. Its per-pixel alpha mask
  // otherwise develops hairline gaps when the browser rotates nested SVG images.
  return texturePromise ??= (async () => {
    const source = new Image(); source.src = ORIGINAL; await source.decode()
    const canvas = document.createElement('canvas'); canvas.width = 390; canvas.height = 475
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法准备运动原稿')
    context.drawImage(source, 0, 0, 390, 475)
    return canvas.toDataURL('image/png')
  })().catch(error => { texturePromise = undefined; throw error })
}
// Display windows into the approved original. The face and body are never regenerated.
const CUTS = {
  head: 'M0 0H390V174H326Q325 195 291 210Q204 241 127 214Q72 194 68 174H0Z',
  body: 'M112 212Q200 244 286 211L299 270Q320 308 320 348L317 388Q282 432 201 430Q110 427 80 361L82 301Z',
  leftUpper: 'M99 203L123 221L98 276L77 319L17 322L30 279Z',
  leftPaw: 'M17 302Q41 292 77 307L74 330Q74 348 61 349Q34 362 18 341Q10 329 17 302Z',
  rightUpper: 'M281 208Q338 238 355 281L353 301L320 307L284 293Q295 272 282 249Z',
  rightPaw: 'M281 293Q315 280 334 307L345 321Q366 325 357 349L343 344L336 361L327 344Q311 361 286 354Q251 355 246 337Q244 316 267 305Z',
  leftLeg: 'M85 388Q115 410 173 416L165 458H80Z',
  rightLeg: 'M226 416Q290 407 320 386L336 460H238Z',
}

export function SportPanda({ mode, running, reduced }: { mode: SportMotion; running: boolean; reduced: boolean }) {
  const id = useId().replaceAll(':', '')
  const root = useRef<SVGSVGElement>(null)
  const elapsed = useRef(0)
  const [failed, setFailed] = useState(false)
  const [texture, setTexture] = useState<string>()
  useEffect(() => {
    let disposed = false
    void originalTexture().then(value => { if (!disposed) setTexture(value) }).catch(() => { if (!disposed) setFailed(true) })
    return () => { disposed = true }
  }, [])
  useEffect(() => {
    const svg = root.current
    if(!svg || failed) return
    let frame = 0, last = 0, visible = true, editing = document.activeElement?.matches('input,textarea,select') ?? false
    const nodes = Object.fromEntries(['body','head','leftArm','rightArm','leftElbow','rightElbow','leftLeg','rightLeg'].map(name => [name, svg.querySelector(`[data-joint=${name}]`)!]))
    const draw = () => {
      const p = sportPose(mode, elapsed.current)
      nodes.body.setAttribute('transform', `translate(${p.bodyX} ${p.bodyY}) rotate(${p.lean} 195 410)`)
      nodes.head.setAttribute('transform', `rotate(${p.head} 195 220)`)
      nodes.leftArm.setAttribute('transform',`translate(105 230) rotate(${p.leftArm}) scale(${1+Math.abs(p.leftReach)/130} 1) translate(-105 -230)`)
      nodes.rightArm.setAttribute('transform',`translate(290 235) rotate(${p.rightArm}) scale(${1+Math.abs(p.rightReach)/130} 1) translate(-290 -235)`)
      nodes.leftElbow.setAttribute('transform',`rotate(${p.leftElbow} 58 307)`)
      nodes.rightElbow.setAttribute('transform',`rotate(${p.rightElbow} 324 295)`)
      nodes.leftLeg.setAttribute('transform',`translate(0 ${p.leftLift}) rotate(${p.leftLeg} 127 396)`)
      nodes.rightLeg.setAttribute('transform',`translate(0 ${p.rightLift}) rotate(${p.rightLeg} 270 395)`)
      // Keep the dumbbell shaft level while the paw follows the curling forearm.
      svg.querySelector('[data-weight=left]')?.setAttribute('transform',`translate(45 336) rotate(${-p.leftElbow-p.leftArm-p.lean})`)
      svg.querySelector('[data-weight=right]')?.setAttribute('transform',`translate(288 334) rotate(${-p.rightElbow-p.rightArm-p.lean})`)
      svg.dataset.frameTime = elapsed.current.toFixed(1)
    }
    const tick = (now: number) => {
      if(last) elapsed.current += Math.min(now-last,64)
      last=now;draw();frame=requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame);last=0
      const active=running&&!reduced&&!document.hidden&&visible&&!editing
      svg.dataset.playing=String(active)
      if(active)frame=requestAnimationFrame(tick)
    }
    const focus = () => { editing = document.activeElement?.matches('input,textarea,select') ?? false;sync() }
    const observer = new IntersectionObserver(entries => { visible=entries[0].isIntersecting;sync() })
    observer.observe(svg);document.addEventListener('visibilitychange',sync);document.addEventListener('focusin',focus);document.addEventListener('focusout',focus)
    draw();sync()
    return () => { cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',sync);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',focus) }
  },[mode,running,reduced,failed,texture])
  const part = (cut: keyof typeof CUTS) => <use href={`#${id}-original`} clipPath={`url(#${id}-${cut})`} />
  const weight = (side: 'left'|'right') => <g data-weight={side} stroke="#171b1c" strokeWidth="3"><rect x="-48" y="-5" width="96" height="10" rx="4" fill="#bac3b2"/><rect x="-58" y="-25" width="23" height="50" rx="6" fill="#555f57"/><rect x="35" y="-25" width="23" height="50" rx="6" fill="#555f57"/><path d="M-47-15V15M46-15V15" stroke="#dfff32" strokeWidth="4"/></g>
  const glove = (x:number,y:number) => <g transform={`translate(${x} ${y})`} stroke="#343c26" strokeWidth="3"><path d="M-23 3Q-35-29-10-34Q21-39 27-17L31 3Q31 21 12 24L-13 24Z" fill="#c4dc65"/><path d="M-22 5Q-10-5-6 13M-11 24V32H15V24" fill="#879f4a"/></g>
  if(failed) return <img className="sport-fallback" src={ORIGINAL} alt="D 熊猫原稿，运动素材暂不可用" />
  if(!texture) return <img className="sport-fallback" src={ORIGINAL} alt="D 熊猫原稿，运动正在准备" />
  return <svg ref={root} className="sport-panda" viewBox="-70 -15 530 515" role="img" aria-label={`D 熊猫${SPORT_MOTIONS.find(item=>item.id===mode)!.label}连续动画`} data-mode={mode}>
    <defs><image id={`${id}-original`} href={texture} width="390" height="475" onError={()=>setFailed(true)}/>{Object.entries(CUTS).map(([name,path])=><clipPath key={name} id={`${id}-${name}`}><path d={path}/></clipPath>)}<filter id={`${id}-feather`}><feGaussianBlur stdDeviation="5"/></filter><mask id={`${id}-repair`} maskUnits="userSpaceOnUse" x="0" y="0" width="390" height="475"><rect x="231" y="244" width="144" height="192" fill="white" filter={`url(#${id}-feather)`}/><ellipse cx="233" cy="390" rx="17" ry="14" fill="black"/></mask></defs>
    <ellipse cx="194" cy="462" rx="138" ry="10" fill="#a6b586" opacity=".15"/>
    <g data-joint="body">
      <g data-joint="leftLeg">{part('leftLeg')}</g><g data-joint="rightLeg">{part('rightLeg')}</g>
      <g clipPath={`url(#${id}-body)`}><use href={`#${id}-original`}/><g mask={`url(#${id}-repair)`}><use href={`#${id}-original`} transform="translate(400 0) scale(-1 1)"/></g></g>
      <g data-joint="leftArm">{part('leftUpper')}<g data-joint="leftElbow">{mode==='dumbbell'&&weight('left')}{part('leftPaw')}{mode==='boxing'&&glove(43,334)}</g></g>
      <g data-joint="rightArm">{part('rightUpper')}<g data-joint="rightElbow">{mode==='dumbbell'&&weight('right')}{part('rightPaw')}{mode==='boxing'&&glove(289,332)}</g></g>
      <g data-joint="head">{part('head')}</g>
    </g>
  </svg>
}

export function SportCompanion({ active, reduced, quiet = false }: { active: boolean; reduced: boolean; quiet?: boolean }) {
  const [mode,setMode]=useState<SportMotion>('dumbbell')
  const [preview,setPreview]=useState(false)
  const [paused,setPaused]=useState(false)
  const running=!paused&&(active||preview)&&!quiet
  const item=SPORT_MOTIONS.find(item=>item.id===mode)!
  return <section className="sport-companion" aria-label="连续运动陪伴">
    <div className="sport-toolbar"><span>{quiet?'休息中 · 运动已停下':active?'和你一起动起来':'选择熊猫的陪伴动作'}</span><span className="sport-live" data-active={running&&!reduced}>{reduced?'静态模式':running?'连续运动中':'已暂停'}</span></div>
    <SportPanda key={mode} mode={mode} running={running} reduced={reduced}/>
    <div className="sport-tabs" aria-label="熊猫运动方式">{SPORT_MOTIONS.map(item=><button key={item.id} aria-pressed={mode===item.id} onClick={()=>{setMode(item.id);setPreview(true);setPaused(false)}}>{item.label}</button>)}</div>
    <p className="sport-description">{item.description}</p>
    <button disabled={reduced||quiet} onClick={()=>{if(running){setPaused(true)}else{setPaused(false);setPreview(true)}}}>{running&&!reduced?'暂停运动动画': '播放运动动画'}</button>
    <p className="sport-disclaimer">运动氛围陪伴，不是当前动作的教学示范。动画不计次数，也不自动保存训练。</p>
  </section>
}
