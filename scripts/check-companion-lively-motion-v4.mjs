import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import * as THREE from 'three'
import { createPandaRig } from '../src/companion/pandaRig.ts'
import { CHARACTER_ACTIONS, characterPose } from '../src/companion/characterMotion.ts'
import { copyPose, REST_POSE } from '../src/companion/types.ts'

const out = `evals/virtual-companion/v4-lively/motion-${Date.now()}`
mkdirSync(out, { recursive: true })
const rig = createPandaRig(), tests = [], bounds = {}, rigSource = readFileSync('src/companion/pandaRig.ts')
const test = (name, fn) => { try { fn(); tests.push({ name, pass: true }) } catch (error) { tests.push({ name, pass: false, error: String(error.stack || error) }) } }
test('No human leg mesh, visible shoulder cap, or sleeve band', () => {
  for (const side of ['left', 'right']) {
    assert.equal(rig.root.getObjectByName(`${side}-leg`), undefined)
    assert.equal(rig.root.getObjectByName(`${side}-shoulder-cap`), undefined)
    assert.equal(rig.root.getObjectByName(`${side}-sleeve-band`), undefined)
    assert.ok(rig.root.getObjectByName(`${side}-hind-paw`))
  }
})
test('All six performances stay finite, use safe arm angles, and fit the camera throughout', () => {
  const camera = new THREE.OrthographicCamera(-1.85 * 426 / 420, 1.85 * 426 / 420, 1.85, -1.85, 0.1, 30)
  camera.position.set(0, 2, 7); camera.lookAt(0, 1.42, 0); camera.updateMatrixWorld()
  const point = new THREE.Vector3()
  for (const { id } of CHARACTER_ACTIONS) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (let time = 0; time <= 8000; time += 50) {
      const pose = characterPose(time, id)
      for (const arm of [pose.left, pose.right]) { assert.ok(arm.shoulder >= 0 && arm.shoulder <= 2.60); assert.ok(arm.elbow >= 0 && arm.elbow <= 1.25); assert.ok(arm.shoulder + arm.elbow <= 2.95) }
      rig.applyPose(pose); rig.root.updateMatrixWorld(true)
      rig.root.traverseVisible(node => {
        if (!node.isMesh) return
        const position = node.geometry.getAttribute('position')
        for (let i = 0; i < position.count; i += 3) {
          point.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld).project(camera)
          assert.ok(Number.isFinite(point.x + point.y + point.z), `${id} ${time} ${node.name}`)
          minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y)
        }
      })
    }
    bounds[id] = { minX, maxX, minY, maxY }
    assert.ok(minX > -0.98 && maxX < 0.98 && minY > -0.98 && maxY < 0.98, `${id} leaves canvas: ${JSON.stringify(bounds[id])}`)
  }
})
test('Preset secondary transforms fully reset when a mirror pose arrives', () => {
  rig.applyPose(characterPose(1400, 'hop'))
  assert.ok(rig.root.position.y > 0)
  rig.applyPose(copyPose(REST_POSE))
  assert.deepEqual(rig.root.position.toArray(), [0, 0, 0])
  assert.deepEqual(rig.torso.scale.toArray(), [1, 1, 1])
  assert.equal(rig.head.rotation.x + rig.head.rotation.y + rig.head.rotation.z, 0)
  assert.equal(Math.abs(rig.left.shoulder.rotation.y), 0); assert.equal(Math.abs(rig.right.shoulder.rotation.y), 0)
})
test('Idle loops continuously; each action includes a distinct secondary movement', () => {
  const a = characterPose(0, 'idle'), b = characterPose(8000, 'idle')
  for (const key of Object.keys(a.motion)) assert.ok(Math.abs(a.motion[key] - b.motion[key]) < 1e-9)
  assert.ok(characterPose(2100, 'idle').motion.blink > 0.9)
  assert.ok(characterPose(3000, 'fold').motion.fold > 0.9)
  assert.ok(characterPose(1400, 'hop').motion.lift > 0.25)
  assert.ok(Math.abs(characterPose(2300, 'shuffle').motion.shift) > 0.01)
  assert.notDeepEqual(characterPose(1700, 'wave').right, characterPose(2050, 'wave').right)
})
test('Invalid optional motion values cannot corrupt scene transforms', () => {
  rig.applyPose({ ...copyPose(REST_POSE), motion: { shift: NaN, lift: Infinity, stretch: -99, fold: NaN, blink: Infinity } })
  assert.ok([...rig.root.position.toArray(), ...rig.torso.scale.toArray()].every(Number.isFinite))
  assert.ok(rig.torso.scale.y >= 0.8)
})
rig.dispose(); rig.dispose()
const result = { at: new Date().toISOString(), sourceHash: createHash('sha256').update(rigSource).digest('hex'), tests, bounds, samples: '161 frames per action; every third visible vertex; engineering framing and finite-value check, not exhaustive collision proof', passed: tests.filter(t => t.pass).length, total: tests.length }
writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ out, passed: result.passed, total: result.total, failures: tests.filter(t => !t.pass), bounds }, null, 2))
if (result.passed !== result.total) process.exitCode = 1
