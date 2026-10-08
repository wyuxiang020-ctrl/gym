import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
const {chromium}=await import(pathToFileURL(resolve(process.env.GYM_PLAYWRIGHT_PATH,'index.mjs')).href)
const browser=await chromium.launch({headless:true,channel:'msedge'})
const records=[]
for(const url of ['https://gym-ri1ngrd2q-yuxiang-wang-s-projects.vercel.app','https://gym-iota-self.vercel.app']){
  const context=await browser.newContext();const page=await context.newPage();const record={url,at:new Date().toISOString(),authenticated:false}
  try{const response=await page.goto(url,{timeout:25000,waitUntil:'domcontentloaded'});record.status=response.status();record.finalOrigin=new URL(page.url()).origin;record.finalPath=new URL(page.url()).pathname;record.title=await page.title();record.visibleText=(await page.locator('body').innerText()).slice(0,700)}catch(e){record.error=e.message}
  records.push(record);await context.close()
}
await browser.close();mkdirSync('evals/workout-save/v3/results',{recursive:true});const path=`evals/workout-save/v3/results/deployment-${Date.now()}.json`;writeFileSync(path,JSON.stringify(records,null,2));console.log(JSON.stringify({path,records},null,2))
