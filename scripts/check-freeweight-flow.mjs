import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {chromium} from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const {EXPANDED_EXERCISES}=await import('../src/lib/equipmentExpansion.ts')
const {equipmentById,exercisesForEquipment,needsExerciseChoice}=await import('../src/lib/equipment.ts')
const base=process.env.GYM_TEST_URL||'http://127.0.0.1:4186',out=`evals/equipment-scan/freeweights-${Date.now()}`
mkdirSync(out,{recursive:true});const results=[]
const fixture=JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'))
const browser=await chromium.launch({headless:true,channel:'msedge'})
for(const [index,ex]of EXPANDED_EXERCISES.entries()){
 const width=index%2===0?390:1440,eq=equipmentById(ex.equipmentId)
 const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block',reducedMotion:'reduce'})
 await context.addInitScript(data=>{if(!localStorage.getItem('gym-data-v1'))localStorage.setItem('gym-data-v1',JSON.stringify(data));window.YT={Player:class{constructor(el,options){this.el=el;queueMicrotask(()=>options.events.onReady())}destroy(){this.el.remove()}}}},fixture)
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname==='/api/equipment-status')return route.fulfill({json:{available:true,message:'Synthetic'}});if(url.origin!==base)return route.fulfill({body:'Fixed player: not real playback',contentType:'text/html'});if(url.pathname.startsWith('/api/'))return route.abort();return route.continue()})
 const p=await context.newPage();p.setDefaultTimeout(8000);const errors=[];p.on('pageerror',e=>errors.push(e.message));const button=name=>p.getByRole('button',{name,exact:true});const row={exercise:ex.id,width,pass:false}
 try{
  await p.goto(base+'/?equipment-scan=1');await button('手动选择'+eq.name).click()
  const initial=await p.evaluate(()=>localStorage.getItem('gym-data-v1'))
  if(needsExerciseChoice(eq.id)){assert.equal(await button('确认是'+eq.name).isDisabled(),true);await button('03 短视频示范').click();await p.getByRole('dialog',{name:'请先确认器械与动作'}).waitFor();await button('知道了').click()}
  const count=exercisesForEquipment(eq.id).length
  if(count>3){
   if(ex.id==='db-bench'||ex.id==='db-incline-press'){
    assert.equal(count,15)
    const filters=p.locator('.equipment-area-filters');await filters.getByRole('button',{name:'肩部',exact:true}).click();assert.equal(await p.locator('.equipment-exercise').count(),3)
    await p.getByRole('searchbox',{name:'查找动作'}).fill('不存在');assert.equal(await p.locator('.equipment-exercise').count(),0);await button('清除筛选').click();assert.equal(await p.locator('.equipment-exercise').count(),15)
    await p.screenshot({path:`${out}/dumbbell-picker-${width}.png`,fullPage:true,animations:'disabled'})
   }
   await p.getByRole('searchbox',{name:'查找动作'}).fill(ex.name);assert.equal(await p.locator('.equipment-exercise').count(),1)
  }
  await p.getByRole('button',{name:new RegExp('^'+ex.name)}).click();assert.equal(await p.locator('.equipment-exercise[aria-pressed="true"]').count(),1)
  await button('确认是'+eq.name).click();await p.locator('.equipment-quick-guide').waitFor()
  assert.equal(await p.locator('.equipment-quick-guide li').count(),4);assert.equal(await p.locator('.equipment-mistake').count(),3)
  assert.equal(await p.locator('.equipment-guide-source').getAttribute('href'),ex.guideSource)
  assert.ok((await p.locator('.equipment-teaching').innerText()).includes(ex.condition))
  if(ex.id==='db-bench'||ex.id==='db-incline-press')await p.screenshot({path:`${out}/guide-${width}.png`,fullPage:true,animations:'disabled'})
  await button(`查看示范 · ${ex.seconds} 秒`).click();await p.locator('[data-video-state="ready"]').waitFor()
  const src=new URL(await p.locator('iframe').getAttribute('src'));assert.ok(src.pathname.endsWith(ex.videoId));assert.equal(src.searchParams.get('end'),String(ex.endSeconds))
  await button('下一步：训练记录').click();assert.equal(await p.locator('iframe').count(),0)
  await button('带入训练记录 ↗').click();await button('添加到当前训练记录').waitFor()
  assert.equal(await p.evaluate(()=>localStorage.getItem('gym-data-v1')),initial)
  const h=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('gym-equipment-handoff-v1')));assert.equal(h.equipmentId,eq.id);assert.equal(h.exerciseId,ex.id)
  await button('添加到当前训练记录').click();await button('已加入训练记录').waitFor()
  const saved=await p.evaluate(()=>localStorage.getItem('gym-data-v1'));const entries=Object.values(JSON.parse(saved).dayLogs).flatMap(d=>d.strength);assert.ok(entries.some(e=>e.name===ex.exercise&&e.sets.length===0))
  await button('01 拍摄器械').click();await button('确认返回拍摄').click();assert.equal(await p.evaluate(()=>localStorage.getItem('gym-data-v1')),saved)
  assert.equal(await p.evaluate(()=>sessionStorage.getItem('gym-equipment-handoff-v1')),null)
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);row.pass=true
 }catch(e){row.error=e.message;process.exitCode=1}
 results.push(row);writeFileSync(`${out}/results.json`,JSON.stringify({kind:'Synthetic fixed response/player and isolated records; no paid model',results},null,2));console.log(JSON.stringify(row));await context.close()
}
await browser.close();console.log(out)
