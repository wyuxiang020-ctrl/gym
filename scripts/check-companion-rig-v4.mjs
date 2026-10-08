import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createPandaRig, constrainPandaArm, PANDA_RIG } from '../src/companion/pandaRig.ts'

const results = []
const rig = createPandaRig()
const neutral = () => ({ left: { shoulder: 0.10, elbow: 0 }, right: { shoulder: 0.10, elbow: 0 } })
const world = (part) => part.getWorldPosition(new THREE.Vector3())
const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-8, `${value} != ${expected}`)
const check = (name, run) => {
  try { run(); results.push({ name, status: 'PASS' }) }
  catch (error) { results.push({ name, status: 'FAIL', reason: String(error) }) }
}

check('Native segmented meshes and shoulder-elbow-hand hierarchy', () => {
  assert.equal(rig.root.name, 'panda-root')
  assert.equal(rig.left.shoulder.parent, rig.torso)
  assert.equal(rig.right.shoulder.parent, rig.torso)
  assert.equal(rig.left.elbow.parent, rig.left.shoulder)
  assert.equal(rig.right.elbow.parent, rig.right.shoulder)
  assert.equal(rig.left.hand.parent, rig.left.elbow)
  assert.equal(rig.right.hand.parent, rig.right.elbow)
  const names = new Set()
  let meshes = 0
  rig.root.traverse((node) => {
    assert.ok(!names.has(node.name), `duplicate node name ${node.name}`)
    names.add(node.name)
    if (node.isMesh) {
      meshes += 1
      assert.equal(node.material.type, 'MeshToonMaterial')
      assert.ok(node.geometry.attributes.position.count > 0)
      assert.equal(node.isSkinnedMesh, undefined)
    }
  })
  assert.ok(meshes >= 30)
})

check('A shoulder rotation moves its forearm without moving the root or the other arm', () => {
  rig.applyPose(neutral())
  const rightBefore = world(rig.right.hand)
  const leftBefore = world(rig.left.hand)
  rig.applyPose({ left: { shoulder: Math.PI / 2, elbow: 0 }, right: neutral().right })
  near(world(rig.left.hand).x, PANDA_RIG.shoulderX + PANDA_RIG.upperArmLength + PANDA_RIG.forearmLength)
  near(world(rig.left.hand).y, PANDA_RIG.shoulderY)
  assert.ok(world(rig.left.hand).distanceTo(leftBefore) > 1)
  near(world(rig.right.hand).distanceTo(rightBefore), 0)
  assert.deepEqual(rig.root.position.toArray(), [0, 0, 0])
  assert.deepEqual(rig.root.scale.toArray(), [1, 1, 1])
})

check('Elbow flexion is local: shoulder and elbow pivots remain fixed', () => {
  rig.applyPose(neutral())
  const shoulderBefore = world(rig.left.shoulder)
  const elbowBefore = world(rig.left.elbow)
  const handBefore = world(rig.left.hand)
  rig.applyPose({ left: { shoulder: 0.10, elbow: 0.9 }, right: neutral().right })
  near(world(rig.left.shoulder).distanceTo(shoulderBefore), 0)
  near(world(rig.left.elbow).distanceTo(elbowBefore), 0)
  assert.ok(world(rig.left.hand).distanceTo(handBefore) > 0.3)
  near(world(rig.left.hand).distanceTo(world(rig.left.elbow)), PANDA_RIG.forearmLength)
})

check('Anatomical left and right are symmetric around X=0', () => {
  for (const shoulder of [0, 0.10, 0.8, 1.57, 2.1, 2.55]) {
    rig.applyPose({ left: { shoulder, elbow: 0.3 }, right: { shoulder, elbow: 0.3 } })
    const left = world(rig.left.hand)
    const right = world(rig.right.hand)
    near(left.x, -right.x)
    near(left.y, right.y)
    near(left.z, right.z)
  }
})

check('Invalid or extreme input stays finite and respects the combined angle envelope', () => {
  const safe = constrainPandaArm({ shoulder: NaN, elbow: Infinity })
  assert.deepEqual(safe, { shoulder: 0.10, elbow: 0 })
  const high = constrainPandaArm({ shoulder: 99, elbow: 99 })
  near(high.shoulder, PANDA_RIG.shoulderMax)
  near(high.shoulder + high.elbow, PANDA_RIG.combinedMax)
  assert.deepEqual(constrainPandaArm({ shoulder: -100, elbow: -100 }), { shoulder: 0, elbow: 0 })
})

check('No upper arm, forearm or palm vertex enters the head ellipsoid across the supported envelope', () => {
  let examined = 0
  const point = new THREE.Vector3()
  const headCenter = world(rig.head)
  for (let shoulder = 0; shoulder <= PANDA_RIG.shoulderMax + 0.001; shoulder += 0.05) {
    for (let elbow = 0; elbow <= PANDA_RIG.elbowMax + 0.001; elbow += 0.05) {
      rig.applyPose({ left: { shoulder, elbow }, right: { shoulder, elbow } })
      rig.root.updateMatrixWorld(true)
      for (const side of ['left', 'right']) {
        for (const part of ['upper-arm', 'forearm', 'palm']) {
          const mesh = rig.root.getObjectByName(`${side}-${part}`)
          const vertices = mesh.geometry.attributes.position
          for (let i = 0; i < vertices.count; i++) {
            point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).sub(headCenter)
            const ellipsoidDistance = (point.x / PANDA_RIG.headRadiusX) ** 2
              + (point.y / PANDA_RIG.headRadiusY) ** 2 + (point.z / PANDA_RIG.headRadiusZ) ** 2
            assert.ok(ellipsoidDistance >= 1, `${side}-${part} enters head at shoulder=${shoulder}, elbow=${elbow}`)
            examined += 1
          }
        }
      }
    }
  }
  assert.ok(examined > 1000000)
})

check('Shared geometries, materials and toon texture are disposed once even on repeated cleanup', () => {
  const resources = new Set()
  rig.root.traverse((node) => {
    if (!node.isMesh) return
    resources.add(node.geometry)
    resources.add(node.material)
    resources.add(node.material.gradientMap)
  })
  const disposals = new Map()
  for (const resource of resources) {
    resource.addEventListener('dispose', () => disposals.set(resource, (disposals.get(resource) ?? 0) + 1))
  }
  rig.dispose()
  rig.dispose()
  assert.equal(disposals.size, resources.size)
  for (const count of disposals.values()) assert.equal(count, 1)
  assert.equal(rig.root.children.length, 0)
})

console.log(JSON.stringify({
  evidence: 'Deterministic software checks of original segmented mesh generator; no camera, pose model or visual rendering',
  passed: results.filter((result) => result.status === 'PASS').length,
  total: results.length,
  results,
}, null, 2))
if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1
