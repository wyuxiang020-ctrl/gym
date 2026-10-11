import assert from 'node:assert/strict'
import {chromium} from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs'
const out='docs/portfolio/2026-10-09/qa';mkdirSync(out,{recursive:true})
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:4325'
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[]
for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'/projects/gym/');await page.locator('.gc h1').waitFor();await page.evaluate(async()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');await document.fonts.ready;await Promise.all([...document.querySelectorAll('.gc img')].map(i=>i.decode()))})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await page.screenshot({path:`${out}/page-${width}.png`,fullPage:true})
 await page.locator('.gc-cover img').first().click();await page.getByRole('dialog',{name:'项目图片浏览',exact:true}).waitFor();await page.getByRole('button',{name:'下一张图片',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'项目图片浏览',exact:true}).isVisible(),false)
 await page.getByText('三类使用情境：用于检查产品覆盖，不是真人访谈',{exact:true}).click();assert.equal(await page.getByText('刚开始接触器械：',{exact:true}).isVisible(),true)
 if(width===1440){await page.locator('.gc-hero').screenshot({path:`${out}/cover.png`});copyFileSync(`${out}/cover.png`,'docs/portfolio/2026-10-09/site-overlay/public/media/gym-2026/cover.png')}
 for(const file of ['portfolio.pdf','prd.pdf','resume.pdf','prd.html','resume.html','resume.txt','evidence.html']){const response=await page.request.get(base+'/downloads/gym-2026/'+file);assert.equal(response.status(),200);if(file.endsWith('.pdf'))assert.equal((await response.body()).subarray(0,4).toString(),'%PDF')}
 await page.goto(base+'/resume/');assert.ok((await page.locator('body').innerText()).includes('让 AI 结果可检查'))
 assert.deepEqual(errors,[]);results.push({width,pass:true,checked:'gallery; mobile layout; scenario expansion; seven downloads; résumé entry; no runtime errors'});await page.close()
}
await browser.close();writeFileSync(`${out}/results.json`,JSON.stringify({base,results},null,2));console.log(results)
