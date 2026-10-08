import { chromium } from 'file:///C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdirSync } from 'node:fs'
const out=`evals/virtual-companion/d-panda/interaction-preview-${Date.now()}`
mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,channel:'msedge'})
try {
 const context=await browser.newContext({viewport:{width:1200,height:1050},serviceWorkers:'block'})
 await context.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4175'&&!r.request().url().includes('/api/')?r.continue():r.abort())
 await context.addInitScript(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('test','NotAllowedError'))})
 const page=await context.newPage();await page.goto('http://127.0.0.1:4175/?companion-lab=1&review=mirror')
 await page.getByRole('button',{name:'播放抬手',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.gentle-play')?.disabled)
 for(const name of ['垂手','抬起途中','举高保持','回落途中']){await page.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(150);await page.locator('.interaction-plane').screenshot({path:`${out}/${name}.png`})}
 await page.screenshot({path:`${out}/page.png`,fullPage:true})
 console.log(out)
} finally {await browser.close()}
