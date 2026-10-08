import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

// Uses an isolated browser profile, never the user's real Gym localStorage.
const playwrightPath = process.env.GYM_PLAYWRIGHT_PATH
const { chromium } = playwrightPath ? await import(pathToFileURL(resolve(playwrightPath,'index.mjs')).href) : await import('playwright')
const base = process.env.GYM_TEST_URL || 'http://127.0.0.1:4173'
const out = `${process.env.GYM_TEST_OUTPUT_ROOT || 'evals/workout-save/v3/results'}/browser-${Date.now()}`
mkdirSync(out,{recursive:true})
const fixture = JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'))
fixture.dayLogs = {}
fixture.plans = [{id:'synthetic-v3',createdAt:'2026-09-30',isActive:true,name:'合成测试模板',days:[{label:'测试日 A',exercises:[{name:'测试划船',sets:2,repRange:'8次'}],cardio:{type:'快走',minutes:12}}]}]
const browser = await chromium.launch({headless:true,channel:process.env.GYM_BROWSER_CHANNEL || 'msedge',slowMo:Number(process.env.GYM_DEMO_SLOW_MS || 0)})
const results=[]
const sample=(state='unknown',done=true)=>({strength:[{name:'测试划船',sets:[8,6].map(reps=>({weight:state==='known'?35:null,weightState:state,reps,durationSeconds:null,done})),note:'合成测试输入',uncertain:state==='unknown'?['重量待核对']:[]}],cardio:[]})
const raw='刚做了两组划船，第一组8次，第二组6次，忘了重量。'
async function test(name, run) {
  if (process.env.GYM_BROWSER_CASE_FILTER && !name.startsWith(process.env.GYM_BROWSER_CASE_FILTER)) return
  const started=Date.now()
  const context=await browser.newContext({viewport:{width:Number(process.env.GYM_VIEWPORT_WIDTH || 820),height:1024},timezoneId:'Asia/Shanghai',recordVideo:{dir:out,size:{width:820,height:1024}}})
  await context.addInitScript(({data,version})=>{
    if(!localStorage.getItem('gym-data-v1'))localStorage.setItem('gym-data-v1',JSON.stringify(data))
    document.addEventListener('DOMContentLoaded',()=>{
      const banner=document.createElement('div');banner.textContent=`Gym ${version} · 合成资料 / 固定 API 响应 · 自动化演示，非真人测试`
      Object.assign(banner.style,{position:'fixed',top:'0',left:'0',width:'100%',zIndex:'100',background:'#78350f',color:'white',fontSize:'11px',textAlign:'center',padding:'3px'});document.body.append(banner)
    })
  },{data:fixture,version:process.env.GYM_TEST_VERSION || '保存流程 V3 · 2026-09-30'})
  const page=await context.newPage();page.setDefaultTimeout(6000)
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const artifact={name,pass:false}
  try {
    await page.goto(base);await page.getByRole('button',{name:'训练',exact:true}).click()
    await run(page,context)
    assert.deepEqual(errors,[])
    artifact.pass=true
  }catch(error){artifact.error=error.message}
  artifact.ms=Date.now()-started
  artifact.screenshot=`${out}/${results.length+1}.png`
  await page.screenshot({path:artifact.screenshot,fullPage:true})
  const video=page.video();await context.close();artifact.video=await video.path()
  results.push(artifact);writeFileSync(`${out}/results.json`,JSON.stringify({version:process.env.GYM_TEST_VERSION||'save-v3',api:'mocked fault injection, no model accuracy or human performance claims',results},null,2))
  console.log(JSON.stringify(artifact))
}
async function parse(page,result=sample()) {
  await page.route('**/api/parse-workout',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result})}))
  await page.locator('textarea').fill(raw)
  await page.getByRole('button',{name:'解析',exact:true}).click()
  await page.getByText(/未保存预览/).waitFor()
}
async function stored(page) {return page.evaluate(()=>JSON.parse(localStorage.getItem('gym-data-v1')))}
function log(data){return Object.values(data.dayLogs)[0]}
async function reopen(page){await page.reload();await page.getByRole('button',{name:'训练',exact:true}).click()}
await test('01 input-edit-unit-bulk-undo-confirm-reopen',async page=>{
  await parse(page)
  assert.equal(Object.keys((await stored(page)).dayLogs).length,0)
  assert.equal(await page.getByRole('button',{name:'请先检查内容',exact:true}).isDisabled(),true)
  await page.getByLabel('重量状态',{exact:true}).first().selectOption('known')
  await page.getByLabel('重量数值').fill('100');await page.getByLabel('重量单位').selectOption('jin')
  await page.getByRole('button',{name:'确认重量',exact:true}).click()
  await page.getByRole('button',{name:'第一组重量应用到本动作全部组',exact:true}).click()
  await page.getByRole('button',{name:/撤销批量操作/}).click()
  assert.equal(await page.getByLabel('重量状态',{exact:true}).nth(1).inputValue(),'unknown')
  await page.getByRole('button',{name:'第一组重量应用到本动作全部组',exact:true}).click()
  await page.locator('fieldset').getByRole('button',{name:'+',exact:true}).first().click()
  await reopen(page)
  assert.equal(await page.getByLabel('重量状态',{exact:true}).nth(1).inputValue(),'known')
  await page.getByRole('button',{name:'确认写入',exact:true}).click()
  await page.getByText('AI 训练结果已写入',{exact:true}).waitFor()
  const saved=await stored(page);assert.deepEqual(log(saved).strength[0].sets,[{weight:50,weightState:'known',reps:9,done:true},{weight:50,weightState:'known',reps:6,done:true}])
  await reopen(page);assert.deepEqual(await stored(page),saved)
  assert.equal(await page.locator('fieldset').count(),0)
  assert.equal(await page.locator('textarea').inputValue(),'')
  await page.getByRole('button',{name:'测试划船',exact:true}).scrollIntoViewIfNeeded()
  if (process.env.GYM_DEMO_SLOW_MS) await page.waitForTimeout(1800)
})
await test('02 template-import-edit-complete-reopen-duplicate-skip-cancel',async page=>{
  await page.getByRole('button',{name:'测试日 A',exact:true}).click()
  let saved=await stored(page);assert.equal(log(saved).strength.length,1);assert.equal(log(saved).cardio.length,1)
  assert.ok(log(saved).strength[0].sets.every(s=>!s.done&&s.weight===null&&s.weightState==='unknown'))
  await page.getByLabel('重量状态',{exact:true}).first().selectOption('bodyweight')
  await page.getByLabel('完成',{exact:true}).first().check()
  saved=await stored(page);await reopen(page);assert.deepEqual(await stored(page),saved)
  await page.getByRole('button',{name:'测试日 A',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();assert.deepEqual(await stored(page),saved)
  await page.getByRole('button',{name:'测试日 A',exact:true}).click();await page.getByRole('button',{name:'跳过重复项目',exact:true}).click();assert.deepEqual(await stored(page),saved)
})
await test('03 network-failure-retry-cancel-preserves-edited-preview',async page=>{
  await parse(page,sample('bodyweight'))
  await page.locator('fieldset').getByRole('button',{name:'+',exact:true}).first().click()
  await page.unroute('**/api/parse-workout');await page.route('**/api/parse-workout',r=>r.abort('failed'))
  await page.getByRole('button',{name:'重新解析',exact:true}).click();await page.getByText(/无法连接 AI/).waitFor()
  assert.equal(await page.getByRole('button',{name:'确认写入',exact:true}).isEnabled(),true)
  await reopen(page)
  assert.equal(await page.locator('fieldset').getByText('9',{exact:true}).count(),1)
  await page.unroute('**/api/parse-workout');await page.route('**/api/parse-workout',async r=>{await new Promise(resolve=>setTimeout(resolve,2000));await r.fulfill({json:{result:sample('known')}}).catch(()=>{})})
  await page.getByRole('button',{name:'重新解析',exact:true}).click();await page.getByRole('button',{name:'取消等待',exact:true}).click();await page.getByText(/已取消等待/).waitFor()
  await page.waitForTimeout(2200)
  assert.equal(await page.getByLabel('重量状态',{exact:true}).first().inputValue(),'bodyweight')
  await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByText('AI 训练结果已写入',{exact:true}).waitFor()
  const saved=await stored(page);assert.equal(log(saved).strength[0].sets[0].reps,9)
  await reopen(page);assert.deepEqual(await stored(page),saved)
})
await test('04 future-strength-and-cardio-not-saved',async page=>{
  const future=sample('known',false);future.cardio=[{type:'跑步',minutes:20,distance:null,avgHr:null,intensity:'mid',done:false,note:'明天计划',uncertain:[]}]
  await parse(page,future)
  assert.equal(await page.getByRole('button',{name:'请先检查内容',exact:true}).isDisabled(),true)
  await page.getByRole('button',{name:'取消预览',exact:true}).click();assert.equal(Object.keys((await stored(page)).dayLogs).length,0)
  assert.equal(await page.locator('textarea').inputValue(),raw)
})
await test('05 repeated-AI-import-requires-explicit-replace-and-cancel',async page=>{
  await parse(page,sample('known'));await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByText('AI 训练结果已写入',{exact:true}).waitFor()
  const first=await stored(page)
  await page.locator('textarea').fill(raw);await page.getByRole('button',{name:'解析',exact:true}).click();await page.getByText(/未保存预览/).waitFor();await page.getByRole('button',{name:'确认写入',exact:true}).click()
  await page.getByRole('button',{name:'返回编辑',exact:true}).click();assert.deepEqual(await stored(page),first)
  await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByRole('button',{name:'替换同名动作组数',exact:true}).click()
  assert.equal(log(await stored(page)).strength[0].sets.length,2)
})
await test('06 quota-failure-does-not-claim-save-or-clear-draft',async page=>{
  await parse(page,sample('not_applicable'))
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='gym-data-v1')throw new DOMException('Storage full','QuotaExceededError');return original.call(this,k,v)}})
  await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByText('Storage full',{exact:true}).waitFor()
  assert.equal(Object.keys((await stored(page)).dayLogs).length,0);assert.equal(await page.locator('fieldset').count(),1)
  await reopen(page);assert.equal(await page.getByLabel('重量状态',{exact:true}).first().inputValue(),'not_applicable')
})
await test('07 changed-original-input-invalidates-old-preview',async page=>{
  await parse(page,sample('known'));await page.locator('textarea').fill('新的训练内容')
  assert.equal(await page.locator('fieldset').count(),0)
  await reopen(page);assert.equal(await page.locator('textarea').inputValue(),'新的训练内容')
  assert.equal(Object.keys((await stored(page)).dayLogs).length,0)
})
await test('08 replace-retains-two-new-cardio-sessions',async page=>{
  const c=minutes=>({type:'跑步',minutes,intensity:'mid',distance:null,avgHr:null,done:true,note:'合成',uncertain:[]})
  await parse(page,{strength:[],cardio:[c(10)]});await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByText('AI 训练结果已写入',{exact:true}).waitFor()
  await page.unroute('**/api/parse-workout');await parse(page,{strength:[],cardio:[c(15),c(25)]})
  await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByRole('button',{name:'替换同名动作组数',exact:true}).click()
  const saved=await stored(page);assert.deepEqual(log(saved).cardio.map(c=>c.minutes),[15,25]);await reopen(page);assert.deepEqual(await stored(page),saved)
})
await test('09 request-unmount-does-not-write-late-result',async page=>{
  await page.route('**/api/parse-workout',async r=>{await new Promise(resolve=>setTimeout(resolve,1800));await r.fulfill({json:{result:sample('known')}}).catch(()=>{})})
  await page.locator('textarea').fill(raw);await page.getByRole('button',{name:'解析',exact:true}).click()
  await page.getByRole('button',{name:'今天',exact:true}).click();await page.waitForTimeout(2000)
  await page.getByRole('button',{name:'训练',exact:true}).click()
  assert.equal(await page.locator('textarea').inputValue(),raw);assert.equal(await page.locator('fieldset').count(),0)
  assert.equal(Object.keys((await stored(page)).dayLogs).length,0)
})
await browser.close()
console.log(JSON.stringify({output:out,passed:results.filter(r=>r.pass).length,total:results.length}))
if(results.some(r=>!r.pass))process.exitCode=1
