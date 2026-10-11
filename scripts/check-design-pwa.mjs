import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {chromium} from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const base=process.env.GYM_TEST_URL||'http://127.0.0.1:4185',out=process.env.GYM_EVAL_OUT||'evals/visual-upgrade-2026-10-09'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname))
const data=JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'));data.profile.checkInMode='workout';data.plans=[]
const browser=await chromium.launch({headless:true,channel:'msedge'}),context=await browser.newContext({viewport:{width:390,height:900}})
await context.addInitScript(data=>{if(!localStorage.getItem('gym-data-v1'))localStorage.setItem('gym-data-v1',JSON.stringify(data))},data)
await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort())
const page=await context.newPage(),report={kind:'isolated desktop Edge service worker, no installed phone PWA',checks:[]};page.setDefaultTimeout(20000)
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'准备好，动起来。'}).waitFor()
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'准备好，动起来。'}).waitFor()
 const before=await page.evaluate(()=>localStorage.getItem('gym-data-v1'))
 const manifest=await page.evaluate(async()=>await(await fetch('/manifest.webmanifest')).json());assert.equal(manifest.theme_color,'#101214');assert.equal(manifest.background_color,'#101214')
 report.checks.push('manifest theme and background match design')
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'准备好，动起来。'}).waitFor();await page.getByText(/当前离线 · 已缓存的记录页面/).waitFor()
 assert.equal(await page.evaluate(()=>localStorage.getItem('gym-data-v1')),before)
 assert.equal(await page.evaluate(async()=>{const r=await fetch('/brand/training-hero.webp');return r.ok}),true)
 report.checks.push('offline reload loads cached home, decorative asset and leaves records identical')
 await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'记录',exact:true}).click();await page.getByRole('heading',{name:'历史记录'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('gym-data-v1')),before)
 report.checks.push('offline records remain readable')
 await page.screenshot({path:`out/pwa-offline.png`.replace('out/',out+'/')});await context.setOffline(false)
 await page.getByRole('button',{name:'检查更新',exact:true}).click();await page.getByRole('button',{name:'刷新页面',exact:true}).click();await page.getByRole('heading',{name:'准备好，动起来。'}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('gym-data-v1')),before)
 report.checks.push('explicit update and reload preserve data');report.pass=true
}catch(e){report.pass=false;report.error=e.message;process.exitCode=1;await page.screenshot({path:`${out}/pwa-failure.png`})}
await context.close();await browser.close();writeFileSync(`${out}/pwa.json`,JSON.stringify(report,null,2));console.log(report)
