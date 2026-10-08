import * as THREE from 'three'
import type { ArmPose, CompanionPose } from './types'

// Original procedural surfaces with internal shoulder / elbow pivots.
// +Y is up, +Z is forward, +X is anatomical left; units are scene units.
export const PANDA_RIG = Object.freeze({
  shoulderX: 0.84, shoulderY: 1.60,
  upperArmLength: 0.43, forearmLength: 0.38,
  shoulderMax: 2.60, elbowMax: 1.25, combinedMax: 2.95,
  headCenterY: 2.25, headRadiusX: 0.86, headRadiusY: 0.65, headRadiusZ: 0.47,
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
  const cream = material('#fff7eb'), charcoal = material('#3d3733'), ink = material('#251e1a')
  const sage = material('#8b9b77'), peach = material('#ffa98c'), innerEar = material('#302824')
  const highlight = new THREE.MeshBasicMaterial({ color: '#fffaf0' })
  const outline = new THREE.MeshBasicMaterial({ color: '#625147', side: THREE.BackSide })
  const materials = [cream, charcoal, ink, sage, peach, innerEar, highlight, outline]
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
    [0, 0.29], [0.46, 0.35], [0.71, 0.57], [0.81, 0.90],
    [0.79, 1.22], [0.71, 1.50], [0.66, 1.66], [0.46, 1.76], [0, 1.79],
  ].map(([radius, y]) => new THREE.Vector3(radius, y, 0)))
  const bodyProfile = bodyCurve.getPoints(80).map(p => new THREE.Vector2(p.x, p.y))
  const bodyGeometry = new THREE.LatheGeometry(bodyProfile, 64)
  bodyGeometry.scale(1, 1, 0.64)
  geometries.add(bodyGeometry)
  mesh(torso, 'body', bodyGeometry, charcoal, true)
  const bodyRadius = (y: number) => {
    for (let i = 1; i < bodyProfile.length; i++) {
      const a = bodyProfile[i - 1], b = bodyProfile[i]
      if (y >= a.y && y <= b.y) return THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y))
    }
    return 0
  }
  const bodySurface = (x: number, y: number) => Math.sqrt(Math.max(0, bodyRadius(y) ** 2 - x * x)) * 0.64
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
  patch(torso, 'belly', cream, 0, 0.96, 0.69, 0.53, bodySurface)
  ellipsoid(torso, 'tail', cream, [0, 0.61, -0.44], [0.15, 0.15, 0.15])
  for (const side of [-1, 1]) {
    const label = side === 1 ? 'left' : 'right'
    ellipsoid(torso, label + '-leg', charcoal, [side * 0.39, 0.35, -0.01], [0.235, 0.33, 0.235], true)
    ellipsoid(torso, label + '-foot', charcoal, [side * 0.42, 0.145, 0.125], [0.265, 0.145, 0.32], true)
    for (const toe of [-1, 1]) stroke(torso, label + '-toe-' + toe, [
      new THREE.Vector3(side * 0.42 + toe * 0.073, 0.10, 0.415),
      new THREE.Vector3(side * 0.42 + toe * 0.073, 0.16, 0.429),
      new THREE.Vector3(side * 0.42 + toe * 0.073, 0.205, 0.394),
    ], 0.009)
  }
  const head = new THREE.Group()
  head.name = 'head'
  head.position.y = PANDA_RIG.headCenterY
  head.position.z = 0.28
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
  for (const side of [-1, 1]) {
    const label = side === 1 ? 'left' : 'right'
    ellipsoid(head, label + '-ear', charcoal, [side * 0.56, 0.49, -0.055], [0.255, 0.265, 0.14], true)
    ellipsoid(head, label + '-ear-inner', innerEar, [side * 0.56, 0.49, 0.067], [0.163, 0.176, 0.024])
    patch(head, label + '-eye-patch', charcoal, side * 0.30, 0.015, 0.173, 0.205, faceSurface, 0.012, side * 0.29)
    patch(head, label + '-eye', ink, side * 0.282, 0.038, 0.067, 0.097, faceSurface, 0.023)
    patch(head, label + '-eye-light', highlight, side * 0.282 - 0.010, 0.072, 0.022, 0.032, faceSurface, 0.032)
    patch(head, label + '-cheek', peach, side * 0.535, -0.205, 0.123, 0.075, faceSurface, 0.013)
    stroke(head, label + '-brow', [-1, -0.5, 0, 0.5, 1].map(t => {
      const x = side * 0.32 + t * 0.049, y = 0.322 + (1 - t * t) * 0.022
      return new THREE.Vector3(x, y, faceSurface(x, y) + 0.023)
    }), 0.015, charcoal)
  }
  ellipsoid(head, 'nose', ink, [0, -0.085, faceSurface(0, -0.085) + 0.016], [0.077, 0.041, 0.024])
  patch(head, 'mouth', ink, 0, -0.269, 0.105, 0.121, faceSurface, 0.018)
  patch(head, 'tongue', peach, 0, -0.297, 0.075, 0.075, faceSurface, 0.027)
  stroke(head, 'nose-stem', [-0.105, -0.13, -0.156].map(y => new THREE.Vector3(0, y, faceSurface(0, y) + 0.027)), 0.014)
  stroke(head, 'smile', [
    [-0.15, -0.143], [-0.115, -0.186], [-0.06, -0.185], [0, -0.153],
    [0.06, -0.185], [0.115, -0.186], [0.15, -0.143],
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
    const bandGeometry = new THREE.BufferGeometry()
    const bandPositions = new Float32Array(5 * (radial + 1) * 3)
    const bandIndices: number[] = []
    for (let row = 0; row < 4; row++) for (let col = 0; col < radial; col++) {
      const a = row * (radial + 1) + col, b = a + radial + 1
      bandIndices.push(a, a + 1, b, b, a + 1, b + 1)
    }
    bandGeometry.setAttribute('position', new THREE.BufferAttribute(bandPositions, 3).setUsage(THREE.DynamicDrawUsage))
    bandGeometry.setIndex(bandIndices)
    geometries.add(bandGeometry)
    if (side === 1) mesh(shoulder, label + '-sleeve-band', bandGeometry, sage).frustumCulled = false
    ellipsoid(hand, label + '-paw-pad', peach, [0, -0.058, 0.195], [0.079, 0.073, 0.014])
    for (const toe of [-1, 0, 1]) ellipsoid(hand, label + '-paw-dot-' + toe, peach,
      [toe * 0.087, 0.064 + (toe === 0 ? 0.014 : 0), 0.179], [0.030, 0.039, 0.013])
    let previousElbow = NaN, previousShoulder = NaN
    const deform = (shoulderAngle: number, angle: number) => {
      if (angle === previousElbow && shoulderAngle === previousShoulder) return
      previousElbow = angle
      previousShoulder = shoulderAngle
      const bend = side * angle
      const alongForearm = (distance: number) => new THREE.Vector3(Math.sin(bend) * distance, -PANDA_RIG.upperArmLength - Math.cos(bend) * distance, 0)
      // Keep the hidden sleeve root inside the torso as the arm rises. A cap
      // rotated with the shoulder can otherwise protrude as an armpit spike.
      const sleeveRoot = (inset: number, y: number) => new THREE.Vector3(-side * inset, y, 0)
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), -side * shoulderAngle)
      const path = new THREE.CatmullRomCurve3([
        sleeveRoot(0.27, -0.03), sleeveRoot(0.12, 0),
        new THREE.Vector3(0, -PANDA_RIG.upperArmLength * 0.5, 0),
        new THREE.Vector3(0, -PANDA_RIG.upperArmLength, 0),
        alongForearm(PANDA_RIG.forearmLength * 0.55),
        alongForearm(PANDA_RIG.forearmLength + 0.07),
        alongForearm(PANDA_RIG.forearmLength + 0.245),
      ])
      const radius = (t: number) => {
        const cap = Math.min(1, Math.sqrt(Math.max(0, t / 0.16)), Math.sqrt(Math.max(0, (1 - t) / 0.13)))
        return THREE.MathUtils.lerp(0.258, 0.21, THREE.MathUtils.smoothstep(t, 0.15, 0.62)) * cap
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
      if (side === 1) {
        for (let row = 0; row <= 4; row++) setRing(bandPositions, row, 0.62 + row / 4 * 0.11, 0.004)
        bandGeometry.getAttribute('position').needsUpdate = true
        bandGeometry.computeVertexNormals()
      }
    }
    return { shoulder, elbow, hand, deform }
  }
  const left = makeArm(1), right = makeArm(-1)
  let disposed = false
  const rig: PandaRig = {
    root, torso, head, left, right,
    applyPose(pose) {
      const a = constrainPandaArm(pose.left), b = constrainPandaArm(pose.right)
      left.shoulder.rotation.z = a.shoulder
      left.elbow.rotation.z = a.elbow
      right.shoulder.rotation.z = -b.shoulder
      right.elbow.rotation.z = -b.elbow
      left.deform(a.shoulder, a.elbow)
      right.deform(b.shoulder, b.elbow)
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
