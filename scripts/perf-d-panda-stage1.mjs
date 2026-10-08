import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs'
const base=process.env.GYM_TEST_URL??'http://127.0.0.1:4175',out=`evals/virtual-companion/d-panda/stage1-performance-${Date.now()}`
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Loopback only')
mkdirSync(out,{recursive:true})
const fixtureSource=readFileSync('scripts/check-d-panda-stage1.mjs','utf8').split('function install(options) {')[1].split('\nconst browser=')[0]
const install=new Function(`return function install(options) {${fixtureSource}`)()
const report={base,targets:{renderMedianFps:30,windowMs:60000,realPoseMedianHz:15},evidence:'Actual WebGL draw submission intervals in isolated desktop Edge; optional official model receives blank synthetic frames only. Not human pose quality or mobile hardware.',runs:[],realPoseHz:'NOT_TESTED; blank input has no valid person',realCamera:'NOT_USED'}
const persist=()=>writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2))
const modes=process.argv.length>2?process.argv.slice(2):['clear','pixel','blank-model']
if(modes.some(mode=>!['clear','pixel','blank-model'].includes(mode)))throw new Error('Unknown performance mode')
const browser=await chromium.launch({headless:true,channel:'msedge'});report.browser=browser.version()
try {
 for(const mode of modes) {
  const context=await browser.newContext({viewport:{width:1200,height:1050},serviceWorkers:'block'})
  await context.addInitScript(install,{media:'fake',realWorker:true})
  await context.route('**/*',route=>new URL(route.request().url()).origin===base&&!new URL(route.request().url()).pathname.startsWith('/api/')?route.continue():route.abort())
  const page=await context.newPage();await page.goto(`${base}/?companion-lab=1&review=mirror`)
  await page.waitForFunction(()=>document.querySelector('.gentle-play')?.disabled===false)
  if(mode==='pixel')await page.getByLabel('显示方式',{exact:true}).selectOption('168')
  if(mode==='blank-model'){
   await page.getByRole('button',{name:'跟随我的抬手',exact:true}).click();await page.getByRole('button',{name:'开启摄像头',exact:true}).click()
   await page.waitForFunction(()=>document.querySelector('main')?.dataset.state==='lost')
  } else await page.getByRole('button',{name:'播放抬手',exact:true}).click()
  console.log(`Starting ${mode}: 60 seconds; synthetic test only`)
  const measurement=page.evaluate(async mode=>{
   const original=WebGLRenderingContext.prototype.drawElements,intervals=[],submits=[];let last=0,count=0
   WebGLRenderingContext.prototype.drawElements=function(...args){
    const at=performance.now();original.apply(this,args)
    if(this.canvas.dataset.part==='body'){if(last)intervals.push(at-last);last=at;count++;submits.push(performance.now()-at)}
   }
   const loop=setInterval(()=>{if(mode!=='blank-model'&&document.querySelector('.gentle-play')?.textContent==='重新播放')document.querySelector('.gentle-play').click()},25)
   const started=performance.now();await new Promise(resolve=>setTimeout(resolve,60000));const elapsed=performance.now()-started
   clearInterval(loop);WebGLRenderingContext.prototype.drawElements=original
   const p=(values,f)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*f)]
   const canvas=document.querySelector('canvas[data-part="body"]'),gl=canvas.getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info')
   return {elapsed,frames:count,p50Ms:p(intervals,.5),p95Ms:p(intervals,.95),medianFps:1000/p(intervals,.5),drawSubmitP50Ms:p(submits,.5),buffer:[canvas.width,canvas.height],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',runtimeInfo:document.querySelector('dl').textContent,state:document.querySelector('main').dataset.state,activeTracks:window.fixture.snapshot().tracks}
  },mode)
  const data=await measurement
  report.runs.push({mode,...data,targetMet:data.medianFps>=30&&(mode!=='blank-model'||data.state==='lost'&&data.activeTracks===1)});persist();console.log(JSON.stringify({mode,fps:data.medianFps,p95:data.p95Ms}))
  await context.close()
 }
}finally{await browser.close();persist();console.log(out)}
if(report.runs.length!==modes.length||report.runs.some(run=>!run.targetMet))process.exitCode=1
