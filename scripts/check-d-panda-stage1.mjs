import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const { raisePreset, deformArm, INTERACTION_DURATION } = await import('../src/companion/interactionMotion.ts')
const out=`evals/virtual-companion/d-panda/stage1-${Date.now()}`, base=process.env.GYM_TEST_URL??'http://127.0.0.1:4175'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname))
mkdirSync(out,{recursive:true})
const checks=[],hash=data=>createHash('sha256').update(data).digest('hex')
const sourceFiles=['src/companion/OriginalInteraction.tsx','src/companion/interactionMotion.ts','src/companion/OriginalIdleRenderer.ts','src/companion/mirror/MirrorSession.ts','src/companion/mirror/mapping.ts','public/companion-assets/pose-worker.js']
const report={base,evidence:'Isolated desktop Edge. Synthetic landmarks / blank generated streams only. No real camera, microphone, people or phone.',targets:{renderMedianFps:30,poseMedianHz:15,releaseMs:1000,performanceWindowMs:60000},checks,sourceHashes:Object.fromEntries(sourceFiles.map(p=>[p,hash(readFileSync(p))]))}
function persist(){writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2))}
async function check(name,fn){try{const data=await fn();checks.push({name,pass:true,data})}catch(error){checks.push({name,pass:false,error:error.stack});process.exitCode=1}persist()}

await check('Seven design PNGs and four textures retain source PNG bytes',()=>{
  const root='public/companion-assets/d-panda',files=readdirSync(`${root}/design`).filter(p=>p.endsWith('.png'))
  for(const name of files) assert.equal(hash(readFileSync(`${root}/design/${name}`)),hash(readFileSync(`docs/virtual-companion-v4/panda-ip-handoff-2026-10-08/assets/${name}`)))
  const source=readFileSync(`${root}/design/D4-hand-interaction.png`)
  for(const part of ['left','right','body','collar']) assert.deepEqual(Buffer.from(readFileSync(`${root}/interaction/${part}.svg`,'utf8').match(/base64,([^"]+)/)[1],'base64'),source)
  return {originals:files.length,textures:4}
})
await check('Independent sides, closed cycle, bounded continuous arm motion',()=>{
  let maxStep=0
  for(const side of ['left','right','both']) {
    assert.deepEqual(raisePreset(0,side),raisePreset(INTERACTION_DURATION,side))
    for(let t=0;t<=2400;t+=16) {
      const pose=raisePreset(t,side),next=raisePreset(Math.min(t+16,2400),side)
      for(const arm of ['left','right']) for(const [x,y] of (arm==='right'?[[30,55],[53,90]]:[[285,60],[288,117]])) {
        const a=deformArm(x,y,arm,pose[arm]),b=deformArm(x,y,arm,next[arm]);maxStep=Math.max(maxStep,Math.hypot(a[0]-b[0],a[1]-b[1]))
        assert.ok(a.every(Number.isFinite))
      }
      if(side!=='both')assert.equal(pose[side==='left'?'right':'left'].shoulder,.1)
    }
  }
  assert.ok(maxStep<12);return {duration:2400,maxStep}
})
await check('Visible arm mesh does not fold across accepted shoulder/elbow range',async()=>{
 const result=[]
 for(const side of ['left','right']) {
  const {data,info}=await sharp(`public/companion-assets/d-panda/interaction/${side}.svg`).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const nx=Math.ceil(315/6),ny=Math.ceil(307/5),dx=315/nx,dy=307/ny
  let minArea=Infinity,count=0,worst=null
  const alpha=(x,y)=>data[(Math.min(info.height-1,Math.floor(y))*info.width+Math.min(info.width-1,Math.floor(x)))*4+3]
  for(let shoulder=.1;shoulder<=2.561;shoulder+=.123)for(let elbow=0;elbow<=1.251;elbow+=.125){
   if(shoulder+elbow>2.95)continue
   for(let y=0;y<ny;y++)for(let x=0;x<nx;x++) {
    const a=[x*dx,y*dy],b=[(x+1)*dx,y*dy],c=[x*dx,(y+1)*dy],d=[(x+1)*dx,(y+1)*dy]
    for(const triangle of [[a,b,c],[b,d,c]]) {
     if(!triangle.some(([px,py])=>alpha(px,py)>128))continue
     const [p,q,r]=triangle.map(([px,py])=>deformArm(px,py,side,{shoulder,elbow}))
     const area=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);if(area<minArea){minArea=area;worst={x:x*dx,y:y*dy,shoulder,elbow}};count++
    }
   }
  }
  assert.ok(minArea>0,`${side} folded mesh: ${minArea} at ${JSON.stringify(worst)}`);result.push({side,minArea,trianglesChecked:count})
 }
 return result
})
if(process.argv.includes('--geometry-only')){console.log(JSON.stringify({out,checks},null,2));process.exit(process.exitCode??0)}

function install(options) {
  const audit={calls:[],tracks:[],workers:[],writes:0,reads:0,frames:0,deferred:[],mode:options.mode??'both',hidden:false}
  for(const method of ['setItem','removeItem','clear'])Storage.prototype[method]=function(){audit.writes++;throw new Error('Storage writes forbidden in experiment')}
  Storage.prototype.getItem=function(){audit.reads++;return null}
  function stream(){
    const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');ctx.fillStyle='#888';ctx.fillRect(0,0,640,480)
    const value=c.captureStream(30),timer=setInterval(()=>ctx.fillRect(0,0,640,480),30)
    value.getTracks().forEach(t=>{const stop=t.stop.bind(t);t.stop=()=>{clearInterval(timer);stop();t.stoppedAt=performance.now()};audit.tracks.push(t)});return value
  }
  navigator.mediaDevices.getUserMedia=async constraints=>{
    audit.calls.push(constraints)
    if(options.media==='deferred')return new Promise(resolve=>audit.deferred.push(()=>resolve(stream())))
    if(options.media!=='fake')throw new DOMException('Synthetic test; no hardware',options.media??'NotAllowedError')
    return stream()
  }
  const landmarks=()=>{
    if(audit.mode==='lost')return []
    const p=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.99,presence:.99}))
    for(const [ids,direction] of [[[11,13,15],1],[[12,14,16],-1]]) {
      const raised=audit.mode==='both'||(audit.mode==='left'&&direction===1)||(audit.mode==='right'&&direction===-1),angle=raised?2.25:.1
      const sx=320+direction*64,sy=190,ex=sx+direction*Math.sin(angle)*80,ey=sy+Math.cos(angle)*80
      const wx=ex+direction*Math.sin(angle+.15)*72,wy=ey+Math.cos(angle+.15)*72
      for(const [i,x,y] of [[ids[0],sx,sy],[ids[1],ex,ey],[ids[2],wx,wy]])p[i]={x:x/640,y:y/480,z:0,visibility:.99,presence:.99}
    }
    if(audit.mode==='partial')p[15].visibility=.1
    return [p]
  }
  if(!options.realWorker) window.Worker=class {
    constructor(){audit.workers.push(this);this.terminated=false}
    postMessage(m){
      if(m.type==='init')setTimeout(()=>this.onmessage?.({data:options.workerError?{type:'error',stage:'init'}:{type:'ready',resourceLoadMs:0,initializationMs:0}}),5)
      if(m.type==='frame'){audit.frames++;m.bitmap.close();setTimeout(()=>this.onmessage?.({data:{type:'result',id:m.id,capturedAt:m.capturedAt,width:m.width,height:m.height,landmarks:landmarks(),inferenceMs:1}}),5)}
    }
    terminate(){this.terminated=true}
  }
  window.fixture={audit,mode:value=>{audit.mode=value},snapshot:()=>({calls:audit.calls,tracks:audit.tracks.filter(t=>t.readyState==='live').length,workers:audit.workers.filter(w=>!w.terminated).length,writes:audit.writes,reads:audit.reads,frames:audit.frames}),resolve:()=>audit.deferred.splice(0).forEach(resolve=>resolve()),hide:value=>{audit.hidden=value;Object.defineProperty(document,'hidden',{configurable:true,get:()=>value});document.dispatchEvent(new Event('visibilitychange'))}}
}
const browser=await chromium.launch({headless:true,channel:'msedge'})
report.browser=browser.version()
async function scenario(name,options,fn) {
  await check(name,async()=>{
    const context=await browser.newContext({viewport:{width:1200,height:1050},serviceWorkers:'block',...(options.record?{recordVideo:{dir:out,size:{width:1200,height:1050}}}:{})})
    const requests=[],errors=[]
    await context.addInitScript(install,options)
    await context.route('**/*',route=>{const url=new URL(route.request().url());requests.push(url.href);return url.origin===base&&!url.pathname.startsWith('/api/')?route.continue():route.abort()})
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
    try {
      await page.goto(`${base}/?companion-lab=1&review=mirror`)
      await page.waitForFunction(()=>document.querySelector('.gentle-play')?.disabled===false)
      const data=await fn(page)
      assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(url=>new URL(url).origin!==base||new URL(url).pathname.startsWith('/api/')),[])
      const audit=await page.evaluate(()=>window.fixture.snapshot());assert.equal(audit.writes,0);assert.equal(audit.reads,0)
      return {...data,audit}
    } finally {await context.close()}
  })
}
const pose=page=>page.locator('canvas[data-part="body"]').getAttribute('data-pose').then(JSON.parse)
const state=(page,value)=>page.waitForFunction(v=>document.querySelector('main')?.dataset.state===v,value)
const start=async page=>{await page.getByRole('button',{name:'跟随我的抬手',exact:true}).click();await page.getByRole('button',{name:'开启摄像头',exact:true}).click()}
const released=page=>page.waitForFunction(()=>{const a=window.fixture.snapshot();return a.tracks===0&&a.workers===0},{},{timeout:1000})
try {
 await scenario('Preset sides / pause / seek / reset / clear-pixel same pose / source / mobile',{record:true},async page=>{
  for(const side of ['画面左手','画面右手','双手']) {
    await page.getByRole('button',{name:side,exact:true}).click()
    for(const at of ['垂手','抬起途中','举高保持','回落途中']){await page.getByRole('button',{name:at,exact:true}).click();await page.waitForTimeout(80);await page.locator('.interaction-plane').screenshot({path:`${out}/${side}-${at}.png`})}
  }
  await page.getByRole('button',{name:'举高保持',exact:true}).click();await page.waitForTimeout(80);const before=await pose(page)
  await page.getByLabel('显示方式',{exact:true}).selectOption('168');await page.waitForTimeout(80)
  assert.deepEqual(await pose(page),before)
  assert.deepEqual(await page.locator('.idle-canvas').evaluateAll(nodes=>nodes.map(n=>[n.width,n.height])),Array(4).fill([168,168]))
  await page.locator('.interaction-plane').screenshot({path:`${out}/pixel-same-pose.png`})
  await page.getByLabel('显示方式',{exact:true}).selectOption('0');await page.waitForTimeout(80);assert.deepEqual(await pose(page),before)
  await page.getByRole('button',{name:'回到原位',exact:true}).click();await page.getByRole('button',{name:'播放抬手',exact:true}).click();await page.waitForTimeout(300);await page.getByRole('button',{name:'暂停',exact:true}).click()
  const paused=await page.getByRole('slider',{name:'抬手进度'}).inputValue();await page.waitForTimeout(200);assert.equal(await page.getByRole('slider',{name:'抬手进度'}).inputValue(),paused)
  await page.getByRole('button',{name:'继续播放',exact:true}).click();await page.waitForTimeout(2500);assert.equal(await page.getByRole('slider',{name:'抬手进度'}).inputValue(),'2400')
  await page.getByRole('button',{name:'查看来源原稿'}).click();assert.ok(await page.getByRole('img',{name:'D4 双手举高原稿'}).isVisible());await page.getByRole('button',{name:'返回互动',exact:true}).click()
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:`${out}/mobile.png`,fullPage:true})
  assert.equal((await page.evaluate(()=>window.fixture.snapshot())).calls.length,0)
 })
 for(const error of ['NotAllowedError','NotFoundError','NotReadableError'])await scenario(`Camera failure ${error}`,{media:error},async page=>{await start(page);await state(page,'error');await released(page);assert.ok(await page.getByRole('button',{name:'重试开启摄像头'}).isEnabled())})
 await scenario('Delayed permission released after switching to presets',{media:'deferred'},async page=>{await start(page);await state(page,'preparing');await page.getByRole('button',{name:'预设体验',exact:true}).click();await page.evaluate(()=>window.fixture.resolve());await released(page);assert.equal((await page.evaluate(()=>window.fixture.snapshot())).calls.length,1)})
 await scenario('Initialization failure stops generated track',{media:'fake',workerError:true},async page=>{await start(page);await state(page,'error');await released(page)})
 await scenario('Fixed landmarks drive independent paws / partial / loss / hidden / restart / switch',{media:'fake',mode:'left'},async page=>{
  await start(page);await state(page,'tracking');await page.waitForTimeout(1500)
  const left=await pose(page);assert.ok(left.right.shoulder>2);assert.ok(left.left.shoulder<.2)
  await page.evaluate(()=>window.fixture.mode('right'));await page.waitForTimeout(1700);const right=await pose(page);assert.ok(right.left.shoulder>2);assert.ok(right.right.shoulder<.2)
  await page.evaluate(()=>window.fixture.mode('partial'));await state(page,'partial')
  await page.evaluate(()=>window.fixture.mode('lost'));await state(page,'lost');await page.waitForTimeout(2500);assert.ok((await pose(page)).left.shoulder<.8)
  await page.evaluate(()=>window.fixture.mode('both'));await state(page,'tracking')
  const at=Date.now();await page.evaluate(()=>window.fixture.hide(true));await state(page,'stopped');await released(page);const releaseMs=Date.now()-at
  await page.evaluate(()=>window.fixture.hide(false));await page.waitForTimeout(200);assert.equal((await page.evaluate(()=>window.fixture.snapshot())).calls.length,1)
  await page.getByRole('button',{name:'开启摄像头',exact:true}).click();await state(page,'tracking');await page.getByRole('button',{name:'预设体验',exact:true}).click();await released(page)
  await start(page);await state(page,'tracking');await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await state(page,'stopped');await released(page)
  return {left,right,releaseMs}
 })
 await scenario('Renderer loss stops camera and recovery uses new canvases',{media:'fake'},async page=>{
  await start(page);await state(page,'tracking');await page.locator('canvas').first().evaluate(c=>c.getContext('webgl').getExtension('WEBGL_lose_context').loseContext())
  await page.getByRole('alert').waitFor();await released(page);await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.gentle-play')?.disabled===false)
  assert.equal((await page.evaluate(()=>window.fixture.snapshot())).calls.length,1)
 })
 await scenario('Actual official model runs on synthetic blank frames only',{media:'fake',realWorker:true},async page=>{
  await start(page);await state(page,'lost');await page.waitForTimeout(4500)
  await page.getByText('运行信息',{exact:true}).click()
  const text=await page.locator('dl').innerText();assert.ok(!text.includes('推理 p50 / p95\n—'))
  await page.getByRole('button',{name:'停止摄像头',exact:true}).click();await released(page)
  return {text,realHuman:'NOT_TESTED',actualPoseHz:'No person in blank input; human pose Hz NOT_MEASURED'}
 })
} finally {await browser.close();persist();console.log(JSON.stringify({out,passed:checks.filter(c=>c.pass).length,total:checks.length,failed:checks.filter(c=>!c.pass)},null,2))}
