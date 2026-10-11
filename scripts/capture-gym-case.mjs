import assert from 'node:assert/strict'
import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
const out='docs/portfolio/2026-10-09/screenshots';mkdirSync(out,{recursive:true})
const base='http://127.0.0.1:4175'
const fixture=JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'))
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const today=structuredClone(fixture.dayLogs['2026-09-06']);today.date=date;today.strength[0].name='固定器械推胸';fixture.dayLogs[date]=today
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:390,height:880},deviceScaleFactor:2,reducedMotion:'reduce',serviceWorkers:'block',timezoneId:'Asia/Shanghai'})
await context.addInitScript(data=>localStorage.setItem('gym-data-v1',JSON.stringify(data)),fixture)
await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==base)return route.abort();if(u.pathname==='/api/equipment-status')return route.fulfill({json:{available:true,message:'作品集截图环境'}});if(u.pathname==='/api/parse-meal')return route.fulfill({json:{result:{items:[{name:'牛肉面',grams:450,kcal:580,protein:26,carbs:75,fat:19,confidence:'low'},{name:'卤蛋',grams:50,kcal:75,protein:6.5,carbs:1,fat:5,confidence:'mid'}]}}});if(u.pathname.startsWith('/api/'))return route.abort();return route.continue()})
const page=await context.newPage();page.setDefaultTimeout(18000);const captured=[]
async function shot(name,source='实际界面 / 合成演示记录'){
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))})
 await page.screenshot({path:`${out}/${name}.png`});captured.push({name,source,width:390,height:880})
}
await page.goto(base);await page.getByRole('heading',{name:'把今天，练扎实。'}).waitFor();await shot('home')
const nav=page.getByRole('navigation',{name:'主要导航'})
await nav.getByRole('button',{name:'饮食',exact:true}).click();await shot('meal')
await page.getByPlaceholder('中午吃了一碗牛肉面加一个卤蛋').fill('中午吃了一碗牛肉面加一个卤蛋')
await page.getByRole('button',{name:'解析',exact:true}).click();await page.getByPlaceholder('食物名称').first().waitFor();await page.getByPlaceholder('食物名称').first().scrollIntoViewIfNeeded();await shot('meal-preview','实际界面 / 固定 AI 返回用于展示核对操作，非实时模型评测')
await nav.getByRole('button',{name:'身体',exact:true}).click();await page.getByLabel('测量趋势范围').scrollIntoViewIfNeeded();await shot('progress')
await nav.getByRole('button',{name:'记录',exact:true}).click();await shot('history')
await page.goto(base+'/?training-companion=1');await page.getByRole('button',{name:'开始当前动作',exact:true}).click()
assert.equal(await page.getByRole('button',{name:'举哑铃',exact:true}).count(),0);assert.equal(await page.locator('.sport-companion').count(),0)
const row=page.getByRole('group',{name:'固定器械推胸训练记录',exact:true});await row.scrollIntoViewIfNeeded();await shot('training')
await row.getByRole('checkbox',{name:'完成',exact:true}).nth(2).check();const panel=page.getByRole('region',{name:'熊猫训练陪伴',exact:true});await panel.getByRole('heading',{name:'组间歇一会',exact:true}).waitFor();await panel.scrollIntoViewIfNeeded();await page.getByRole('button',{name:'暂停计时',exact:true}).click();await shot('panda-rest')
await page.getByRole('button',{name:'结束本次陪练',exact:true}).click();await page.getByRole('heading',{name:'当前动作的已保存记录',exact:true}).scrollIntoViewIfNeeded();await shot('summary')
await page.goto(base+'/?equipment-scan=1');await page.getByRole('button',{name:'手动选择坐姿推胸机',exact:true}).waitFor();await shot('scan')
await page.getByRole('button',{name:'手动选择坐姿推胸机',exact:true}).click();await page.getByRole('heading',{name:'坐姿推胸机',exact:true}).scrollIntoViewIfNeeded();await shot('equipment','实际界面 / 手动选择器械路径，不是识别准确率证明')
await page.getByRole('button',{name:'确认是坐姿推胸机',exact:true}).click();await page.getByRole('region',{name:'器械教学适用性',exact:true}).scrollIntoViewIfNeeded();await shot('teaching','实际界面 / 指定型号资料核对')
writeFileSync(`${out}/manifest.json`,JSON.stringify({date,captured,fixture:'synthetic-demo-data.json; isolated browser; no user records or paid calls'},null,2))
await browser.close();console.log(`Captured ${captured.length} screens; three sports absent`)
