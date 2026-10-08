import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const out=process.env.GYM_D_EVIDENCE_OUT || `evals/virtual-companion/d-panda/evidence-${Date.now()}`,base='http://127.0.0.1:4175'
mkdirSync(out,{recursive:true})
const {chromium}=await import(pathToFileURL('C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const browser=await chromium.launch({headless:true,channel:'msedge'})
const context=await browser.newContext({viewport:{width:640,height:680},serviceWorkers:'block'})
const errors=[];let cameras=0
await context.addInitScript(()=>{window.__camera=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>{window.__camera++;throw new Error('Camera forbidden in role-only evidence')}})})
await context.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===base&&r.request().method()==='GET'&&!u.pathname.startsWith('/api/')&&(!u.pathname.includes('companion-assets')||u.pathname.includes('/d-panda/design/'))?r.continue():r.abort()})
const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)))
try{
  await page.goto(`${base}/?companion-lab=1`);await page.locator('canvas').waitFor()
  const sheets=await page.evaluate(async()=>{
    const {drawDPanda}=await import('/src/companion/dpanda/render.ts'),{dPose,withExpression}=await import('/src/companion/dpanda/motion.ts'),{D_EXPRESSIONS}=await import('/src/companion/dpanda/expressions.ts')
    const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#fbf8ef';ctx.fillRect(0,0,w,h);return[c,ctx]}
    const label=(c,text,x,y,size=22)=>{c.fillStyle='#373333';c.font=`${size}px Microsoft YaHei`;c.fillText(text,x,y)}
    const boards={};for(const name of ['D2-character-accessories','D3-movement','D4-hand-interaction']){const i=new Image();i.src=`/companion-assets/d-panda/design/${name}.png`;await i.decode();boards[name]=i}
    const scenes=[
      ['自然站立','D2-character-accessories',[50,140,390,475],'idle',0,'right'],
      ['扶帽招呼','D2-character-accessories',[530,135,420,470],'hat',2800,'right'],
      ['持竹同行','D2-character-accessories',[1030,140,440,470],'walk',3100,'right'],
      ['压低蓄势','D3-movement',[55,210,450,300],'cheer',630,'right'],
      ['跃起欢呼','D3-movement',[575,130,415,370],'cheer',1350,'right'],
      ['柔软落地','D3-movement',[1040,235,440,265],'cheer',2020,'right'],
      ['抬爪中段','D4-hand-interaction',[700,155,300,310],'raise',3300,'front'],
      ['举高保持','D4-hand-interaction',[1220,145,280,320],'raise',6200,'front'],
      ['转身回望','D3-movement',[1100,545,380,350],'look',3300,'front'],
    ]
    const [comparison,cc]=make(1800,1500)
    for(let i=0;i<scenes.length;i++){
      const [name,board,crop,id,t,view]=scenes[i],x=i%3*600,y=Math.floor(i/3)*500
      label(cc,name,x+24,y+34);label(cc,'设计原稿',x+35,y+70,16);label(cc,'当前实际渲染',x+330,y+70,16)
      const [sx,sy,sw,sh]=crop,scale=Math.min(265/sw,330/sh)
      cc.drawImage(boards[board],sx,sy,sw,sh,x+15+(265-sw*scale)/2,y+100+(340-sh*scale)/2,sw*scale,sh*scale)
      cc.save();cc.beginPath();cc.rect(x+300,y+80,300,370);cc.clip();cc.translate(x+234,y+70);cc.scale(.72,.72);drawDPanda(cc,dPose(t,id),view);cc.restore()
      label(cc,`${id} · ${(t/1000).toFixed(2)} s`,x+330,y+475,14)
    }
    const [views,vc]=make(1800,380)
    for(const [i,v] of ['front','left','right','profile-left','profile-right','back'].entries()){vc.save();vc.translate(i*300,0);vc.scale(.5,.5);drawDPanda(vc,dPose(0,'idle'),v);vc.restore();label(vc,v,i*300+75,340,17)}
    const [faces,fc]=make(1600,1260)
    for(const [i,e] of D_EXPRESSIONS.entries()){
      fc.save();fc.beginPath();fc.rect(i%4*400,Math.floor(i/4)*420,400,360);fc.clip();fc.translate(i%4*400-100,Math.floor(i/4)*420-55);drawDPanda(fc,withExpression(dPose(0,'idle'),e.id),'front');fc.restore();label(fc,e.label,i%4*400+150,Math.floor(i/4)*420+395)
    }
    const [pixels,pc]=make(1400,510),frame=dPose(6200,'raise')
    for(const [i,size] of [600,128,96,64].entries()){
      const [small,sc]=make(size,size);sc.scale(size/600,size/600);drawDPanda(sc,frame,'front')
      pc.imageSmoothingEnabled=false;pc.drawImage(small,i*350,40,350,350);label(pc,size===600?'清晰':`${size} × ${size} 绘制缓冲`,i*350+30,450,18)
    }
    return Object.fromEntries(Object.entries({comparison,views,expressions:faces,'clear-pixel':pixels}).map(([k,c])=>[k,c.toDataURL('image/png').split(',')[1]]))
  })
  for(const [key,data]of Object.entries(sheets))writeFileSync(`${out}/${key}.png`,Buffer.from(data,'base64'))
  if(process.env.GYM_D_SHEETS_ONLY==='1'){console.log(`Updated unwarped review sheets: ${out}`)}else{
  // Record only the production renderer and its real-time clock, without camera/UI.
  await page.evaluate(async()=>{
    const {drawDPanda}=await import('/src/companion/dpanda/render.ts'),{dPose,duration}=await import('/src/companion/dpanda/motion.ts')
    document.body.innerHTML='';document.body.style.margin='0'
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=680;document.body.append(canvas)
    const c=canvas.getContext('2d');window.__record=async(playlist)=>{
      const stream=canvas.captureStream(30),chunks=[],rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3500000})
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)}
      const stopped=new Promise(resolve=>rec.onstop=resolve);rec.start()
      const render=(id,t)=>{c.setTransform(1,0,0,1,0,0);c.fillStyle='#fbf8ef';c.fillRect(0,0,640,680);c.save();c.translate(20,45);drawDPanda(c,dPose(t,id),'front');c.restore();c.fillStyle='#536344';c.font='18px Microsoft YaHei';c.fillText('D 熊猫 · 实际连续表演 · 正常速度',24,29);c.font='15px Microsoft YaHei';c.fillText(`${id} · ${(t/1000).toFixed(1)} s · 未开启摄像头`,24,662)}
      const timing=[]
      for(const id of playlist){const start=performance.now(),len=duration(id),intervals=[];let prev=start;await new Promise(resolve=>{const frame=now=>{intervals.push(now-prev);prev=now;render(id,Math.min(now-start,len));if(now-start<len)requestAnimationFrame(frame);else resolve()};requestAnimationFrame(frame)});timing.push({id,duration:performance.now()-start,frames:intervals.length,maxInterval:Math.max(...intervals)})}
      rec.stop();await stopped;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:'video/webm'})
      const data=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob)})
      return{data,timing}
    }
  })
  const clips={samples:['raise','hat','cheer'],library:['idle','removeHat','wave','walk','look','stretch','rest','rise','encourage','celebrate']},recordings={}
  for(const [name,list]of Object.entries(clips)){const result=await page.evaluate(list=>window.__record(list),list);writeFileSync(`${out}/${name}.webm`,Buffer.from(result.data,'base64'));recordings[name]=result.timing;console.log(`Recorded ${name}`)}
  cameras=await page.evaluate(()=>window.__camera)
  const files=['asset','model','layout','render','motion','expressions','player'].map(p=>`src/companion/dpanda/${p}.ts`)
  writeFileSync(`${out}/results.json`,JSON.stringify({at:new Date().toISOString(),out,recordings,errors,cameraCalls:cameras,kind:'ACTUAL_PRODUCTION_RENDERER_ROLE_ONLY_REAL_TIME_NO_CAMERA',source:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]))},null,2))
  console.log(out)
  }
}finally{await context.close();await browser.close()}
if(errors.length||cameras)process.exitCode=1
