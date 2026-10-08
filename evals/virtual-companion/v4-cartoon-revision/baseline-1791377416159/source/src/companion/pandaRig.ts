import * as THREE from 'three'
import type { ArmPose, CompanionPose } from './types'

// Original procedural segmented meshes; this is a joint hierarchy, not a skinned asset.
// World units are arbitrary. +Y is up, +Z is forward, +X is anatomical left.
export const PANDA_RIG = Object.freeze({
  shoulderX: 0.64,
  shoulderY: 1.79,
  upperArmLength: 0.48,
  forearmLength: 0.43,
  shoulderMax: 2.60,
  elbowMax: 1.25,
  combinedMax: 2.95,
  headCenterY: 2.30,
  headRadiusX: 0.62,
  headRadiusY: 0.55,
  headRadiusZ: 0.44,
})

export interface PandaArm {
  shoulder: THREE.Group
  elbow: THREE.Group
  hand: THREE.Group
}

export interface PandaRig {
  root: THREE.Group
  torso: THREE.Group
  head: THREE.Group
  left: PandaArm
  right: PandaArm
  applyPose: (pose: CompanionPose) => void
  dispose: () => void
}

export function constrainPandaArm(arm: ArmPose): ArmPose {
  const shoulder = Number.isFinite(arm.shoulder)
    ? THREE.MathUtils.clamp(arm.shoulder, 0, PANDA_RIG.shoulderMax) : 0.10
  const elbow = Number.isFinite(arm.elbow)
    ? THREE.MathUtils.clamp(arm.elbow, 0, Math.min(PANDA_RIG.elbowMax, PANDA_RIG.combinedMax - shoulder)) : 0
  return { shoulder, elbow }
}

export function createPandaRig(): PandaRig {
  const root = new THREE.Group()
  root.name = 'panda-root'
  const torso = new THREE.Group()
  torso.name = 'torso'
  root.add(torso)
  const sphere = new THREE.SphereGeometry(1, 24, 16)
  const geometries = new Set<THREE.BufferGeometry>([sphere])
  const ramp = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat)
  ramp.minFilter = THREE.NearestFilter
  ramp.magFilter = THREE.NearestFilter
  ramp.generateMipmaps = false
  ramp.needsUpdate = true
  const material = (color: string) => new THREE.MeshToonMaterial({ color, gradientMap: ramp })
  const cream = material('#f5f2e8')
  const charcoal = material('#353537')
  const forearmInk = material('#3c3c3d')
  const ink = material('#242527')
  const sage = material('#8b9b79')
  const peach = material('#efa88d')
  const innerEar = material('#535052')
  const materials = [cream, charcoal, forearmInk, ink, sage, peach, innerEar]

  const ellipsoid = (
    parent: THREE.Object3D, name: string, surface: THREE.Material,
    position: [number, number, number], scale: [number, number, number],
  ) => {
    const mesh = new THREE.Mesh(sphere, surface)
    mesh.name = name
    mesh.position.set(...position)
    mesh.scale.set(...scale)
    parent.add(mesh)
    return mesh
  }

  ellipsoid(torso, 'body', charcoal, [0, 1.12, 0], [0.57, 0.68, 0.385])
  ellipsoid(torso, 'belly', cream, [0, 1.12, 0.270], [0.49, 0.555, 0.18])
  ellipsoid(torso, 'neck', charcoal, [0, 1.78, 0], [0.315, 0.17, 0.28])
  ellipsoid(torso, 'shoulder-yoke', charcoal, [0, 1.65, -0.055], [0.64, 0.20, 0.18])
  ellipsoid(torso, 'tail', cream, [0, 0.77, -0.36], [0.14, 0.145, 0.14])
  for (const side of [-1, 1]) {
    const label = side === 1 ? 'left' : 'right'
    ellipsoid(torso, `${label}-leg`, charcoal, [side * 0.26, 0.40, 0], [0.20, 0.30, 0.21])
    ellipsoid(torso, `${label}-foot`, charcoal, [side * 0.28, 0.17, 0.105], [0.235, 0.165, 0.31])
  }

  const head = new THREE.Group()
  head.name = 'head'
  head.position.y = PANDA_RIG.headCenterY
  torso.add(head)
  ellipsoid(head, 'face', cream, [0, 0, 0], [PANDA_RIG.headRadiusX, PANDA_RIG.headRadiusY, PANDA_RIG.headRadiusZ])
  for (const side of [-1, 1]) {
    const label = side === 1 ? 'left' : 'right'
    ellipsoid(head, `${label}-ear`, charcoal, [side * 0.41, 0.40, -0.015], [0.17, 0.18, 0.13])
    ellipsoid(head, `${label}-ear-inner`, innerEar, [side * 0.41, 0.405, 0.095], [0.102, 0.112, 0.028])
    const patch = ellipsoid(head, `${label}-eye-patch`, charcoal, [side * 0.217, 0.025, 0.393], [0.12, 0.159, 0.051])
    patch.rotation.z = side * 0.19
    ellipsoid(head, `${label}-eye`, ink, [side * 0.20, 0.027, 0.44], [0.049, 0.069, 0.020])
    ellipsoid(head, `${label}-eye-light`, cream, [side * 0.20 - 0.009, 0.050, 0.458], [0.017, 0.026, 0.009])
    ellipsoid(head, `${label}-cheek`, peach, [side * 0.335, -0.12, 0.351], [0.092, 0.044, 0.025])
    ellipsoid(head, `${label}-muzzle`, cream, [side * 0.069, -0.133, 0.414], [0.12, 0.085, 0.054])
    const brow = ellipsoid(head, `${label}-brow`, charcoal, [side * 0.205, 0.228, 0.34], [0.049, 0.017, 0.013])
    brow.rotation.z = side * -0.2
  }
  ellipsoid(head, 'nose', ink, [0, -0.071, 0.465], [0.061, 0.039, 0.033])
  ellipsoid(head, 'mouth', ink, [0, -0.195, 0.425], [0.058, 0.059, 0.028])
  ellipsoid(head, 'tongue', peach, [0, -0.213, 0.449], [0.038, 0.027, 0.009])
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.077, -0.129, 0.468),
    new THREE.Vector3(-0.046, -0.149, 0.477),
    new THREE.Vector3(0, -0.134, 0.481),
    new THREE.Vector3(0.046, -0.149, 0.477),
    new THREE.Vector3(0.077, -0.129, 0.468),
  ])
  const smileGeometry = new THREE.TubeGeometry(smileCurve, 16, 0.011, 6, false)
  geometries.add(smileGeometry)
  const smile = new THREE.Mesh(smileGeometry, ink)
  smile.name = 'smile'
  head.add(smile)
  // Keep the face layout with the wider silhouette, rather than shrinking its eyes.
  for (const feature of head.children) {
    if (feature.name === 'face') continue
    feature.position.x *= PANDA_RIG.headRadiusX / 0.55
    feature.scale.x *= PANDA_RIG.headRadiusX / 0.55
  }

  const makeArm = (side: 1 | -1): PandaArm => {
    const label = side === 1 ? 'left' : 'right'
    const shoulder = new THREE.Group()
    shoulder.name = `${label}-shoulder`
    shoulder.position.set(side * PANDA_RIG.shoulderX, PANDA_RIG.shoulderY, 0)
    torso.add(shoulder)
    ellipsoid(shoulder, `${label}-shoulder-cap`, charcoal, [0, 0, 0], [0.145, 0.15, 0.15])
    ellipsoid(shoulder, `${label}-upper-arm`, charcoal, [0, -PANDA_RIG.upperArmLength / 2, 0], [0.142, PANDA_RIG.upperArmLength / 2 + 0.065, 0.145])
    const elbow = new THREE.Group()
    elbow.name = `${label}-elbow`
    elbow.position.y = -PANDA_RIG.upperArmLength
    shoulder.add(elbow)
    ellipsoid(elbow, `${label}-elbow-joint`, forearmInk, [0, 0, 0], [0.127, 0.13, 0.13])
    ellipsoid(elbow, `${label}-forearm`, forearmInk, [0, -PANDA_RIG.forearmLength / 2, 0], [0.123, PANDA_RIG.forearmLength / 2 + 0.048, 0.13])
    const cuffGeometry = new THREE.CylinderGeometry(0.129, 0.127, 0.09, 24)
    geometries.add(cuffGeometry)
    const cuff = new THREE.Mesh(cuffGeometry, sage)
    cuff.name = `${label}-wristband`
    cuff.position.y = -PANDA_RIG.forearmLength + 0.053
    elbow.add(cuff)
    const hand = new THREE.Group()
    hand.name = `${label}-hand`
    hand.position.y = -PANDA_RIG.forearmLength
    elbow.add(hand)
    ellipsoid(hand, `${label}-palm`, charcoal, [0, -0.095, 0.01], [0.151, 0.178, 0.137])
    ellipsoid(hand, `${label}-paw-pad`, peach, [0, -0.115, 0.135], [0.060, 0.066, 0.012])
    for (const toe of [-1, 0, 1]) {
      ellipsoid(hand, `${label}-paw-dot-${toe}`, peach, [toe * 0.058, -0.026, 0.132], [0.020, 0.025, 0.009])
    }
    return { shoulder, elbow, hand }
  }
  const left = makeArm(1)
  const right = makeArm(-1)
  let disposed = false
  const rig: PandaRig = {
    root, torso, head, left, right,
    applyPose(pose) {
      const leftPose = constrainPandaArm(pose.left)
      const rightPose = constrainPandaArm(pose.right)
      left.shoulder.rotation.z = leftPose.shoulder
      left.elbow.rotation.z = leftPose.elbow
      right.shoulder.rotation.z = -rightPose.shoulder
      right.elbow.rotation.z = -rightPose.elbow
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const geometry of geometries) geometry.dispose()
      for (const surface of materials) surface.dispose()
      ramp.dispose()
      root.removeFromParent()
      root.clear()
    },
  }
  rig.applyPose({ left: { shoulder: 0.10, elbow: 0 }, right: { shoulder: 0.10, elbow: 0 } })
  return rig
}
