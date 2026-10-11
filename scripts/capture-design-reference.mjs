import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdirSync,writeFileSync } from 'node:fs'
const out='evals/visual-upgrade-2026-10-09'
mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,channel:'msedge'})
const page=await browser.newPage({viewport:{width:1200,height:1000}})
const results=[]
for(const [name,url] of [['ladder-records','https://ladderteams.imgix.net/website/phone/records_v1.png?w=1200'],['ladder-home','https://www.joinladder.com/']]){
  try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.screenshot({path:`${out}/reference-${name}.png`});results.push({name,url,title:await page.title()})}catch(e){results.push({name,error:e.message})}
}
writeFileSync(`${out}/references.json`,JSON.stringify(results,null,2))
console.log(results);await browser.close()
