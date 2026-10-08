import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const out=`evals/virtual-companion/d-panda/browser-${Date.now()}`,base='http://127.0.0.1:4175'
mkdirSync(out,{recursive:true})
const {chromium}=await import(pathToFileURL('C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser=await chromium.launch({headless:true,channel:'msedge'})
const report={at:new Date().toISOString(),checks:[],errors:[],requests:[],blocked:[],camera:'NOT_RUN',phone:'NOT_RUN',result:'RUNNING'}
const context=await browser.newContext({viewport:{width:1360,height:1024},serviceWorkers:'block'})
await context.addInitScript(()=>{
  window.__audit={camera:0,writes:[],reads:[]}
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>{window.__audit.camera++;return Promise.reject(new DOMException('Test denial','NotAllowedError'))}})
  for(const m of ['getItem','setItem','removeItem','clear']){const native=Storage.prototype[m];Storage.prototype[m]=function(...args){window.__audit[m==='getItem'?'reads':'writes'].push(m);return native.apply(this,args)}}
})
await context.route('**/*',r=>{const u=new URL(r.request().url());report.requests.push(u.href);if(u.origin!==base||u.pathname.startsWith('/api/')||!['GET','HEAD'].includes(r.request().method())||(/companion-assets/.test(u.pathname)&&!u.pathname.startsWith('/companion-assets/d-panda/design/'))){report.blocked.push(u.href);return r.abort()}return r.continue()})
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)))
const canvas=page.locator('canvas[data-renderer="d-panda"]'),main=page.locator('main[data-action]')
const state=()=>canvas.getAttribute('data-character-motion')
const seek=async t=>{await page.getByRole('slider',{name:'动作进度'}).evaluate((el,t)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(t));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},t);await page.waitForTimeout(100)}
const select=async(name)=>{await seek(0);await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(80)}
const check=(name)=>report.checks.push({name,pass:true})
try{
  await page.goto(`${base}/?companion-lab=1`);await canvas.waitFor();await seek(0)
  assert.equal(await page.getByText('D 熊猫 · 全新制作',{exact:true}).count(),1)
  assert.deepEqual(await page.evaluate(()=>window.__audit),{camera:0,writes:[],reads:[]});check('D entry renders without old renderer, camera or personal storage access')
  await page.screenshot({path:`${out}/desktop.png`,fullPage:true})
  await page.getByRole('button',{name:/先看抬爪样片/}).click();await seek(3300)
  const held=await state();await page.waitForTimeout(300);assert.equal(await state(),held);check('seek and pause freeze body, face and props')
  await canvas.screenshot({path:`${out}/raise-mid-clear.png`})
  await page.getByRole('button',{name:'像素',exact:true}).click();await page.waitForTimeout(120)
  assert.equal(await state(),held);assert.equal(await canvas.getAttribute('data-actual-display'),'pixel')
  await canvas.screenshot({path:`${out}/raise-mid-pixel.png`})
  for(const name of ['细','中','粗']){await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(80);assert.equal(await state(),held)}
  await page.getByRole('button',{name:'清晰',exact:true}).click();check('clear and all three pixel strengths preserve exactly the same paused state')
  for(const [label,id,t] of [['扶帽招呼','hat',2800],['摘帽致意','removeHat',3800],['大幅招呼','wave',1700],['持竹同行','walk',3650],['转身回望','look',3300],['轻轻伸展','stretch',2200],['坐下歇歇','rest',3800],['跃起欢呼','cheer',1400],['温柔鼓励','encourage',800],['小小庆祝','celebrate',1000],['安静陪伴','idle',2500]]){
    await select(label);await seek(t);assert.equal(await main.getAttribute('data-action'),id)
    const pose=await state();await page.waitForTimeout(120);assert.equal(await state(),pose)
    await canvas.screenshot({path:`${out}/${id}.png`})
  }check('all 11 animation families selectable, pausable and rendered')
  await select('跃起欢呼');await seek(1400);await page.getByRole('button',{name:'扶帽招呼',exact:true}).click();assert.equal(await main.getAttribute('data-action'),'cheer')
  await page.getByText(/先完成收势/).waitFor();await page.waitForTimeout(2050);assert.equal(await main.getAttribute('data-action'),'hat');check('switching in air finishes landing before the next action')
  await select('坐下歇歇');await seek(3800);await page.getByRole('button',{name:'大幅招呼',exact:true}).click();assert.equal(await main.getAttribute('data-action'),'rise');await page.waitForTimeout(2250);assert.equal(await main.getAttribute('data-action'),'wave');check('sitting transitions through rising before a new performance')
  await select('安静陪伴');await seek(2000)
  for(const label of ['正面','左斜侧','右斜侧','左侧','右侧','背面']){await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(80);await canvas.screenshot({path:`${out}/view-${label}.png`})}
  await page.getByRole('button',{name:'正面',exact:true}).click();check('six orientations render with one anatomical left wrist knot')
  const options=await page.getByLabel('表情',{exact:true}).locator('option').count();assert.equal(options,13)
  const faces=[];for(const opt of await page.getByLabel('表情',{exact:true}).locator('option').evaluateAll(opts=>opts.slice(1).map(o=>o.value))){await page.getByLabel('表情',{exact:true}).selectOption(opt);await page.waitForTimeout(70);faces.push(JSON.parse(await state()).face)}
  assert.equal(new Set(faces.map(f=>JSON.stringify(f))).size,12);check('12 distinct expression controls update actual rendered face parameters')
  await page.getByRole('button',{name:'查看导入的设计原图'}).click()
  for(const file of await page.getByLabel('设计原图').locator('option').evaluateAll(opts=>opts.map(o=>o.value))){await page.getByLabel('设计原图').selectOption(file);await page.locator('.lab-design img').evaluate(img=>img.decode());assert.ok(await page.locator('.lab-design img').evaluate(img=>img.naturalWidth>=1000))}check('all seven full-resolution design originals load')
  await page.getByRole('button',{name:'查看导入的设计原图'}).click()
  for(const width of [390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${out}/narrow-${width}.png`,fullPage:true})}check('320 and 390 CSS-pixel layouts have no horizontal overflow (desktop emulation)')
  await page.setViewportSize({width:1360,height:1024});await page.getByRole('button',{name:'一起动',exact:true}).click();await page.waitForTimeout(150)
  assert.equal(await page.evaluate(()=>window.__audit.camera),0);assert.equal(await canvas.getAttribute('data-view'),'front');assert.equal(await page.getByRole('button',{name:'背面',exact:true}).isDisabled(),true)
  const mirror=JSON.parse(await state());for(const k of ['hat','bamboo','lift','crouch','twist'])assert.equal(mirror[k],0)
  await page.getByRole('button',{name:'开启摄像头',exact:true}).click();await page.getByText('相机权限未开启。你可以保留预设体验，或允许权限后重新开启。').waitFor()
  assert.equal(await main.getAttribute('data-mirror-state'),'error');assert.equal(await page.evaluate(()=>window.__audit.camera),1);check('mirror prepares empty paws without camera; explicit click with injected denial shows recovery state')
  await page.getByRole('button',{name:'角色表演',exact:true}).click();await canvas.evaluate(c=>c.dispatchEvent(new Event('contextlost',{cancelable:true})))
  await page.getByRole('button',{name:'重新加载角色'}).click();await canvas.waitFor();assert.equal(await main.getAttribute('data-playing'),'false');check('canvas loss and recovery stop playback and do not restart camera')
  report.audit=await page.evaluate(()=>window.__audit);assert.deepEqual(report.audit.writes,[]);assert.deepEqual(report.audit.reads,[]);assert.deepEqual(report.errors,[])
  assert.equal(report.requests.filter(u=>/\.wasm|pose_landmarker|vision_bundle|\/api\//.test(u)).length,0);check('no API, model, WASM, personal storage or page errors in lab checks')
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await canvas.waitFor();await page.waitForTimeout(150)
  assert.equal(await main.getAttribute('data-playing'),'false');assert.equal(await page.getByRole('checkbox',{name:'减少动态'}).isChecked(),true)
  await select('跃起欢呼');await seek(1400);assert.equal(JSON.parse(await state()).lift,0);check('system reduced motion disables automatic animation and removes jump flight')
  const first=report.requests.length;await page.goto(base);await page.waitForTimeout(300);assert.equal(await page.locator('canvas[data-renderer="d-panda"]').count(),0)
  assert.equal(report.requests.slice(first).filter(u=>/companion-assets|dpanda|CompanionLab/.test(u)).length,0);check('normal app route does not load the D lab or role assets')
  report.result='PASS'
}catch(e){report.result='FAIL';report.failure=e.stack;await page.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{})}
finally{await context.close();await browser.close();report.source=Object.fromEntries(['CompanionLab.tsx','PandaStage.tsx','dpanda/layout.ts','dpanda/motion.ts','dpanda/render.ts','dpanda/player.ts'].map(p=>[p,createHash('sha256').update(readFileSync(`src/companion/${p}`)).digest('hex')]));writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({out,result:report.result,checks:report.checks.length,failure:report.failure}))}
if(report.result!=='PASS')process.exitCode=1
