import * as THREE from 'three'
import type { ArmPose, CompanionPose } from './types'

// Original procedural surfaces with internal shoulder / elbow pivots.
// +Y is up, +Z is forward, +X is anatomical left; units are scene units.
export const PANDA_RIG = Object.freeze({
  shoulderX: 0.70, shoulderY: 1.25,
  upperArmLength: 0.29, forearmLength: 0.25,
  shoulderMax: 2.60, elbowMax: 1.25, combinedMax: 2.95,
  headCenterY: 1.98, headRadiusX: 0.80, headRadiusY: 0.61, headRadiusZ: 0.51,
})
export interface PandaArm { shoulder: THREE.Group; elbow: THREE.Group; hand: THREE.Group }
export interface PandaRig {
  root: THREE.Group; torso: THREE.Group; head: THREE.Group
  left: PandaArm; right: PandaArm
  applyPose: (pose: CompanionPose) => void
  dispose: () => void
}
export function constrainPandaArm(arm: ArmPose): ArmPose {
  const shoulder = Number.isFinite(arm.shoulder) ? THREE.MathUtils.clamp(arm.shoulder, 0, PANDA_RIG.shoulderMax) : 0.10
  const elbow = Number.isFinite(arm.elbow) ? THREE.MathUtils.clamp(arm.elbow, 0, Math.min(PANDA_RIG.elbowMax, PANDA_RIG.combinedMax - shoulder)) : 0
  return { shoulder, elbow }
}
export function createPandaRig(): PandaRig {
  const root = new THREE.Group()
  root.name = 'panda-root'
  const torso = new THREE.Group()
  torso.name = 'torso'
  root.add(torso)
  const sphere = new THREE.SphereGeometry(1, 48, 32)
  const geometries = new Set<THREE.BufferGeometry>([sphere])
  const ramp = new THREE.DataTexture(new Uint8Array([174, 218, 255]), 3, 1, THREE.RedFormat)
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter
  ramp.generateMipmaps = false
  ramp.needsUpdate = true
  const material = (color: string) => new THREE.MeshToonMaterial({ color, gradientMap: ramp })
  const cream = material('#f4f1df'), charcoal = material('#343a37'), ink = material('#202723')
  const peach = material('#dba596'), innerEar = material('#252d29'), noseColor = material('#804638')
  const highlight = new THREE.MeshBasicMaterial({ color: '#fffaf0' })
  const outline = new THREE.MeshBasicMaterial({ color: '#625147', side: THREE.BackSide })
  const materials = [cream, charcoal, ink, peach, innerEar, noseColor, highlight, outline]
  const mesh = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, surface: THREE.Material, edged = false) => {
    const part = new THREE.Mesh(geometry, surface)
    part.name = name
    parent.add(part)
    if (edged) {
      const edge = new THREE.Mesh(geometry, outline)
      edge.name = name + '-outline'
      edge.scale.setScalar(1.015)
      part.add(edge)
    }
    return part
  }
  const ellipsoid = (parent: THREE.Object3D, name: string, surface: THREE.Material,
    position: [number, number, number], scale: [number, number, number], edged = false) => {
    const part = mesh(parent, name, sphere, surface, edged)
    part.position.set(...position)
    part.scale.set(...scale)
    return part
  }
  const stroke = (parent: THREE.Object3D, name: string, points: THREE.Vector3[], radius: number, surface = ink) => {
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 8, false)
    geometries.add(geometry)
    return mesh(parent, name, geometry, surface)
  }
  // The belly follows a broad pear-shaped torso instead of protruding as a ball.
  const bodyCurve = new THREE.CatmullRomCurve3([
    [0, 0.13], [0.50, 0.22], [0.78, 0.48], [0.86, 0.87],
    [0.83, 1.17], [0.69, 1.52], [0.50, 1.73], [0, 1.82],
  ].map(([radius, y]) => new THREE.Vector3(radius, y, 0)))
  const bodyProfile = bodyCurve.getPoints(80).map(p => new THREE.Vector2(p.x, p.y))
  const bodyGeometry = new THREE.LatheGeometry(bodyProfile, 64)
  bodyGeometry.scale(1, 1, 0.75)
  geometries.add(bodyGeometry)
  mesh(torso, 'body', bodyGeometry, charcoal, true)
  const bodyRadius = (y: number) => {
    for (let i = 1; i < bodyProfile.length; i++) {
      const a = bodyProfile[i - 1], b = bodyProfile[i]
      if (y >= a.y && y <= b.y) return THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y))
    }
    return 0
  }
  const bodySurface = (x: number, y: number) => Math.sqrt(Math.max(0, bodyRadius(y) ** 2 - x * x)) * 0.75
  // Conforming patches keep eyebrows, eye marks and blush above the face.
  const patch = (parent: THREE.Object3D, name: string, surface: THREE.Material,
    cx: number, cy: number, rx: number, ry: number, front: (x: number, y: number) => number, lift = 0.008, angle = 0) => {
    const positions: number[] = [], indices: number[] = []
    const rings = 12, sides = 48
    for (let ring = 0; ring <= rings; ring++) {
      for (let segment = 0; segment <= sides; segment++) {
        const theta = segment / sides * Math.PI * 2
        const u = ring / rings * rx * Math.cos(theta), v = ring / rings * ry * Math.sin(theta)
        const x = cx + u * Math.cos(angle) - v * Math.sin(angle)
        const y = cy + u * Math.sin(angle) + v * Math.cos(angle)
        positions.push(x, y, front(x, y) + lift)
        if (ring && segment) {
          const a = ring * (sides + 1) + segment, b = a - sides - 1
          indices.push(b - 1, a - 1, a, b - 1, a, b)
        }
      }
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    geometries.add(geometry)
    return mesh(parent, name, geometry, surface)
  }
  patch(torso, 'belly', cream, 0, 0.91, 0.75, 0.65, bodySurface)
  const tail = ellipsoid(torso, 'tail', cream, [0, 0.52, -0.57], [0.18, 0.18, 0.18])
  const feet: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const label = side === 1 ? 'left' : 'right'
    const foot = new THREE.Group()
    foot.name = label + '-hind-paw'
    foot.position.set(side * 0.46, 0.17, 0.10)
    foot.rotation.y = side * -0.12
    torso.add(foot); feet.push(foot)
    ellipsoid(foot, label + '-foot', charcoal, [0, 0, 0], [0.29, 0.17, 0.34], true)
    ellipsoid(foot, label + '-sole', cream, [0, -0.13, 0.10], [0.19, 0.035, 0.205])
  }
  const head = new THREE.Group()
  head.name = 'head'
  head.position.y = PANDA_RIG.headCenterY
  head.position.z = 0.32
  torso.add(head)
  const headGeometry = sphere.clone()
  const headPositions = headGeometry.getAttribute('position')
  for (let i = 0; i < headPositions.count; i++) {
    const y = headPositions.getY(i)
    headPositions.setXYZ(i, headPositions.getX(i) * PANDA_RIG.headRadiusX * (1 - 0.10 * y),
      y * PANDA_RIG.headRadiusY, headPositions.getZ(i) * PANDA_RIG.headRadiusZ)
  }
  headGeometry.computeVertexNormals()
  geometries.add(headGeometry)
  mesh(head, 'face', headGeometry, cream, true)
  const faceSurface = (x: number, y: number) => {
    const ny = y / PANDA_RIG.headRadiusY
    const nx = x / (PANDA_RIG.headRadiusX * (1 - 0.10 * ny))
    return PANDA_RIG.headRadiusZ * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
  }
  const eyeGroups: THREE.Group[] = [], ears: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    const label = side === 1 ? 'left' : 'right'
    ears.push(ellipsoid(head, label + '-ear', charcoal, [side * 0.57, 0.43, -0.035], [0.19, 0.205, 0.15], true))
    ellipsoid(head, label + '-ear-inner', innerEar, [side * 0.57, 0.43, 0.10], [0.115, 0.128, 0.02])
    patch(head, label + '-eye-patch', charcoal, side * 0.28, 0.025, 0.18, 0.193, faceSurface, 0.012, side * 0.38)
    const eye = new THREE.Group()
    eye.name = label + '-eye-animation'
    head.add(eye); eyeGroups.push(eye)
    patch(eye, label + '-eye-white', highlight, side * 0.277, 0.026, 0.103, 0.099, faceSurface, 0.025, side * 0.16)
    patch(eye, label + '-eye', ink, side * 0.263 - 0.018, 0.015, 0.047, 0.066, faceSurface, 0.035)
    patch(eye, label + '-eye-light', highlight, side * 0.263 - 0.029, 0.040, 0.014, 0.020, faceSurface, 0.044)
    patch(head, label + '-cheek', peach, side * 0.50, -0.18, 0.087, 0.037, faceSurface, 0.013)
    stroke(head, label + '-brow', [-1, -0.5, 0, 0.5, 1].map(t => {
      const x = side * 0.28 + t * 0.075, y = 0.228 + side * t * 0.021 + (side === -1 ? 0.045 : 0)
      return new THREE.Vector3(x, y, faceSurface(x, y) + 0.023)
    }), 0.018, charcoal)
  }
  ellipsoid(head, 'nose', noseColor, [0, -0.085, faceSurface(0, -0.085) + 0.016], [0.093, 0.047, 0.037])
  const openMouth = new THREE.Group()
  openMouth.name = 'open-smile'
  head.add(openMouth)
  patch(openMouth, 'mouth', ink, 0, -0.245, 0.126, 0.085, faceSurface, 0.018)
  patch(openMouth, 'tongue', peach, 0, -0.280, 0.090, 0.035, faceSurface, 0.027)
  stroke(openMouth, 'smile-corners', [[-0.14, -0.16], [-0.075, -0.19], [0, -0.178], [0.075, -0.19], [0.14, -0.16]]
    .map(([x, y]) => new THREE.Vector3(x, y, faceSurface(x, y) + 0.032)), 0.013)
  stroke(head, 'nose-stem', [-0.105, -0.13, -0.156].map(y => new THREE.Vector3(0, y, faceSurface(0, y) + 0.027)), 0.014)
  const smirk = stroke(head, 'smirk', [
    [-0.14, -0.205], [-0.065, -0.232], [0.02, -0.228], [0.095, -0.207], [0.15, -0.157],
  ].map(([x, y]) => new THREE.Vector3(x, y, faceSurface(x, y) + 0.032)), 0.015)
  const makeArm = (side: 1 | -1) => {
    const label = side === 1 ? 'left' : 'right'
    const shoulder = new THREE.Group()
    shoulder.name = label + '-shoulder'
    shoulder.position.set(side * PANDA_RIG.shoulderX, PANDA_RIG.shoulderY, -0.015)
    torso.add(shoulder)
    const elbow = new THREE.Group()
    elbow.name = label + '-elbow'
    elbow.position.y = -PANDA_RIG.upperArmLength
    shoulder.add(elbow)
    const hand = new THREE.Group()
    hand.name = label + '-hand'
    hand.position.y = -PANDA_RIG.forearmLength
    elbow.add(hand)
    // One continuous swept surface bends around the internal elbow.
    const longitudinal = 48, radial = 32
    const positions = new Float32Array((longitudinal + 1) * (radial + 1) * 3)
    const indices: number[] = []
    for (let row = 0; row < longitudinal; row++) for (let col = 0; col < radial; col++) {
      const a = row * (radial + 1) + col, b = a + radial + 1
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
    const armGeometry = new THREE.BufferGeometry()
    const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)
    armGeometry.setAttribute('position', attribute)
    armGeometry.setIndex(indices)
    geometries.add(armGeometry)
    const armMesh = mesh(shoulder, label + '-soft-arm', armGeometry, charcoal, true)
    armMesh.frustumCulled = false
    const armOutline = armMesh.children[0] as THREE.Mesh
    armOutline.frustumCulled = false
    const pads = new THREE.Group()
    pads.name = label + '-pads'
    hand.add(pads)
    ellipsoid(pads, label + '-paw-pad', innerEar, [0, -0.04, 0.178], [0.083, 0.07, 0.016])
    for (const toe of [-1, 0, 1]) ellipsoid(pads, label + '-paw-dot-' + toe, innerEar,
      [toe * 0.071, 0.059 + (toe === 0 ? 0.014 : 0), 0.170], [0.026, 0.030, 0.013])
    let previousElbow = NaN, previousShoulder = NaN, previousFold = NaN
    const deform = (shoulderAngle: number, angle: number, fold: number) => {
      if (angle === previousElbow && shoulderAngle === previousShoulder && fold === previousFold) return
      previousElbow = angle
      previousShoulder = shoulderAngle
      previousFold = fold
      const bend = side * angle
      const alongForearm = (distance: number) => new THREE.Vector3(Math.sin(bend) * distance, -PANDA_RIG.upperArmLength - Math.cos(bend) * distance, 0)
      // Keep the hidden sleeve root inside the torso as the arm rises. A cap
      // rotated with the shoulder can otherwise protrude as an armpit spike.
      const sleeveRoot = (inset: number, y: number) => new THREE.Vector3(-side * inset, y, 0)
        .applyQuaternion(shoulder.quaternion.clone().invert())
      const path = new THREE.CatmullRomCurve3([
        sleeveRoot(0.27, -0.03), sleeveRoot(0.12, 0),
        new THREE.Vector3(0, -PANDA_RIG.upperArmLength * 0.5, 0),
        new THREE.Vector3(0, -PANDA_RIG.upperArmLength, 0),
        alongForearm(PANDA_RIG.forearmLength * 0.55),
        alongForearm(PANDA_RIG.forearmLength + 0.07),
        alongForearm(PANDA_RIG.forearmLength + 0.19),
      ])
      const radius = (t: number) => {
        const cap = Math.min(1, Math.sqrt(Math.max(0, t / 0.16)), Math.sqrt(Math.max(0, (1 - t) / 0.13)))
        return THREE.MathUtils.lerp(0.225, 0.205, THREE.MathUtils.smoothstep(t, 0.15, 0.62)) * cap
      }
      const setRing = (array: Float32Array, row: number, t: number, lift: number) => {
        const center = path.getPoint(t), tangent = path.getTangent(t)
        const r = radius(t) + lift
        for (let col = 0; col <= radial; col++) {
          const theta = col / radial * Math.PI * 2, offset = (row * (radial + 1) + col) * 3
          array[offset] = center.x - tangent.y * Math.cos(theta) * r
          array[offset + 1] = center.y + tangent.x * Math.cos(theta) * r
          array[offset + 2] = center.z + Math.sin(theta) * r * 0.89
        }
      }
      for (let row = 0; row <= longitudinal; row++) setRing(positions, row, row / longitudinal, 0)
      attribute.needsUpdate = true
      armGeometry.computeVertexNormals()
      pads.visible = shoulderAngle > 0.8 && fold < 0.3
    }
    return { shoulder, elbow, hand, deform }
  }
  const left = makeArm(1), right = makeArm(-1)
  let disposed = false
  const rig: PandaRig = {
    root, torso, head, left, right,
    applyPose(pose) {
      const a = constrainPandaArm(pose.left), b = constrainPandaArm(pose.right)
      const m = pose.motion ?? {}
      const safe = (value: number | undefined, min: number, max: number, fallback = 0) => Number.isFinite(value) ? THREE.MathUtils.clamp(value!, min, max) : fallback
      const fold = safe(m.fold, 0, 1), stretch = safe(m.stretch, 0.80, 1.16, 1)
      root.position.set(safe(m.shift, -0.25, 0.25), safe(m.lift, 0, 0.5), 0)
      root.rotation.set(0, safe(m.turn, -0.4, 0.4), safe(m.lean, -0.24, 0.24))
      torso.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch))
      head.rotation.set(safe(m.nod, -0.22, 0.22), safe(m.headTurn, -0.3, 0.3), safe(m.headTilt, -0.24, 0.24))
      eyeGroups.forEach(eye => { const openness = 1 - safe(m.blink, 0, 0.96); eye.scale.y = openness; eye.position.y = 0.026 * (1 - openness) })
      openMouth.visible = safe(m.smile, 0, 1) > 0.42
      smirk.visible = !openMouth.visible
      ears.forEach((ear, i) => { ear.rotation.z = (i === 0 ? -1 : 1) * safe(m.earWiggle, -0.16, 0.16) })
      feet.forEach((foot, i) => {
        const lift = safe(i === 0 ? m.rightFoot : m.leftFoot, 0, 1)
        foot.position.y = 0.17 + lift * 0.10
        foot.rotation.x = -lift * 0.75
        const sole = foot.getObjectByName((i === 0 ? 'right' : 'left') + '-sole')
        if (sole) sole.visible = lift > 0.15
      })
      tail.position.x = -safe(m.lean, -0.24, 0.24) * 0.3
      left.shoulder.rotation.set(0, -fold * 2.75, a.shoulder, 'YXZ')
      left.elbow.rotation.z = a.elbow
      right.shoulder.rotation.set(0, fold * 2.75, -b.shoulder, 'YXZ')
      right.elbow.rotation.z = -b.elbow
      left.shoulder.position.z = -0.015 + fold * 0.49
      right.shoulder.position.z = -0.015 + fold * 0.44
      left.deform(a.shoulder, a.elbow, fold)
      right.deform(b.shoulder, b.elbow, fold)
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
