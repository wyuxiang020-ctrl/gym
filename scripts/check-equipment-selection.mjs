import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const { EQUIPMENT_CATALOG } = await import('../src/lib/equipment.ts')
const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4186'
const out = `evals/equipment-scan/selection-${Date.now()}`; mkdirSync(out, { recursive: true })
const file = { name: 'synthetic.png', mimeType: 'image/png', buffer: await sharp({create:{width:50,height:50,channels:3,background:'#abc'}}).png().toBuffer() }
const browser = await chromium.launch({channel:'msedge',headless:true})
const report = { kind:'Isolated browser, synthetic photo and fixed AI; no paid model or physical camera', results:[] }
for (const width of [320,390,1440]) {
 const c = await browser.newContext({viewport:{width,height:950},serviceWorkers:'block',reducedMotion:'reduce'})
 let calls=0, finishRequest
 await c.route('**/api/equipment-status',r=>r.fulfill({json:{available:true,message:'Synthetic status'}}))
 await c.route('**/api/identify-equipment',async r=>{calls++;await new Promise(resolve=>{finishRequest=resolve});await r.fulfill({json:{result:{equipmentId:'ez_bar',confidence:'mid',evidence:['Synthetic fixture'],uncertain:'Manual confirmation required'}}}).catch(()=>{})})
 const p=await c.newPage();p.setDefaultTimeout(10000);const button=name=>p.getByRole('button',{name,exact:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));const row={width,pass:false}
 try {
  await p.goto(base+'/?equipment-scan=1');await button('主动选择').waitFor()
  assert.equal(await button('主动选择').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('.equipment-picker button').count(),EQUIPMENT_CATALOG.length)
  assert.equal(await p.locator('input[type=file]').count(),0);assert.equal(calls,0)
  for(const [name,count] of [['自由器械',4],['固定器械',10],['绳索与综合',2]]){
   await p.locator('.equipment-kind-filters').getByRole('button',{name:new RegExp('^'+name)}).click();assert.equal(await p.locator('.equipment-picker button').count(),count)
  }
  await p.locator('.equipment-kind-filters').getByRole('button',{name:/^自由器械/}).click();await p.getByRole('searchbox',{name:'查找器械'}).fill('壶铃');assert.equal(await p.locator('.equipment-picker button').count(),1)
  await p.getByRole('searchbox',{name:'查找器械'}).fill('not-an-equipment');await button('清除筛选，查看全部').click();assert.equal(await p.locator('.equipment-picker button').count(),16)
  await p.locator('.equipment-selection-card').screenshot({path:`${out}/manual-${width}.png`})
  await button('拍照识别').click();await p.getByLabel('选择器械照片',{exact:true}).setInputFiles(file);await p.getByAltText('待识别的器械照片，本地预览').waitFor();assert.equal(calls,0)
  const photo=await p.locator('.equipment-photo img').getAttribute('src')
  await button('主动选择').click();await button('拍照识别').click();assert.equal(await p.locator('.equipment-photo img').getAttribute('src'),photo)
  await p.locator('.equipment-selection-card').screenshot({path:`${out}/photo-${width}.png`})
  await button('上传并识别器械').click();await button('正在识别…').waitFor();await button('主动选择').click();await p.getByRole('dialog',{name:'取消本次识别，改为主动选择？'}).waitFor()
  await button('留在当前步骤').click();assert.equal(await button('拍照识别').getAttribute('aria-pressed'),'true')
  await button('主动选择').click();await button('取消等待并切换').click();assert.equal(await button('主动选择').getAttribute('aria-pressed'),'true');finishRequest();await p.waitForTimeout(400)
  await button('手动选择壶铃').click();assert.equal(await p.locator('.equipment-summary h2').innerText(),'壶铃');assert.equal(await p.locator('.equipment-summary img').count(),0)
  assert.equal(await button('确认是壶铃').isDisabled(),true);await p.getByRole('button',{name:/^壶铃硬拉/}).click();await button('确认是壶铃').click();assert.equal(await p.locator('.equipment-quick-guide li').count(),4)
  await button('01 器械选择').click();await button('留在当前步骤').click();assert.equal(await button('03 短视频示范').getAttribute('aria-current'),'step')
  await button('01 器械选择').click();await button('确认返回选择').click();assert.equal(await button('主动选择').getAttribute('aria-pressed'),'true')
  await button('拍照识别').click();assert.equal(await p.locator('.equipment-photo img').count(),0)
  await p.getByLabel('选择器械照片',{exact:true}).setInputFiles(file);await button('上传并识别器械').click();await button('正在识别…').waitFor()
  // Resolve while the switch confirmation is open, then confirm switching; late results must clear.
  await button('主动选择').click();finishRequest();await p.getByRole('button',{name:'确认是EZ 曲杆',exact:true}).waitFor({state:'attached'});await button('取消等待并切换').click();await button('主动选择').waitFor()
  assert.equal(await button('01 器械选择').getAttribute('aria-current'),'step');assert.equal(await button('主动选择').getAttribute('aria-pressed'),'true')
  assert.equal(await p.evaluate(()=>localStorage.getItem('gym-data-v1')),null);assert.equal(calls,2);assert.deepEqual(errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  row.pass=true
 }catch(e){row.error=e.message;process.exitCode=1;finishRequest?.()}
 report.results.push(row);console.log(JSON.stringify(row));writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await c.close()
}
await browser.close();console.log(out)
