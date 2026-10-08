import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const { chromium } = await import(pathToFileURL(resolve(process.env.GYM_PLAYWRIGHT_PATH, 'index.mjs')).href)
const phase = process.argv.includes('--before') ? 'before' : 'after'
const out = `evals/workout-save/v3-1/${phase}-${Date.now()}`
mkdirSync(out, { recursive: true })
const paths=['src/components/workout/WeightEditor.tsx','src/components/workout/NLWorkoutInput.tsx','src/lib/store.ts','src/lib/aiValidation.ts','api/parse-workout.ts','api/_lib/openai.ts','api/_lib/demoSafety.ts']
const hashes=Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]))
if(phase==='before')for(const p of paths)writeFileSync(`${out}/${p.replaceAll('/','_')}.txt`,readFileSync(p))
const fixture=JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'));fixture.dayLogs={};fixture.plans=[]
const input='今天卧推50公斤完成两组，每组8次，然后快走15分钟。'
const response={result:{strength:[{name:'卧推',sets:[1,2].map(()=>({weight:50,weightState:'known',reps:8,durationSeconds:null,done:true})),note:'合成测试',uncertain:[]}],cardio:[{type:'快走',minutes:15,distance:null,avgHr:null,intensity:'mid',done:true,note:'',uncertain:[]}]}}
const browser=await chromium.launch({headless:true,channel:'msedge',slowMo:Number(process.env.GYM_DEMO_SLOW_MS||0)})
const checks=[]
async function stored(page){return page.evaluate(()=>JSON.parse(localStorage.getItem('gym-data-v1')))}
async function reopen(page){await page.reload();await page.getByRole('button',{name:'训练',exact:true}).click()}
async function parsed(page){
  await page.route('**/api/parse-workout',r=>r.fulfill({json:response}))
  await page.locator('textarea').fill(input);await page.getByRole('button',{name:'解析',exact:true}).click();await page.getByText(/未保存预览/).waitFor()
}
async function test(id,name,fn){
  if(process.env.GYM_CASE_FILTER&&!id.startsWith(process.env.GYM_CASE_FILTER))return
  const context=await browser.newContext({viewport:{width:Number(process.env.GYM_VIEWPORT_WIDTH||820),height:1024},timezoneId:'Asia/Shanghai',recordVideo:{dir:out,size:{width:820,height:1024}}})
  await context.addInitScript(data=>{
    if(!localStorage.getItem('gym-data-v1'))localStorage.setItem('gym-data-v1',JSON.stringify(data))
    document.addEventListener('DOMContentLoaded',()=>{const b=document.createElement('div');b.textContent='Gym V3.1 验证 · 合成数据 / 固定响应 · 自动化软件测试，非真人';Object.assign(b.style,{position:'fixed',top:'0',left:'0',zIndex:'100',background:'#78350f',color:'white',fontSize:'11px',padding:'4px',width:'100%'});document.body.append(b)})
  },fixture)
  const page=await context.newPage();page.setDefaultTimeout(6000);const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const row={id,name,phase,kind:'automated software test with fixed response, NOT human research',startedAt:new Date().toISOString(),modelCalls:0,costUsd:0,pass:false}
  const started=Date.now()
  try{await page.goto(process.env.GYM_TEST_URL||'http://127.0.0.1:4173');await page.getByRole('button',{name:'训练',exact:true}).click();await fn(page,row);assert.deepEqual(errors,[]);row.pass=true}catch(e){row.error=e.message}
  row.ms=Date.now()-started;row.dataAtEnd=await stored(page).catch(()=>null);await page.screenshot({path:`${out}/${id}.png`,fullPage:true});const video=page.video();await context.close();row.video=await video.path();checks.push(row)
  writeFileSync(`${out}/${id}.json`,JSON.stringify(row,null,2),{flag:'wx'});writeFileSync(`${out}/results.json`,JSON.stringify({phase,sourceHashes:hashes,checks,passed:checks.filter(c=>c.pass).length,total:checks.length},null,2));console.log(JSON.stringify({id,pass:row.pass,ms:row.ms,error:row.error}))
}
await test('R01','Editing saved weight must not mutate it before confirmation',async(page,row)=>{
  await parsed(page);await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByText('AI 训练结果已写入',{exact:true}).waitFor()
  const before=await stored(page);await page.getByRole('button',{name:'50 kg · 修改',exact:true}).first().click()
  row.before=before;row.afterOpeningEditor=await stored(page);assert.deepEqual(row.afterOpeningEditor,before)
  await page.getByLabel('重量数值').fill('90');await page.getByRole('button',{name:'取消重量编辑',exact:true}).click();assert.deepEqual(await stored(page),before)
  await page.getByRole('button',{name:'50 kg · 修改',exact:true}).first().click();await page.getByLabel('重量数值').fill('110');await page.getByLabel('重量单位').selectOption('jin');await page.getByRole('button',{name:'确认重量',exact:true}).click()
  const saved=await stored(page);assert.equal(Object.values(saved.dayLogs)[0].strength[0].sets[0].weight,55);await reopen(page);assert.deepEqual(await stored(page),saved)
})
await test('R02','Unfinished blank name survives refresh with original text and other edits',async(page,row)=>{
  await parsed(page);await page.locator('fieldset input[type=text], fieldset input:not([type])').first().fill('')
  await page.getByPlaceholder('必填',{exact:true}).fill('18')
  await reopen(page);row.recoveredText=await page.locator('textarea').inputValue();assert.equal(row.recoveredText,input)
  assert.equal(await page.locator('fieldset input[type=text], fieldset input:not([type])').first().inputValue(),'')
  assert.equal(await page.getByPlaceholder('必填',{exact:true}).inputValue(),'18')
  assert.equal(await page.getByRole('button',{name:'请先检查内容',exact:true}).isDisabled(),true)
  await page.locator('fieldset input[type=text], fieldset input:not([type])').first().fill('卧推')
  await page.getByRole('button',{name:'确认写入',exact:true}).click();const saved=await stored(page);assert.equal(Object.values(saved.dayLogs)[0].cardio[0].minutes,18);await reopen(page);assert.deepEqual(await stored(page),saved)
})
await test('R03','Out-of-range cardio draft remains editable after refresh',async(page,row)=>{
  await parsed(page);await page.getByPlaceholder('必填',{exact:true}).fill('0');await page.getByLabel('平均心率（可选）').fill('999')
  await reopen(page);row.recoveredText=await page.locator('textarea').inputValue();assert.equal(row.recoveredText,input)
  assert.equal(await page.getByPlaceholder('必填',{exact:true}).inputValue(),'0');assert.equal(await page.getByLabel('平均心率（可选）').inputValue(),'999')
  assert.equal(await page.getByRole('button',{name:'请先补全时长',exact:true}).isDisabled(),true)
  await page.getByPlaceholder('必填',{exact:true}).fill('15');await page.getByLabel('平均心率（可选）').fill('130');await page.getByRole('button',{name:'确认写入',exact:true}).click()
  const saved=await stored(page);await reopen(page);assert.deepEqual(await stored(page),saved)
})
if(phase==='after'){
  await test('R04','Pending preview weight cannot silently save the previous confirmed value',async page=>{
    await parsed(page);await page.getByRole('button',{name:'50 kg · 修改',exact:true}).first().click();await page.getByLabel('重量数值').fill('120')
    assert.equal(await page.getByRole('button',{name:'请先确认或取消重量编辑',exact:true}).isDisabled(),true)
    await page.getByRole('button',{name:'取消重量编辑',exact:true}).click();await page.getByRole('button',{name:'确认写入',exact:true}).click()
    assert.equal(Object.values((await stored(page)).dayLogs)[0].strength[0].sets[0].weight,50)
  })
  await test('R05','Removing an edited set releases pending-save guard',async page=>{
    await parsed(page);await page.getByRole('button',{name:'50 kg · 修改',exact:true}).first().click()
    await page.locator('fieldset').getByRole('button',{name:'✕',exact:true}).first().click()
    assert.equal(await page.getByRole('button',{name:'确认写入',exact:true}).isEnabled(),true)
    await page.getByRole('button',{name:'确认写入',exact:true}).click();assert.equal(Object.values((await stored(page)).dayLogs)[0].strength[0].sets.length,1)
  })
  await test('R06','Network failure preserves invalid draft until corrected and saved',async page=>{
    await parsed(page);await page.getByPlaceholder('必填',{exact:true}).fill('0');await page.unroute('**/api/parse-workout');await page.route('**/api/parse-workout',r=>r.abort('failed'))
    await page.getByRole('button',{name:'重新解析',exact:true}).click();await page.getByText(/无法连接 AI/).waitFor();await reopen(page)
    assert.equal(await page.locator('textarea').inputValue(),input);assert.equal(await page.getByPlaceholder('必填',{exact:true}).inputValue(),'0')
    await page.getByPlaceholder('必填',{exact:true}).fill('15');await page.getByRole('button',{name:'确认写入',exact:true}).click();const saved=await stored(page);await reopen(page);assert.deepEqual(await stored(page),saved)
  })
  await test('R07','Storage failure preserves the saved weight and pending edit for retry',async page=>{
    await parsed(page);await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByText('AI 训练结果已写入',{exact:true}).waitFor();const before=await stored(page)
    await page.getByRole('button',{name:'50 kg · 修改',exact:true}).first().click();await page.getByLabel('重量数值').fill('55')
    await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreStorage=()=>{Storage.prototype.setItem=original};Storage.prototype.setItem=function(k,v){if(k==='gym-data-v1')throw new DOMException('Storage full','QuotaExceededError');return original.call(this,k,v)}})
    await page.getByRole('button',{name:'确认重量',exact:true}).click();await page.getByText('Storage full',{exact:true}).waitFor();assert.deepEqual(await stored(page),before);assert.equal(await page.getByLabel('重量数值').inputValue(),'55')
    await page.evaluate(()=>window.restoreStorage());await page.getByRole('button',{name:'确认重量',exact:true}).click();const saved=await stored(page);assert.equal(Object.values(saved.dayLogs)[0].strength[0].sets[0].weight,55);await reopen(page);assert.deepEqual(await stored(page),saved)
  })
}
await browser.close();console.log(out);if(checks.some(c=>!c.pass))process.exitCode=1
