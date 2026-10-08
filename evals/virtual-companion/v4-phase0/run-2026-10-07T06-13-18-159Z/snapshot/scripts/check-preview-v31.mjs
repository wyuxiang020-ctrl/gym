import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
if(!process.argv.includes('--live'))throw new Error('Requires --live for one protected real-model call')
const deployment='https://gym-hdfd4x6o6-yuxiang-wang-s-projects.vercel.app'
const out=`evals/workout-save/v3-1/preview-${Date.now()}`;mkdirSync(out,{recursive:true})
const sha=x=>createHash('sha256').update(x).digest('hex')
const secrets=Object.entries(process.env).filter(([k,v])=>/KEY|TOKEN|SECRET|SALT|ACCESS_CODE/.test(k)&&v?.length>5).map(([,v])=>v)
function redact(text){for(const secret of secrets)text=text.replaceAll(secret,'[REDACTED]');return text}
const records=[]
function persist(){writeFileSync(`${out}/results.partial.json`,JSON.stringify({deployment,at:new Date().toISOString(),records},null,2))}
function cli(args,input){return spawnSync(process.execPath,[resolve('node_modules/vercel/dist/vc.js'),...args],{input,encoding:'utf8',timeout:155000,maxBuffer:4*1024*1024})}
function request(path,{method='GET',body,authenticated=false}={}){
  const proxy=process.env.OPENAI_PROXY_URL||process.env.HTTPS_PROXY||process.env.HTTP_PROXY
  const config=[`request = ${JSON.stringify(method)}`,'header = "Content-Type: application/json"',...(proxy?[`proxy = ${JSON.stringify(proxy)}`]:[]),...(authenticated?[`header = ${JSON.stringify(`X-Gym-Access-Code: ${process.env.GYM_DEMO_ACCESS_CODE}`)}`]:[]),...(body?[`data = ${JSON.stringify(JSON.stringify(body))}`]:[])].join('\n')
  const started=Date.now();const r=cli(['curl',path,'--deployment',deployment,'--','--silent','--show-error','--include','--suppress-connect-headers','--max-time','120','--config','-','--write-out','\n__GYM_STATUS__%{http_code}'],config)
  const raw=r.stdout??'';const status=Number(raw.match(/__GYM_STATUS__(\d+)/)?.[1]??0)
  const headEnd=raw.lastIndexOf('\r\n\r\n')>=0?raw.indexOf('\r\n\r\n'):raw.indexOf('\n\n')
  const responseBody=(headEnd>=0?raw.slice(headEnd+(raw.includes('\r\n\r\n')?4:2)):raw).replace(/\n__GYM_STATUS__\d+\s*$/,'')
  const rateHeaders=Object.fromEntries(raw.split(/\r?\n/).filter(l=>/^x-(gym|ratelimit)-/i.test(l)).map(l=>{const i=l.indexOf(':');return [l.slice(0,i).toLowerCase(),l.slice(i+1).trim()]}))
  const row={path,method,authenticated,configuredProxy:Boolean(proxy),ms:Date.now()-started,status,cliExit:r.status,rateHeaders,stderr:redact(r.stderr??''),responseSha256:sha(responseBody)}
  if(r.error)row.error=redact(r.error.message)
  records.push(row);persist();return {row,body:responseBody}
}
for(const url of [deployment,'https://gym-iota-self.vercel.app']){
  const started=Date.now();const r=cli(['inspect',url]);const record={kind:'read-only deployment inspection',url,ms:Date.now()-started,exitCode:r.status,stdout:redact(r.stdout??''),stderr:redact(r.stderr??'')};records.push(record);persist()
}
const root=request('/');root.row.kind='protected static build verification'
try{
  assert.equal(root.row.status,200)
  const asset=root.body.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];assert.ok(asset)
  const js=request(asset);js.row.kind='protected static bundle verification';assert.equal(js.row.status,200)
  js.row.matchesLocalBuild=sha(js.body)===sha(readFileSync(`dist${asset}`));assert.equal(js.row.matchesLocalBuild,true)
  js.row.hasVersion=js.body.includes('保存恢复 V3.1');assert.equal(js.row.hasVersion,true)
  assert.ok(!secrets.some(s=>js.body.includes(s)));root.row.pass=true;js.row.pass=true
}catch(e){root.row.pass=false;root.row.error=e.message}
const noCode=request('/api/parse-workout',{method:'POST',body:{text:'合成授权保护检查'}});noCode.row.kind='access guard, no model expected';noCode.row.pass=noCode.row.status===401;noCode.row.body=redact(noCode.body);persist()
const {chromium}=await import(pathToFileURL(resolve(process.env.GYM_PLAYWRIGHT_PATH,'index.mjs')).href)
const browser=await chromium.launch({headless:true,channel:'msedge',slowMo:500})
for(const url of [deployment,'https://gym-iota-self.vercel.app']){
  const context=await browser.newContext();const page=await context.newPage();const record={kind:'anonymous browser availability',url,authenticated:false};const started=Date.now()
  try{const r=await page.goto(url,{timeout:25000,waitUntil:'domcontentloaded'});await page.locator('body').waitFor();record.status=r.status();record.finalOrigin=new URL(page.url()).origin;record.finalPath=new URL(page.url()).pathname;record.title=await page.title();record.visibleText=(await page.locator('body').innerText()).slice(0,700)}catch(e){record.error=redact(e.message)}
  record.ms=Date.now()-started;records.push(record);persist();await context.close()
}
const flow={kind:'automated live-model smoke with synthetic input; local production-equivalent UI, authenticated CLI transport to deployed Preview; NOT human test',input:'今天卧推50公斤完成两组，每组8次，然后快走15分钟。',modelAttempts:0,pass:false}
records.push(flow);persist()
if(!process.env.GYM_DEMO_ACCESS_CODE||process.env.GYM_DEMO_ACCESS_CODE==='[SENSITIVE]'||!root.row.pass){flow.error='Protected version or required credentials not verified; model call NOT_RUN'}else{
  const fixture=JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'));fixture.dayLogs={};fixture.plans=[]
  const context=await browser.newContext({viewport:{width:820,height:1024},timezoneId:'Asia/Shanghai',recordVideo:{dir:out,size:{width:820,height:1024}}})
  await context.addInitScript(data=>{if(!localStorage.getItem('gym-data-v1'))localStorage.setItem('gym-data-v1',JSON.stringify(data));document.addEventListener('DOMContentLoaded',()=>{const b=document.createElement('div');b.textContent='Gym V3.1 · 合成输入 / 真实 Preview 模型调用 · 自动化联调，非真人';Object.assign(b.style,{position:'fixed',top:'0',left:'0',zIndex:'100',background:'#164e63',color:'white',fontSize:'11px',padding:'4px',width:'100%'});document.body.append(b)})},fixture)
  const page=await context.newPage();page.setDefaultTimeout(130000);const started=Date.now()
  await page.route('**/api/parse-workout',async route=>{
    flow.modelAttempts++;assert.equal(flow.modelAttempts,1,'No automatic retries allowed')
    const result=request('/api/parse-workout',{method:'POST',body:route.request().postDataJSON(),authenticated:true});result.row.kind='real model request attempt';flow.request=result.row
    writeFileSync(`${out}/live-response.json`,redact(result.body),{flag:'wx'})
    try{const body=JSON.parse(result.body);flow.meta=body.meta;const u=body.meta?.usage;flow.usage=u??null;flow.estimatedCostUsd=u?((u.inputTokens-u.cachedInputTokens)*.25+u.cachedInputTokens*.025+u.outputTokens*2)/1e6:null;flow.pricing={source:'https://developers.openai.com/api/docs/models/gpt-5-mini',checked:'2026-10-01',input:.25,cached:.025,output:2,per:1000000,warning:'estimate, not invoice; absent usage means unknown cost'}}catch{}
    persist();await route.fulfill({status:result.row.status||502,contentType:'application/json',body:result.body||'{"error":"验证连接失败"}'})
  })
  try{
    await page.goto('http://127.0.0.1:4173');await page.getByRole('button',{name:'训练',exact:true}).click();await page.locator('textarea').fill(flow.input)
    await page.getByRole('button',{name:'解析',exact:true}).click();await page.getByText(/未保存预览/).waitFor()
    assert.equal(flow.request.status,200);assert.ok(flow.meta?.responseId);flow.firstPreview=JSON.parse(readFileSync(`${out}/live-response.json`,'utf8')).result
    const sets=flow.firstPreview.strength.flatMap(s=>s.sets);assert.equal(sets.length,2);assert.ok(sets.every(s=>s.weight===50&&s.weightState==='known'&&s.reps===8&&s.done===true));assert.equal(flow.firstPreview.cardio[0].minutes,15)
    await page.getByRole('button',{name:'50 kg · 修改',exact:true}).first().click();await page.getByLabel('重量数值').fill('110');await page.getByLabel('重量单位').selectOption('jin');await page.getByRole('button',{name:'确认重量',exact:true}).click();await page.getByPlaceholder('必填',{exact:true}).fill('18')
    await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByText('AI 训练结果已写入',{exact:true}).waitFor()
    flow.confirmedByScript={weights:[55,50],reps:[8,8],minutes:18};flow.saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym-data-v1')));const day=Object.values(flow.saved.dayLogs)[0];assert.deepEqual(day.strength[0].sets.map(s=>s.weight),[55,50]);assert.equal(day.cardio[0].minutes,18)
    await page.reload();await page.getByRole('button',{name:'训练',exact:true}).click();flow.reopened=await page.evaluate(()=>JSON.parse(localStorage.getItem('gym-data-v1')));assert.deepEqual(flow.reopened,flow.saved);flow.pass=true
  }catch(e){flow.error=redact(e.message)}
  flow.ms=Date.now()-started;await page.screenshot({path:`${out}/live-flow.png`,fullPage:true});const video=page.video();await context.close();flow.video=await video.path()
}
await browser.close();writeFileSync(`${out}/results.json`,JSON.stringify({deployment,at:new Date().toISOString(),records},null,2),{flag:'wx'});console.log(JSON.stringify({out,protectedBuildMatches:root.row.pass,accessGuard:noCode.row.pass,livePass:flow.pass,modelAttempts:flow.modelAttempts,usage:flow.usage,cost:flow.estimatedCostUsd,error:flow.error}));if(!flow.pass||!root.row.pass||!noCode.row.pass)process.exitCode=1
