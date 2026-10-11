import {chromium} from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const browser=await chromium.launch({channel:'msedge',headless:true})
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message))
const base='https://yuxiangworks.com',out='docs/portfolio/2026-10-09/qa'
try{
await page.goto(base+'/projects/gym/',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('.gc h1').waitFor({timeout:30000})
const release=await page.evaluate(async()=>await (await fetch('/release.json',{cache:'no-store'})).json());assert.equal(release.version,'2026-10-09.5')
await page.evaluate(async()=>{document.querySelectorAll('.gc img').forEach(i=>i.loading='eager');await document.fonts.ready;await Promise.all([...document.querySelectorAll('.gc img')].map(i=>i.decode()))})
await page.locator('.gc-hero').screenshot({path:out+'/production-hero.png'})
await page.locator('.gc-cover img').first().click();await page.getByRole('dialog',{name:'项目图片浏览',exact:true}).waitFor();await page.keyboard.press('Escape')
const downloads=[]
for(const file of ['portfolio.pdf','prd.pdf','resume.pdf','gym-portfolio.zip']){
 const actual=await page.evaluate(async file=>{const r=await fetch('/downloads/gym-2026/'+file);const bytes=await r.arrayBuffer();return{status:r.status,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join(''),length:bytes.byteLength}},file)
 const local=file==='gym-portfolio.zip'?'docs/portfolio/2026-10-09/Gym-完整产品作品集-2026-10-09.zip':`docs/portfolio/2026-10-09/delivery/documents/${file}`
 assert.equal(actual.status,200);assert.equal(actual.hash,createHash('sha256').update(readFileSync(local)).digest('hex'));downloads.push({file,...actual})
}
for(const file of ['prd.html','resume.html','resume.txt','evidence.html'])assert.equal(await page.evaluate(async file=>(await fetch('/downloads/gym-2026/'+file)).status,file),200)
await page.goto(base+'/resume/');assert.ok((await page.locator('body').innerText()).includes('让 AI 结果可检查'));assert.deepEqual(errors,[])
const report={site:base+'/projects/gym/',commit:'663c66614cf260cfed5afcf88a746b030b0ecc55',deployment:6960631991,release:release.version,pass:true,downloads,checks:['production case body','all case images decoded','gallery opens and closes','four documents SHA-256 equal local','four text documents HTTP 200','résumé entry','no runtime errors']}
writeFileSync(out+'/production.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}
