import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const {parseWorkoutResponse}=await import('../src/lib/aiValidation.ts')
const source=process.argv[2];if(!source)throw new Error('Provide completed holdout run directory')
const run=JSON.parse(readFileSync(resolve(source,'run.json'),'utf8'))
if(run.suite!=='holdout'||!run.sourceUnchanged)throw new Error('Need a source-stable holdout run')
const cases=JSON.parse(readFileSync('evals/workout-save/v3/holdout.json','utf8')).cases
const {chromium}=await import(pathToFileURL(resolve(process.env.GYM_PLAYWRIGHT_PATH,'index.mjs')).href)
const browser=await chromium.launch({headless:true,channel:'msedge'})
const fixture=JSON.parse(readFileSync('docs/portfolio/fixtures/synthetic-demo-data.json','utf8'));fixture.dayLogs={};fixture.plans=[]
const out=`evals/workout-save/v3/results/replay-${Date.now()}`;mkdirSync(out,{recursive:true});const results=[]
for(const c of cases){
  const record={id:c.id,pass:false,source:resolve(source,`${c.id}-response.json`),kind:'real API response replay, scripted synthetic corrections, NOT human data'}
  const context=await browser.newContext({viewport:{width:820,height:1024},timezoneId:'Asia/Shanghai'})
  await context.addInitScript(data=>{if(!localStorage.getItem('gym-data-v1'))localStorage.setItem('gym-data-v1',JSON.stringify(data))},fixture)
  const page=await context.newPage();page.setDefaultTimeout(7000)
  try{
    const body=JSON.parse(readFileSync(record.source,'utf8'));const expected=parseWorkoutResponse(body)
    await page.route('**/api/parse-workout',r=>r.fulfill({json:body}))
    await page.goto('http://127.0.0.1:4173');await page.getByRole('button',{name:'训练',exact:true}).click()
    await page.locator('textarea').fill(c.text);await page.getByRole('button',{name:'解析',exact:true}).click();await page.getByText(/未保存预览/).waitFor()
    const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gym-data-v1')))
    if(c.done===false){
      assert.equal(await page.getByRole('button',{name:'请先检查内容',exact:true}).isDisabled(),true)
      assert.deepEqual((await read()).dayLogs,{})
      record.outcome='future remains unsaved'
    }else{
      let index=0;record.corrections=[]
      for(const e of expected.strength)for(const s of e.sets){
        if(s.weightState==='unknown'){
          const kg=40+index;record.corrections.push({set:index,field:'weight',kg,provenance:'predeclared software-test correction, not recovered user fact'})
          await page.getByLabel('重量状态',{exact:true}).nth(index).selectOption('known')
          await page.getByLabel('重量数值').fill(String(kg));await page.getByRole('button',{name:'确认重量',exact:true}).click()
          s.weightState='known';s.weight=kg
        }
        index++
      }
      await page.getByRole('button',{name:'确认写入',exact:true}).click();await page.getByText('AI 训练结果已写入',{exact:true}).waitFor()
      const saved=await read();const actual=Object.values(saved.dayLogs)[0]
      record.confirmed=JSON.parse(JSON.stringify(expected));record.persisted=actual
      assert.equal(actual.strength.length,expected.strength.length)
      expected.strength.forEach((e,i)=>{assert.equal(actual.strength[i].name,e.name);assert.deepEqual(actual.strength[i].sets,JSON.parse(JSON.stringify(e.sets)))})
      await page.reload();await page.getByRole('button',{name:'训练',exact:true}).click();assert.deepEqual(await read(),saved)
      record.outcome='confirmed values equal stored and reopened values'
    }
    record.pass=true
  }catch(e){record.error=e.message}
  await page.screenshot({path:`${out}/${c.id}.png`,fullPage:true});await context.close();results.push(record)
  console.log(JSON.stringify({id:c.id,pass:record.pass,error:record.error}))
  writeFileSync(`${out}/results.json`,JSON.stringify({sourceRun:source,results,passed:results.filter(r=>r.pass).length,total:cases.length},null,2))
}
await browser.close();console.log(out);if(results.some(r=>!r.pass))process.exitCode=1
