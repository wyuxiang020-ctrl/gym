import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {chromium} from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const base=process.env.GYM_TEST_URL||'http://127.0.0.1:4185'
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname))
const out=process.env.GYM_EVAL_OUT||'evals/visual-upgrade-2026-10-09';mkdirSync(out,{recursive:true})
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const fixture=JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'))
fixture.plans=[];fixture.exerciseVideos={}
fixture.dayLogs={[date]:{date,checkedIn:true,strength:[{id:'visual-chest',name:'固定器械推胸',sets:[{weightState:'known',weight:25,reps:12,done:false},{weightState:'known',weight:25,reps:12,done:false}],source:'manual',estKcal:0}],cardio:[],meals:[],water:0}}
const browser=await chromium.launch({headless:true,channel:'msedge'})
const results=[]
const button=(p,name)=>p.getByRole('button',{name,exact:true})
async function audit(page,name){
  await page.evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})))})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}: horizontal overflow`)
  await page.screenshot({path:`${out}/${name}.png`,fullPage:false})
}
for(const width of [360,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',timezoneId:'Asia/Shanghai',serviceWorkers:'block'})
  if(width===390)await context.tracing.start({screenshots:true,snapshots:true})
  await context.addInitScript(data=>{if(!localStorage.getItem('gym-data-v1'))localStorage.setItem('gym-data-v1',JSON.stringify(data))},fixture)
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base)return route.abort();if(url.pathname==='/api/equipment-status')return route.fulfill({json:{available:true,message:'隔离测试：识别服务可用'}});if(url.pathname.startsWith('/api/'))return route.abort();return route.continue()})
  const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message))
  try{
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'把今天，练扎实。'}).waitFor();await page.locator('.training-hero').evaluate(()=>document.fonts.ready)
    await audit(page,`home-${width}`)
    await page.getByRole('button',{name:`${date} 查看记录`,exact:true}).click();await page.getByRole('region',{name:'所选日期记录'}).waitFor();await audit(page,`records-${width}`)
    await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'饮食',exact:true}).click();await page.getByRole('heading',{name:'今日饮食',exact:true}).waitFor();await audit(page,`meal-${width}`)
    await page.getByRole('navigation',{name:'主要导航'}).getByRole('button',{name:'身体',exact:true}).click();await page.getByRole('heading',{name:'身体档案',exact:true}).waitFor();await audit(page,`body-${width}`)
    await page.getByLabel('测量趋势范围').selectOption('7');await page.getByLabel('测量读值日期').selectOption('2026-07-05');assert.ok((await page.locator('.chart-reading').innerText()).includes('69.8'));await page.locator('.chart-reading').scrollIntoViewIfNeeded();await audit(page,`trend-${width}`)
    await page.goto(`${base}/?training-companion=1`,{waitUntil:'domcontentloaded'});await button(page,'开始当前动作').click()
    const row=page.getByRole('group',{name:'固定器械推胸训练记录',exact:true});await row.scrollIntoViewIfNeeded();await audit(page,`training-${width}`)
    await row.getByRole('button',{name:'25 kg · 修改',exact:true}).first().click();await page.getByLabel('重量数值').fill('30');await button(page,'确认重量').click()
    await row.getByRole('checkbox',{name:'完成',exact:true}).first().check()
    const companion=page.getByRole('region',{name:'熊猫训练陪伴',exact:true});await companion.getByRole('heading',{name:'组间歇一会',exact:true}).waitFor();await companion.scrollIntoViewIfNeeded();await audit(page,`rest-${width}`)
    await button(page,'暂停计时').click();const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym-data-v1')));assert.equal(stored.dayLogs[date].strength[0].sets[0].weight,30);assert.equal(stored.dayLogs[date].strength[0].sets[0].done,true)
    await button(page,'结束本次陪练').click();await page.getByRole('heading',{name:'当前动作的已保存记录'}).waitFor();await companion.scrollIntoViewIfNeeded();await audit(page,`completion-${width}`)
    await page.goto(`${base}/?equipment-scan=1`,{waitUntil:'domcontentloaded'});await button(page,'手动选择坐姿推胸机').click();await page.getByRole('heading',{name:'坐姿推胸机',exact:true}).scrollIntoViewIfNeeded();await audit(page,`equipment-result-${width}`)
    await button(page,'确认是坐姿推胸机').click();const teaching=page.getByRole('region',{name:'动作短示范'});await teaching.scrollIntoViewIfNeeded();await audit(page,`teaching-${width}`);await button(page,'02 器械与动作').click();assert.equal(await button(page,'02 器械与动作').getAttribute('aria-current'),'step')
    assert.deepEqual(errors,[]);results.push({width,pass:true})
  }catch(e){results.push({width,pass:false,error:e.message,errors});await page.screenshot({path:`${out}/failure-${width}.png`});process.exitCode=1}
  if(width===390)await context.tracing.stop({path:`${out}/interaction-390.zip`})
  console.log(results.at(-1));await context.close()
}
await browser.close();writeFileSync(`${out}/results.json`,JSON.stringify({date,base,kind:'isolated synthetic records, desktop Edge viewports; no camera/model calls',results},null,2))

