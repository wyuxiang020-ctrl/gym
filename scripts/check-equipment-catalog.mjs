import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const { EQUIPMENT_CATALOG, EQUIPMENT_EXERCISES, EQUIPMENT_GUIDES, validateEquipmentResult, needsExerciseChoice } = await import('../src/lib/equipment.ts')
const { EQUIPMENT_SCHEMA } = await import('../api/_lib/equipment.ts')
const { saveEquipmentHandoff, getEquipmentHandoff } = await import('../src/lib/store.ts')
const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4186'
const out = `evals/equipment-scan/catalog-${Date.now()}`; mkdirSync(out, { recursive: true })
const results = []
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'))
const pixels = await sharp({ create: { width: 60, height: 60, channels: 3, background: '#dddddd' } }).png().toBuffer()
const file = { name: 'synthetic.png', mimeType: 'image/png', buffer: pixels }
const resultFor = equipmentId => ({ equipmentId, confidence: 'mid', evidence: ['合成测试，无真实识别'], uncertain: '需人工确认' })
assert.deepEqual(EQUIPMENT_SCHEMA.properties.equipmentId.enum, [...EQUIPMENT_CATALOG.map(item => item.id), 'unknown'])
const map = new Map(); globalThis.sessionStorage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key,value) }
for (const eq of EQUIPMENT_CATALOG) {
 assert.equal(validateEquipmentResult(resultFor(eq.id)).equipmentId, eq.id)
 for (const ex of EQUIPMENT_EXERCISES.filter(item => item.equipmentId === eq.id)) {
  assert.ok(ex.seconds >= 40 && ex.seconds <= 60); assert.equal(ex.endSeconds - ex.startSeconds,ex.seconds)
  const guide = EQUIPMENT_GUIDES[ex.id]; assert.equal(guide.length,4)
  const length=guide.map(item=>item.instruction+(item.mistake??'')).join('').length
  assert.ok(length>=80&&length<=150,`${ex.id} guide length ${length}`)
  assert.equal(saveEquipmentHandoff(false,ex.id,eq.id),true); assert.equal(getEquipmentHandoff().exerciseId,ex.id)
 }
}
assert.throws(()=>validateEquipmentResult(resultFor('invented')))
assert.equal(saveEquipmentHandoff(false,'bilateral','lat_pulldown'),false)
map.set('gym-equipment-handoff-v1',JSON.stringify({equipmentId:'lat_pulldown',exerciseId:'bilateral',confirmedAt:Date.now(),modelMatched:false})); assert.equal(getEquipmentHandoff(),null)
results.push({name:'catalog schema, all guides and matching handoffs',pass:true})
const browser = await chromium.launch({headless:true,channel:'msedge'})
for (const width of [390,1440]) {
 for (const eq of EQUIPMENT_CATALOG) {
  const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'})
  await context.addInitScript(data=>{if(!localStorage.getItem('gym-data-v1'))localStorage.setItem('gym-data-v1',JSON.stringify(data));window.YT={Player:class{constructor(el,options){this.el=el;queueMicrotask(()=>options.events.onReady())}destroy(){this.el.remove()}}}},fixture)
  await context.route('**/*',route=>{
   const url=new URL(route.request().url())
   if(url.pathname==='/api/equipment-status')return route.fulfill({json:{available:true,message:'合成测试'}})
   if(url.pathname==='/api/identify-equipment')return route.fulfill({json:{result:resultFor(eq.id)}})
   if(url.origin!==base)return route.fulfill({body:'Fixed video; no real playback',contentType:'text/html'})
   return route.continue()
  })
  const page=await context.newPage();page.setDefaultTimeout(9000);const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const row={width,equipment:eq.id,pass:false};const button=name=>page.getByRole('button',{name,exact:true})
  try {
   await page.goto(`${base}/?equipment-scan=1`)
   await button('手动选择坐姿推胸机').waitFor()
   const before=await page.evaluate(()=>localStorage.getItem('gym-data-v1'))
   assert.equal(await page.locator('.equipment-picker button').count(),EQUIPMENT_CATALOG.length)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   if(eq.id==='seated_chest_press')await page.screenshot({path:`${out}/picker-${width}.png`,fullPage:true})
   if(width===390)await button(`手动选择${eq.name}`).click()
   else {await page.getByLabel('选择器械照片',{exact:true}).setInputFiles(file);await button('上传并识别器械').click()}
   await button(`确认是${eq.name}`).waitFor()
   const exercises=EQUIPMENT_EXERCISES.filter(item=>item.equipmentId===eq.id),ex=exercises[0]
   assert.equal(await page.locator('.equipment-exercise').count(),exercises.length)
   if (needsExerciseChoice(eq.id)) { assert.equal(await button(`确认是${eq.name}`).isDisabled(),true); await page.getByRole('button',{name:new RegExp('^'+ex.name)}).click() }
   await button(`确认是${eq.name}`).click()
   assert.equal(await page.locator('.equipment-quick-guide li').count(),4)
   assert.equal(await page.locator('.equipment-mistake').count(),3)
   assert.equal(await page.locator('.equipment-guide-source').getAttribute('href'),ex.guideSource)
   await button(`查看示范 · ${ex.seconds} 秒`).click();await page.locator('[data-video-state="ready"]').waitFor()
   const src=new URL(await page.locator('iframe').getAttribute('src'));assert.ok(src.pathname.endsWith(ex.videoId));assert.equal(src.searchParams.get('end'),String(ex.endSeconds))
   if(eq.id==='lat_pulldown')await page.screenshot({path:`${out}/guide-${width}.png`,fullPage:true})
   await button('下一步：训练记录').click();assert.equal(await page.locator('iframe').count(),0)
   await button('带入训练记录 ↗').click();await button('添加到当前训练记录').waitFor()
   const handoff=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gym-equipment-handoff-v1')))
   assert.equal(handoff.equipmentId,eq.id);assert.equal(handoff.exerciseId,ex.id)
   assert.equal(await page.evaluate(()=>localStorage.getItem('gym-data-v1')),before)
   await button('添加到当前训练记录').click();await button('已加入训练记录').waitFor()
   const saved=await page.evaluate(()=>localStorage.getItem('gym-data-v1'))
   const entries=Object.values(JSON.parse(saved).dayLogs).flatMap(day=>day.strength)
   assert.ok(entries.some(item=>item.name===ex.exercise&&item.sets.length===0))
   await button('01 拍摄器械').click();await button('确认返回拍摄').click()
   assert.equal(await page.evaluate(()=>localStorage.getItem('gym-data-v1')),saved)
   const other=EQUIPMENT_CATALOG.find(item=>item.id!==eq.id)
   await button(`手动选择${other.name}`).click();await button('03 短视频示范').click();await page.getByRole('dialog',{name:'请先确认器械与动作'}).waitFor()
   assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));row.pass=true
  }catch(error){row.error=error.message;process.exitCode=1}
  results.push(row);console.log(JSON.stringify(row));writeFileSync(`${out}/results.json`,JSON.stringify({kind:'isolated synthetic data, fixed AI/player; not real recognition',modelCalls:0,results},null,2));await context.close()
 }
}
await browser.close();console.log(out)
