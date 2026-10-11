import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const base=process.env.GYM_TEST_URL||'http://127.0.0.1:4175',out='evals/sport-panda-2026-10-09';mkdirSync(out,{recursive:true})
const data=JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'))
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
data.plans=[];data.dayLogs={[date]:{date,checkedIn:false,water:0,meals:[],cardio:[],strength:[{id:'sport-test',name:'固定器械推胸',sets:[{weightState:'known',weight:20,reps:10,done:false}],source:'manual',estKcal:0}]}}
const browser=await chromium.launch({headless:true,channel:'msedge'});const results=[]
const {SPORT_MOTIONS,sportPose}=await import('../src/companion/sportMotion.ts')
for(const {id,duration} of SPORT_MOTIONS){
 assert.deepEqual(sportPose(id,0),sportPose(id,duration))
 const before=sportPose(id,duration-.1),after=sportPose(id,.1)
 for(const key of Object.keys(before))assert.ok(Math.abs(before[key]-after[key])<.1,`${id}: loop discontinuity at ${key}`)
}
for(const width of [390,360,1000]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'no-preference'})
 await context.addInitScript(data=>{if(!localStorage.getItem('gym-data-v1'))localStorage.setItem('gym-data-v1',JSON.stringify(data))},data)
 await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===base&&!u.pathname.startsWith('/api/')?route.continue():route.abort()})
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message))
 try{
 await page.goto(base+'/?training-companion=1',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'开始当前动作',exact:true}).click()
 const svg=page.locator('.sport-panda');await svg.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.sport-panda')?.dataset.playing==='true')
 const before=await page.evaluate(()=>localStorage.getItem('gym-data-v1'))
 for(const [mode,label]of [['dumbbell','举哑铃'],['run','轻快跑步'],['boxing','活力拳击']]){
 await page.getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(mode=>document.querySelector('.sport-panda')?.dataset.mode===mode,mode)
 await svg.scrollIntoViewIfNeeded();await page.waitForTimeout(500)
 const first=await svg.getAttribute('data-frame-time');await page.waitForTimeout(550);const second=await svg.getAttribute('data-frame-time');assert.ok(Number(second)>Number(first))
 await page.getByRole('button',{name:'暂停运动动画',exact:true}).click();const frozen=await svg.getAttribute('data-frame-time');await page.waitForTimeout(150);assert.equal(await svg.getAttribute('data-frame-time'),frozen)
 await svg.screenshot({path:`${out}/${mode}-${width}.png`});await page.getByRole('button',{name:'播放运动动画',exact:true}).click()
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('gym-data-v1')),before)
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))})
 await page.waitForFunction(()=>document.querySelector('.sport-panda')?.dataset.playing==='false');const hiddenTime=await svg.getAttribute('data-frame-time');await page.waitForTimeout(200);assert.equal(await svg.getAttribute('data-frame-time'),hiddenTime)
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});await svg.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.sport-panda')?.dataset.playing==='true')
 await page.getByLabel('休息时长',{exact:true}).focus();await page.waitForFunction(()=>document.querySelector('.sport-panda')?.dataset.playing==='false')
 await page.getByRole('button',{name:'活力拳击',exact:true}).focus();await svg.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.sport-panda')?.dataset.playing==='true')
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.sport-panda')?.dataset.playing==='false');assert.equal(await page.getByRole('button',{name:'播放运动动画',exact:true}).isDisabled(),true)
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('.sport-panda')?.dataset.playing==='true')
 await page.getByRole('checkbox',{name:'完成',exact:true}).check();await page.getByRole('heading',{name:'组间歇一会',exact:true}).waitFor();assert.equal(await svg.isVisible(),false);assert.equal(await svg.getAttribute('data-playing'),'false')
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));results.push({width,pass:true})
 }catch(e){results.push({width,pass:false,error:e.message,errors});process.exitCode=1;await page.screenshot({path:`${out}/failure-${width}.png`})}
 console.log(results.at(-1));await context.close()
}
await browser.close();writeFileSync(`${out}/results.json`,JSON.stringify({scope:'isolated synthetic records; three loop boundaries; continuous time, pause, synthetic visibility event, editing focus, reduced motion and save-driven rest; no camera/model',results},null,2))
