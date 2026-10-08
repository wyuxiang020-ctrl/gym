import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const out = `evals/virtual-companion/d-panda/art-review-${Date.now()}`
mkdirSync(out, { recursive: true })
const { chromium } = await import(pathToFileURL('C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ serviceWorkers: 'block' })
await context.route('**/*', r => new URL(r.request().url()).origin === 'http://127.0.0.1:4175' && !/api|companion-assets/.test(new URL(r.request().url()).pathname) ? r.continue() : r.abort())
try {
  const page = await context.newPage(); await page.goto('http://127.0.0.1:4175/?companion-lab=1')
  const result = await page.evaluate(async () => {
    const { drawDPanda } = await import('/src/companion/dpanda/render.ts')
    const { dPose } = await import('/src/companion/dpanda/motion.ts')
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1200
    const c = canvas.getContext('2d'); c.fillStyle = '#fbf8ef'; c.fillRect(0, 0, 1800, 1200)
    const states = [['idle',0,'front'],['hat',2800,'front'],['walk',5000,'right'],['cheer',630,'front'],['cheer',1350,'front'],['rest',3500,'front']]
    const audit=[]
    for(let i=0;i<states.length;i++){const [id,t,view]=states[i];c.save();c.translate(i%3*600,Math.floor(i/3)*600);audit.push(drawDPanda(c,dPose(t,id),view));c.restore();}
    return {png:canvas.toDataURL('image/png').split(',')[1],audit}
  })
  writeFileSync(`${out}/poses.png`,Buffer.from(result.png,'base64'));writeFileSync(`${out}/audit.json`,JSON.stringify(result.audit,null,2));console.log(out)
} finally { await context.close(); await browser.close() }
