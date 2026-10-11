import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
const out='evals/sport-panda-2026-10-09', base='http://127.0.0.1:4175'
mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,channel:'msedge'})
const page=await browser.newPage({viewport:{width:1000,height:1000},serviceWorkers:'block'})
const data=JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'))
data.plans=[];data.dayLogs={}
await page.addInitScript(data=>localStorage.setItem('gym-data-v1',JSON.stringify(data)),data)
await page.route('**/*',route=>new URL(route.request().url()).origin===base&&!new URL(route.request().url()).pathname.startsWith('/api/')?route.continue():route.abort())
await page.goto(base+'/?training-companion=1')
await page.getByRole('button',{name:'举哑铃',exact:true}).waitFor()
await page.clock.install({time:new Date('2026-10-09T09:00:00Z')})
await page.clock.pauseAt(new Date('2026-10-09T09:00:01Z'))
const files=[]
for(const [mode,label,steps] of [['dumbbell','举哑铃',[0,1200,1400]],['run','轻快跑步',[0,250,500]],['boxing','活力拳击',[0,450,1000]]]){
 await page.getByRole('button',{name:label,exact:true}).click()
 const svg=page.locator('.sport-panda');await svg.scrollIntoViewIfNeeded();await page.clock.runFor(32)
 for(let i=0;i<steps.length;i++){
  await page.clock.runFor(steps[i]);const file=`pose-${mode}-${i}.png`;files.push({file,label,i})
  await svg.screenshot({path:`${out}/${file}`})
 }
}
await page.getByRole('region',{name:'熊猫训练陪伴',exact:true}).screenshot({path:`${out}/panel.png`})
writeFileSync(`${out}/poses.html`,`<!doctype html><meta charset="utf-8"><title>熊猫运动关键帧检查</title><style>body{background:#101214;color:#eee;font-family:system-ui;margin:20px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{width:100%;background:#17201b}figcaption{text-align:center;padding:10px}</style><h1>原稿分层 · 三种连续运动关键帧</h1><main>${files.map(({file,label,i})=>`<figure><img src="${file}"><figcaption>${label} · ${i+1}</figcaption></figure>`).join('')}</main>`)
await browser.close()
