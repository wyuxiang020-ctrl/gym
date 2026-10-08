import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import * as THREE from 'three'
const { createPandaRig, constrainPandaArm, PANDA_RIG } = await import('../src/companion/pandaRig.ts')

// Independent geometry checks only: no renderer, model, camera or personal data.
// Keep the original Stage 1 suite and its results unchanged.
const out = `evals/virtual-companion/v4-cartoon-revision/rig-${Date.now()}`
mkdirSync(out, { recursive: true })
writeFileSync(`${out}/runner-source.mjs`, readFileSync(new URL(import.meta.url)))
const sourceHashes = Object.fromEntries(['src/companion/pandaRig.ts', 'src/companion/types.ts', 'scripts/check-companion-cartoon-rig-v4.mjs'].map(path =>
  [path, createHash('sha256').update(readFileSync(path)).digest('hex')]))
const checks = []
const metrics = {}
const test = (name, run) => {
  try { run(); checks.push({ name, status: 'PASS' }) }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.stack }) }
}
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`)
const rest = () => ({ left: { shoulder: 0.10, elbow: 0 }, right: { shoulder: 0.10, elbow: 0 } })
const pose = (shoulder, elbow) => ({ left: { shoulder, elbow }, right: { shoulder, elbow } })
const world = part => part.getWorldPosition(new THREE.Vector3())

// Capture all BufferGeometry instances initialized by the generator, including
// geometries not attached to the object tree, rather than only visible meshes.
const allocatedGeometries = new Set()
const allocatedMaterials = new Set()
const originalSetAttribute = THREE.BufferGeometry.prototype.setAttribute
const originalSetValues = THREE.Material.prototype.setValues
THREE.BufferGeometry.prototype.setAttribute = function (...args) {
  allocatedGeometries.add(this)
  return originalSetAttribute.apply(this, args)
}
THREE.Material.prototype.setValues = function (...args) {
  allocatedMaterials.add(this)
  return originalSetValues.apply(this, args)
}
let rig
try { rig = createPandaRig() }
finally {
  THREE.BufferGeometry.prototype.setAttribute = originalSetAttribute
  THREE.Material.prototype.setValues = originalSetValues
}

test('Internal shoulder, elbow and hand hierarchy with continuous surface meshes', () => {
  const names = new Set()
  rig.root.traverse(node => {
    assert.ok(!names.has(node.name), `Duplicate object name: ${node.name}`)
    names.add(node.name)
    if (node.isMesh) {
      assert.ok(node.geometry.attributes.position.count > 0)
      assert.ok(['MeshToonMaterial', 'MeshBasicMaterial'].includes(node.material.type))
    }
  })
  for (const side of ['left', 'right']) {
    assert.equal(rig[side].shoulder.parent, rig.torso)
    assert.equal(rig[side].elbow.parent, rig[side].shoulder)
    assert.equal(rig[side].hand.parent, rig[side].elbow)
    const arm = rig.root.getObjectByName(`${side}-soft-arm`)
    assert.equal(arm.parent, rig[side].shoulder)
    assert.equal(arm.geometry.attributes.position.count, 49 * 33)
    assert.ok(arm.geometry.index.count > 0)
  }
  // One armband intentionally matches the reference; bilateral symmetry checks
  // below cover the actual arms, joint transforms and hands, not this accessory.
  assert.ok(rig.root.getObjectByName('left-sleeve-band'))
  assert.equal(rig.root.getObjectByName('right-sleeve-band'), undefined)
})

test('Shoulder propagation moves elbow and hand while the other arm and root stay fixed', () => {
  rig.applyPose(rest())
  const opposite = world(rig.right.hand)
  rig.applyPose({ left: { shoulder: Math.PI / 2, elbow: 0 }, right: rest().right })
  near(world(rig.left.elbow).x, PANDA_RIG.shoulderX + PANDA_RIG.upperArmLength)
  near(world(rig.left.elbow).y, PANDA_RIG.shoulderY)
  near(world(rig.left.hand).x, PANDA_RIG.shoulderX + PANDA_RIG.upperArmLength + PANDA_RIG.forearmLength)
  near(world(rig.left.hand).y, PANDA_RIG.shoulderY)
  near(world(rig.right.hand).distanceTo(opposite), 0)
  assert.deepEqual(rig.root.position.toArray(), [0, 0, 0])
  assert.deepEqual(rig.root.scale.toArray(), [1, 1, 1])
})

test('Elbow motion changes continuous geometry and moves only the distal pivot', () => {
  rig.applyPose(rest())
  const shoulder = world(rig.left.shoulder), elbow = world(rig.left.elbow), hand = world(rig.left.hand)
  const arm = rig.root.getObjectByName('left-soft-arm')
  const before = Float32Array.from(arm.geometry.attributes.position.array)
  const opposite = Float32Array.from(rig.root.getObjectByName('right-soft-arm').geometry.attributes.position.array)
  rig.applyPose({ left: { shoulder: 0.10, elbow: 0.9 }, right: rest().right })
  near(world(rig.left.shoulder).distanceTo(shoulder), 0)
  near(world(rig.left.elbow).distanceTo(elbow), 0)
  near(world(rig.left.hand).distanceTo(elbow), PANDA_RIG.forearmLength)
  assert.ok(world(rig.left.hand).distanceTo(hand) > 0.3)
  assert.notDeepEqual(arm.geometry.attributes.position.array, before)
  assert.deepEqual(rig.root.getObjectByName('right-soft-arm').geometry.attributes.position.array, opposite)
})

test('Finite input constraints preserve shoulder, elbow and combined bounds', () => {
  assert.deepEqual(constrainPandaArm({ shoulder: NaN, elbow: Infinity }), { shoulder: 0.10, elbow: 0 })
  assert.deepEqual(constrainPandaArm({ shoulder: -5, elbow: -5 }), { shoulder: 0, elbow: 0 })
  const extreme = constrainPandaArm({ shoulder: 100, elbow: 100 })
  near(extreme.shoulder, PANDA_RIG.shoulderMax)
  near(extreme.shoulder + extreme.elbow, PANDA_RIG.combinedMax)
})

test('Continuous arms, hand pivots and paw pads mirror around X=0', () => {
  const a = new THREE.Vector3(), b = new THREE.Vector3()
  let vertices = 0
  for (const shoulder of [0, 0.1, 0.8, Math.PI / 2, 2.1, 2.55, 2.6]) {
    for (const elbow of [0, 0.3, 0.7, 1.25]) {
      rig.applyPose(pose(shoulder, elbow))
      rig.root.updateMatrixWorld(true)
      for (const pivot of ['shoulder', 'elbow', 'hand']) {
        const left = world(rig.left[pivot]), right = world(rig.right[pivot])
        near(left.x, -right.x); near(left.y, right.y); near(left.z, right.z)
      }
      const left = rig.root.getObjectByName('left-soft-arm'), right = rig.root.getObjectByName('right-soft-arm')
      for (let row = 0; row <= 48; row++) {
        for (let col = 0; col < 32; col++) {
          // Mirrored radial angle is pi-theta: cos changes sign, sin does not.
          const mirrorCol = (16 - col + 32) % 32
          a.fromBufferAttribute(left.geometry.attributes.position, row * 33 + col).applyMatrix4(left.matrixWorld)
          b.fromBufferAttribute(right.geometry.attributes.position, row * 33 + mirrorCol).applyMatrix4(right.matrixWorld)
          near(a.x, -b.x, 2e-6); near(a.y, b.y, 2e-6); near(a.z, b.z, 2e-6)
          vertices++
        }
      }
      const leftPad = world(rig.root.getObjectByName('left-paw-pad')), rightPad = world(rig.root.getObjectByName('right-paw-pad'))
      near(leftPad.x, -rightPad.x); near(leftPad.y, rightPad.y); near(leftPad.z, rightPad.z)
    }
  }
  metrics.symmetryVertices = vertices
})

test('All deformed vertices and normals stay finite over the supported 0.05 radian grid', () => {
  let samples = 0, values = 0
  for (let si = 0; si <= Math.round(PANDA_RIG.shoulderMax / 0.05); si++) {
    for (let ei = 0; ei <= Math.round(PANDA_RIG.elbowMax / 0.05); ei++) {
      rig.applyPose(pose(si * 0.05, ei * 0.05))
      for (const name of ['left-soft-arm', 'right-soft-arm', 'left-sleeve-band']) {
        const geometry = rig.root.getObjectByName(name).geometry
        for (const attributeName of ['position', 'normal']) {
          const attribute = geometry.getAttribute(attributeName)
          assert.ok(attribute, `${name} lacks ${attributeName}`)
          for (const value of attribute.array) {
            assert.ok(Number.isFinite(value), `${name}.${attributeName} at ${si}, ${ei}`)
            values++
          }
        }
      }
      samples++
    }
  }
  metrics.finiteGrid = { shoulderStep: 0.05, elbowStep: 0.05, samples, values }
})

test('Soft arms, outlines, paw details and armband stay outside the new pear-shaped face', () => {
  const point = new THREE.Vector3()
  const headInverse = new THREE.Matrix4()
  const minima = {}
  let examined = 0, penetrations = 0
  const parts = []
  rig.root.traverse(node => {
    if (node.isMesh && /^(left|right)-(soft-arm|paw-pad|paw-dot-|sleeve-band)/.test(node.name)) parts.push(node)
  })
  assert.ok(parts.some(part => part.name === 'left-soft-arm-outline'))
  assert.ok(parts.some(part => part.name === 'left-sleeve-band'))
  for (let si = 0; si <= Math.round(PANDA_RIG.shoulderMax / 0.05); si++) {
    for (let ei = 0; ei <= Math.round(PANDA_RIG.elbowMax / 0.05); ei++) {
      const shoulder = si * 0.05, elbow = ei * 0.05
      rig.applyPose(pose(shoulder, elbow))
      rig.root.updateMatrixWorld(true)
      headInverse.copy(rig.head.matrixWorld).invert()
      for (const part of parts) {
        const vertices = part.geometry.attributes.position
        const matrix = headInverse.clone().multiply(part.matrixWorld)
        for (let i = 0; i < vertices.count; i++) {
          point.fromBufferAttribute(vertices, i).applyMatrix4(matrix)
          const ny = point.y / PANDA_RIG.headRadiusY
          const nx = point.x / (PANDA_RIG.headRadiusX * (1 - 0.10 * ny))
          const nz = point.z / PANDA_RIG.headRadiusZ
          const value = nx * nx + ny * ny + nz * nz
          assert.ok(Number.isFinite(value))
          if (!minima[part.name] || value < minima[part.name].normalizedDistanceSquared) {
            minima[part.name] = { normalizedDistanceSquared: value, shoulder, requestedElbow: elbow,
              appliedElbow: constrainPandaArm({ shoulder, elbow }).elbow, vertex: i, pointInHeadSpace: point.toArray() }
          }
          if (value < 1 - 1e-6) penetrations++
          examined++
        }
      }
    }
  }
  metrics.headClearance = { shape: 'pear sphere: x/(rx*(1-0.10*y/ry)), y/ry, z/rz', examined, penetrations, minima }
  assert.equal(penetrations, 0, `Found ${penetrations} sampled vertices within the pear-shaped face; see metrics.headClearance.minima`)
})

test('All static and animated geometry indices are valid and positions are finite', () => {
  for (const geometry of allocatedGeometries) {
    const position = geometry.getAttribute('position')
    assert.ok(position)
    for (const value of position.array) assert.ok(Number.isFinite(value))
    if (geometry.index) for (const index of geometry.index.array) assert.ok(Number.isInteger(index) && index >= 0 && index < position.count)
  }
  metrics.allocatedGeometries = allocatedGeometries.size
})

test('Allocated geometry, material and texture resources dispose exactly once', () => {
  const textures = new Set()
  for (const material of allocatedMaterials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
  const resources = new Set([...allocatedGeometries, ...allocatedMaterials, ...textures])
  const disposals = new Map()
  for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, (disposals.get(resource) ?? 0) + 1))
  const parent = new THREE.Group()
  parent.add(rig.root)
  rig.dispose(); rig.dispose()
  for (const resource of resources) assert.equal(disposals.get(resource), 1, `${resource.type || resource.constructor.name} ${resource.uuid} disposed incorrectly`)
  assert.equal(disposals.size, resources.size)
  assert.equal(rig.root.parent, null)
  assert.equal(rig.root.children.length, 0)
  metrics.disposal = { geometries: allocatedGeometries.size, materials: allocatedMaterials.size, textures: textures.size, total: resources.size, repeatedDisposeCalls: 2 }
})

const report = {
  version: 'v4-cartoon-revision', createdAt: new Date().toISOString(), sourceHashes,
  evidenceType: 'Deterministic independent geometry checks. No browser, camera or pose-model use. Face clearance samples arm vertices on a 0.05-radian pose grid against the intended pear surface; this is not an exhaustive continuous triangle-intersection proof.',
  passed: checks.filter(check => check.status === 'PASS').length, total: checks.length, checks, metrics,
}
writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ out, passed: report.passed, total: report.total, failures: checks.filter(check => check.status === 'FAIL'), metrics }, null, 2))
if (report.passed !== report.total) process.exitCode = 1
