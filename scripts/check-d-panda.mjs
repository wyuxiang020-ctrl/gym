import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const { dPose, D_ACTIONS, duration, mirrorFrame } = await import('../src/companion/dpanda/motion.ts')
const { layout } = await import('../src/companion/dpanda/layout.ts')
const { DPlayer } = await import('../src/companion/dpanda/player.ts')
const { D_EXPRESSIONS } = await import('../src/companion/dpanda/expressions.ts')
const { mapMirrorPose, MirrorPoseFilter } = await import('../src/companion/mirror/mapping.ts')
const out = `evals/virtual-companion/d-panda/software-${Date.now()}`
mkdirSync(out, { recursive: true })
const checks = [], motion = []
const test = (name, fn) => { try { fn(); checks.push({ name, pass: true }) } catch (e) { checks.push({ name, pass: false, error: e.stack }) } }
const near = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`)
const dist = (a, b) => Math.hypot(a.x-b.x, a.y-b.y)
for (const { id, duration: length } of D_ACTIONS) {
  test(`${id}: finite frames, reachable stage bounds, prop grip, continuous wrists at 120 Hz`, () => {
    let prev, maxWrist = 0, maxProp = 0, maxAt = 0
    for (let t = 0; t <= length; t += 1000/120) {
      const f = dPose(t, id), l = layout(f, 0)
      const points = [l.head, l.left.wrist, l.right.wrist, l.hat, l.bamboo]
      for (const p of points) { assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y)); assert.ok(p.x > 15 && p.x < 570 && p.y > 40 && p.y < 565, JSON.stringify({id,t,p})) }
      if (f.grip === 1 && f.bambooReach === 0) near(dist(l.right.wrist, l.hatGrip), 0)
      if (f.bamboo > 0) { near(f.bambooReach, 1); near(dist(l.bamboo,l.right.wrist), 0) }
      if (prev) {
        const step = Math.max(dist(l.left.wrist, prev.left.wrist), dist(l.right.wrist, prev.right.wrist), dist(l.left.elbow, prev.left.elbow), dist(l.right.elbow, prev.right.elbow))
        if (step > maxWrist) { maxWrist = step; maxAt = t }
        maxProp = Math.max(maxProp,dist(l.hat,prev.hat),dist(l.bamboo,prev.bamboo))
      }
      prev = l
    }
    motion.push({ id, maxWristPxPer120Hz: maxWrist, maxPropPxPer120Hz: maxProp, maxAt })
    assert.ok(maxWrist < 13, `${id}: wrist snap ${maxWrist} at ${maxAt}`)
    assert.ok(maxProp < 13, `${id}: prop snap ${maxProp}`)
  })
}
test('12 separately authored expressions', () => { assert.equal(D_EXPRESSIONS.length,12); assert.equal(new Set(D_EXPRESSIONS.map(e=>e.id)).size,12) })
test('single arm sample holds at mid and high, leaves opposite arm still', () => {
  for(const side of ['left','right']) {
    const other = side === 'left' ? 'right' : 'left'
    assert.deepEqual(dPose(3100,'raise',false,side).arms, dPose(3800,'raise',false,side).arms)
    assert.deepEqual(dPose(5800,'raise',false,side).arms, dPose(6700,'raise',false,side).arms)
    assert.deepEqual(dPose(5800,'raise',false,side).arms[other], dPose(0,'raise',false,side).arms[other])
  }
})
test('walk support paw does not slide, lifted paw changes contact', () => {
  for(const [side,start,end] of [[-1,3350,3950],[1,4350,4950],[-1,5350,5950],[1,6350,6950]]) {
    const x = t => layout(dPose(t,'walk'),0).feet.find(f=>f.side===side).x
    near(x(start),x(end))
    const f=dPose((start+end)/2,'walk'); near(side===1?f.footL:f.footR,0)
  }
})
test('jump has anticipation, airtime, absorption and a stationary endpoint; reduced has no flight', () => {
  assert.ok(dPose(650,'cheer').crouch>.8); assert.ok(dPose(1400,'cheer').lift>70)
  assert.ok(dPose(2020,'cheer').crouch>.8); near(dPose(3300,'cheer').lift,0)
  for(let t=0;t<=3300;t+=20) { near(dPose(t,'cheer',true).lift,0); near(dPose(t,'cheer',true).footL,0) }
})
test('pause freezes every part; request airborne must land before switching', () => {
  const p=new DPlayer();p.request('cheer',1000);p.pause(2350)
  assert.deepEqual(p.frame(2400),p.frame(5000));assert.ok(p.frame(5000).lift>70)
  p.request('hat',5000);assert.equal(p.action,'cheer');assert.equal(p.pending,'hat')
  assert.ok(p.frame(5300).lift>0);p.frame(7100);assert.equal(p.action,'hat')
})
test('seated end holds and requests stand up before another action', () => {
  const p=new DPlayer();p.request('rest',0);p.frame(4000);assert.equal(p.playing,false);near(p.frame(5000).sit,1)
  p.request('wave',5000);assert.equal(p.action,'rise');near(p.frame(5000).sit,1)
  p.frame(7200);assert.equal(p.action,'wave')
})
test('loop boundaries, reduced motion request in flight, reset clears pending work', () => {
  for(const {id,duration:len} of D_ACTIONS.filter(a=>!['rest','rise'].includes(a.id))) {
    const a=layout(dPose(0,id),0),b=layout(dPose(len,id),0)
    for(const key of ['left','right']) assert.ok(dist(a[key].wrist,b[key].wrist)<.01,id)
    for(const key of ['hat','bamboo','head']) assert.ok(dist(a[key],b[key])<.01,id)
  }
  const p=new DPlayer();p.request('cheer',0);p.setReduced(true,1300);assert.ok(p.frame(1300).lift>0)
  p.frame(3400);assert.equal(p.action,'idle');assert.equal(p.reduced,true)
  p.reset();assert.equal(p.pending,null)
})
test('mirror poses never trigger autonomous legs/body/props, and remain independent', () => {
  const arms={left:{shoulder:1.1,elbow:.2},right:{shoulder:.2,elbow:.1}}
  for(const t of [0,500,1000,6000]) {
    const f=mirrorFrame(arms,t,0);assert.deepEqual(f.arms,arms)
    for(const key of ['x','lift','crouch','twist','footL','footR','hat','bamboo','grip']) near(f[key],0)
  }
})
test('one missing chain holds, then rests slowly while valid arm keeps following; recovery uses current sample', () => {
  const filter=new MirrorPoseFilter(),high={left:{shoulder:2,elbow:.3},right:{shoulder:1.8,elbow:.2}},low={left:{shoulder:0,elbow:0},right:{shoulder:0,elbow:0}}
  let f;for(let t=0;t<=1000;t+=50)f=filter.apply(high,t)
  const held=f.right.shoulder
  for(let t=1050;t<=2000;t+=50)f=filter.apply(low,t,{left:true,right:false})
  near(f.right.shoulder,held);assert.ok(f.left.shoulder<.01)
  for(let t=2050;t<=4200;t+=50)f=filter.apply(low,t,{left:true,right:false})
  assert.ok(f.right.shoulder<.2)
  const recovered=filter.apply(high,4250);assert.ok(recovered.right.shoulder-f.right.shoulder<=.25)
})
test('partial mapper reports the correct screen side and does not trust occluded placeholders', () => {
  const points=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.99}))
  for(const [ids,x] of [[[11,13,15],.6],[[12,14,16],.4]])ids.forEach((id,i)=>points[id]={x,y:.3+i*.17,z:0,visibility:.99})
  points[15].visibility=.1
  const mapped=mapMirrorPose([points],640,480,1000,1050,true)
  assert.equal(mapped.ok,true);assert.deepEqual(mapped.valid,{left:true,right:false});assert.match(mapped.message,/画面左侧/)
  points[11].visibility=.1;assert.equal(mapMirrorPose([points],640,480,1000,1050,true).ok,false)
})
const files=['model','asset','expressions','layout','motion','render','player'].map(f=>`src/companion/dpanda/${f}.ts`)
const result={at:new Date().toISOString(),kind:'D_PANDA_SOFTWARE_SYNTHETIC_ONLY',realCamera:'NOT_RUN',realPhone:'NOT_RUN',checks,motion,source:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]))}
writeFileSync(`${out}/results.json`,JSON.stringify(result,null,2))
console.log(JSON.stringify({out,passed:checks.filter(c=>c.pass).length,total:checks.length,failed:checks.filter(c=>!c.pass),motion},null,2))
if(checks.some(c=>!c.pass))process.exitCode=1
