import { useEffect, useRef, useState } from 'react'
import { OriginalIdleRenderer } from './OriginalIdleRenderer'
import { deformArm, INTERACTION_DURATION, raisePreset, type RaiseSide } from './interactionMotion'
import { MirrorSession, type MirrorMetrics, type MirrorState } from './mirror/MirrorSession'
import { REST_POSE, type CompanionPose } from './types'
import PixelControl from './PixelControl'
import './gentle.css'
import './idle.css'
import './library.css'
import './interaction.css'

const ROOT = '/companion-assets/d-panda/'
const STATE_LABELS: Record<MirrorState,string> = { idle:'尚未开启',preparing:'正在准备',tracking:'正在跟随',partial:'单侧跟随',lost:'暂停跟随',error:'需要重试',stopped:'相机已关闭' }
const parts = ['collar','right','left','body'] as const
const median = (values: number[], fraction=.5) => [...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*fraction)] ?? 0

export default function OriginalInteraction() {
  const targets=useRef<Array<HTMLCanvasElement|null>>([]), video=useRef<HTMLVideoElement>(null)
  const session=useRef<MirrorSession|null>(null), engines=useRef<OriginalIdleRenderer[]>([])
  const mirrorPose=useRef<CompanionPose>(REST_POSE), clock=useRef(0), running=useRef(false)
  const [input,setInput]=useState<'preset'|'mirror'>('preset'), [side,setSide]=useState<RaiseSide>('both')
  const [playing,setPlaying]=useState(false), [time,setTime]=useState(0), [pixel,setPixel]=useState(0)
  const [ready,setReady]=useState(false), [error,setError]=useState(''), [retry,setRetry]=useState(0)
  const [state,setState]=useState<MirrorState>('idle'), [message,setMessage]=useState('相机默认关闭，先试试预设抬手。')
  const [metrics,setMetrics]=useState<MirrorMetrics|null>(null), [reference,setReference]=useState(false)
  const [stats,setStats]=useState({ fps:0,p95:0,draw:0 })
  const live=useRef({ input,side,pixel,reference }); live.current={input,side,pixel,reference}

  function playback(value:boolean) { running.current=value;setPlaying(value) }
  function seek(value:number) { playback(false);clock.current=value;setTime(value) }
  function chooseInput(value:'preset'|'mirror') {
    session.current?.stop(); playback(false);setInput(value);setReference(false);clock.current=0;setTime(0);mirrorPose.current=REST_POSE
  }
  function stop() { session.current?.stop(); playback(false) }

  useEffect(()=>{
    let disposed=false, initialized=false, failed=false, frame=0, last=performance.now(), published=last
    const nodes=[...targets.current]
    let displayed=REST_POSE
    const intervals:number[]=[], draws:number[]=[]
    const camera=new MirrorSession({video:video.current!,onState:(next,text)=>{if(!disposed){setState(next);setMessage(text)}},onPose:pose=>{mirrorPose.current=pose},onMetrics:value=>{if(!disposed)setMetrics(value)}})
    session.current=camera
    const local:OriginalIdleRenderer[]=[]
    const fail=(text:string)=>{if(!disposed){failed=true;initialized=false;camera.stop('画面中断，相机已关闭。');running.current=false;setPlaying(false);setReady(false);setError(text)}}
    const lost=(event:Event)=>{event.preventDefault();fail('角色画面中断，请重新加载。')}
    try {
      for(const [index,part] of parts.entries()) {
        const engine=new OriginalIdleRenderer(targets.current[index]!,{width:315,height:307,stage:[480,480],placement:[1.12,64,67],texture:ROOT+`interaction/${part}.svg`,sample:()=>({blink:0,deform:(x,y)=>part==='body'?[x,y]:part==='collar'?[x,146-9*((x-160)/65)**2+(y-147)*7]:deformArm(x,y,part,displayed[part])})})
        local.push(engine); targets.current[index]!.addEventListener('webglcontextlost',lost)
      }
      engines.current=local
      void Promise.all(local.map(engine=>engine.initialize())).then(()=>{if(!disposed&&!failed){initialized=true;setReady(true)}}).catch(()=>fail('互动原画加载失败，请重新加载或查看七张原稿。'))
    } catch { fail('浏览器无法初始化互动原画，请重试或查看七张原稿。') }
    function tick(now:number) {
      if(disposed)return
      const interval=now-last, elapsed=Math.min(80,interval);last=now
      if(initialized&&!document.hidden) {
        if(running.current&&live.current.input==='preset') {
          clock.current=Math.min(INTERACTION_DURATION,clock.current+elapsed);setTime(clock.current)
          if(clock.current===INTERACTION_DURATION){running.current=false;setPlaying(false)}
        }
        displayed=live.current.input==='preset'?raisePreset(clock.current,live.current.side):mirrorPose.current
        const started=performance.now()
        local.forEach(engine=>{engine.setPixelHeight(live.current.pixel);engine.draw(clock.current)})
        draws.push(performance.now()-started);intervals.push(interval)
        if(draws.length>600){draws.shift();intervals.shift()}
        const target=targets.current[3]!
        target.dataset.pose=JSON.stringify(displayed)
        if(now-published>=500){published=now;setStats({fps:1000/Math.max(1,median(intervals)),p95:median(intervals,.95),draw:median(draws)})}
      }
      frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    const hide=()=>{if(document.hidden){running.current=false;setPlaying(false)}}
    const exit=()=>camera.stop('已离开页面，相机已关闭。')
    document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',exit)
    return ()=>{disposed=true;cancelAnimationFrame(frame);camera.dispose();session.current=null;local.forEach((engine,index)=>{nodes[index]?.removeEventListener('webglcontextlost',lost);engine.dispose()});engines.current=[];document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',exit)}
  },[retry])

  function play() { if(clock.current>=INTERACTION_DURATION)clock.current=0;setReference(false);playback(true) }
  function startCamera() { playback(false);setReference(false);mirrorPose.current=REST_POSE;void session.current?.start() }
  const active=['preparing','tracking','partial','lost'].includes(state)
  return <main className="original-lab gentle-lab idle-lab companion-library interaction-lab" data-version="D-original-stage1" data-input={input} data-state={state}>
    <header className="original-header"><a href="/">GYM <span>/ D 熊猫</span></a><nav><a href="/?companion-lab=1">动作与表情</a><a href="/?companion-lab=1&review=originals">七张原稿</a><a href="/" onClick={stop}>退出实验 ↗</a></nav></header>
    <section className="original-intro"><p className="original-eyebrow">D PANDA / 抬手互动</p><h1>你抬手，它跟上。</h1><p>先试一段抬手，再让熟悉的 D 陪你动一动。</p></section>
    <div className="interaction-layout">
      <section className="original-stage interaction-stage" aria-label="抬手角色画面">
        <div className="original-stage-heading"><h2>{input==='preset'?'预设抬手':'跟随我的抬手'}</h2><span>{input==='preset'?(playing?'抬起 · 停留 · 放下':'等待播放'):STATE_LABELS[state]}</span></div>
        <div className="gentle-plane interaction-plane">
          {parts.map((part,index)=><canvas key={`${part}-${retry}`} ref={node=>{targets.current[index]=node}} className="idle-canvas" data-part={part} aria-label={part==='body'?'D 熊猫抬手动画':undefined} aria-hidden={part!=='body'||reference||!!error} style={{visibility:reference||error?'hidden':'visible'}} />)}
          {reference&&<svg className="interaction-reference" viewBox="0 0 480 480" role="img" aria-label="D4 双手举高原稿"><svg x="64" y="67" width={315*1.12} height={307*1.12} viewBox="690 520 315 307"><image href={ROOT+'design/D4-hand-interaction.png'} width="1536" height="1024" /></svg></svg>}
          {error&&!reference?<div className="gentle-loading" role="alert"><p>{error}</p><button onClick={()=>{setError('');setReady(false);setRetry(v=>v+1)}}>重新加载</button></div>:!ready&&!reference&&<p className="gentle-loading" role="status">正在加载互动原画…</p>}
        </div>
        <div className="library-options"><PixelControl value={pixel} onChange={setPixel}/><button aria-pressed={reference} onClick={()=>{stop();setReference(!reference)}}>{reference?'返回互动':'查看来源原稿'}</button></div>
        <p className="library-boundary">使用 D4「双手举高」的原图部件。短爪跟随侧向抬手，脸和身体保持原画；不模拟转身、前伸或动作纠错。</p>
      </section>
      <aside className="interaction-controls">
        <div className="library-tabs" role="group" aria-label="互动方式"><button aria-pressed={input==='preset'} onClick={()=>chooseInput('preset')}>预设体验</button><button aria-pressed={input==='mirror'} onClick={()=>chooseInput('mirror')}>跟随我的抬手</button></div>
        {input==='preset'?<section>
          <h2>先看看它怎么抬手</h2><p>选择画面中的一侧或双手，2.4 秒完成抬起、停留、放下。</p>
          <div className="interaction-sides" role="group" aria-label="选择抬手侧">{([['right','画面左手'],['left','画面右手'],['both','双手']] as const).map(([value,label])=><button key={value} aria-pressed={side===value} onClick={()=>{seek(0);setSide(value);setReference(false)}}>{label}</button>)}</div>
          <div className="library-playback"><button className="gentle-play" disabled={!ready||!!error} onClick={()=>playing?playback(false):play()}>{playing?'暂停':time>=INTERACTION_DURATION?'重新播放':time>0?'继续播放':'播放抬手'}</button><button onClick={()=>{seek(0);setReference(false)}}>回到原位</button></div>
          <label className="gentle-timeline">播放进度 <output>{(time/1000).toFixed(2)} / 2.40 秒</output><input aria-label="抬手进度" type="range" min="0" max={INTERACTION_DURATION} step="1" value={time} disabled={!ready||reference||!!error} onChange={event=>seek(Number(event.target.value))}/></label>
          <div className="interaction-checkpoints">{[['垂手',0],['抬起途中',650],['举高保持',1200],['回落途中',1850]] .map(([label,at])=><button disabled={!ready||!!error} key={label} onClick={()=>{seek(Number(at));setReference(false)}}>{label}</button>)}</div>
        </section>:<section>
          <h2>像照镜子一样</h2><p>一人正对镜头，让双肩、双肘和双手入镜。向身体两侧慢慢抬手、停住、放下；你在预览画面左边的手，对应熊猫画面左边的爪。</p>
          <p className="interaction-privacy">仅在你点击开启后使用摄像头，不使用麦克风。画面在本机处理，不上传、不录像、不保存身体关键点。</p>
          <div className="library-playback"><button className="gentle-play" disabled={!ready||!!error||active} onClick={startCamera}>{state==='error'?'重试开启摄像头':'开启摄像头'}</button><button disabled={!active} onClick={stop}>停止摄像头</button></div>
          <p className={`interaction-status state-${state}`} role="status">{message}</p>
          <p className="library-boundary">遮挡时暂停不可靠的一侧；长时间丢失后缓慢回到垂手。切回预设、隐藏页面或退出都会关闭相机，返回后需手动开启。</p>
        </section>}
        <div className="interaction-preview" hidden={input!=='mirror'}><video ref={video} muted playsInline aria-label="本机镜像预览"/><span>{active?'本机预览 · 镜子方向':'相机已关闭'}</span></div>
        <details className="library-inspector"><summary>运行信息</summary><dl><dt>画面帧率（近期中位数）</dt><dd>{stats.fps.toFixed(0)} FPS</dd><dt>帧间隔 p95 / 绘制提交 p50</dt><dd>{stats.p95.toFixed(1)} / {stats.draw.toFixed(1)} ms</dd><dt>识别频率</dt><dd>{metrics?.poseHz.toFixed(1)??'—'} Hz</dd><dt>推理 p50 / p95</dt><dd>{metrics?.inferenceP50Ms?.toFixed(1)??'—'} / {metrics?.inferenceP95Ms?.toFixed(1)??'—'} ms</dd><dt>资源加载 / 模型初始化</dt><dd>{metrics?.resourceLoadMs?.toFixed(0)??'—'} / {metrics?.modelInitMs?.toFixed(0)??'—'} ms</dd><dt>活动相机轨道</dt><dd data-active-tracks={metrics?.activeTracks??0}>{metrics?.activeTracks??0}</dd></dl><p>软件实验入口。真人跟随准确性、实际手机流畅度需设备实测；以上计时不代表人体动作到屏幕的总延迟。</p></details>
      </aside>
    </div>
    <details className="original-source"><summary>原画与实现范围</summary><p>来源为 D4-hand-interaction.png，第五格。只分离已有可见部件，不重画、翻转或补画隐藏区域。连续中间姿势由原图关节变换得到，不是交付包里已有的逐帧动画；左右爪独立，绿色腕结仍在角色自身左腕。原画展示库的 23 段内容与原稿另行保留。</p><p>本阶段以已认可的二维原画替代早期三维造型方案。相机只驱动侧向抬手，肘弯经过收敛以保持短爪比例。没有器械识别、训练评分或自动写入记录。</p><p>方法依据：<a href="https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js" target="_blank" rel="noreferrer">MediaPipe 官方网页姿态识别</a>、<a href="https://esotericsoftware.com/spine-meshes" target="_blank" rel="noreferrer">Spine 原画网格</a>。识别资源由本站提供，Worker 限制为同源静态资源请求。</p></details>
  </main>
}
