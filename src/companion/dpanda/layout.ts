import { clamp, lerp, smooth, type DFrame, type Point } from './model'

export interface ArmLayout { root: Point; elbow: Point; wrist: Point; angle: number; side: -1 | 1; depth: number; open: number }
export const GROUND = 520
export const HAT_GROUND = { x: 137, y: 508, angle: -.10, scale: .57 }
export const BAMBOO_GROUND = { x: 178, y: 550, angle: 1.50, scale: .70 }
export function layout(frame: DFrame, viewYaw: number) {
  const yaw = viewYaw + frame.twist, cos = Math.cos(yaw), sin = Math.sin(yaw)
  const body = { x: 300 + frame.x, y: 410 - frame.lift + frame.crouch * 52 + frame.sit * 40 }
  const bodyY = 1 - frame.crouch * .42 - frame.sit * .18 + frame.stretch * .08
  const bodyX = 1 + frame.crouch * .16 + frame.sit * .1 - frame.stretch * .025
  const toWorld = (p: Point): Point => ({ x: body.x + p.x * Math.cos(frame.lean) - p.y * Math.sin(frame.lean), y: body.y + p.x * Math.sin(frame.lean) + p.y * Math.cos(frame.lean) })
  const head = toWorld({ x: sin * 12, y: -170 * bodyY + frame.nod * 15 })
  const headYaw = yaw + frame.headTurn
  const hatHead = { x: head.x, y: head.y - 91, angle: frame.headTilt - .09 + frame.hatTilt, scale: 1 }
  // Hat follows a high arc around the ear, with one continuous grasp point.
  const carry = frame.hatCarry
  const hatBase = {
    x: lerp(HAT_GROUND.x, hatHead.x, frame.hat), y: lerp(HAT_GROUND.y, hatHead.y, frame.hat) - Math.sin(frame.hat * Math.PI) * 98,
    angle: lerp(HAT_GROUND.angle, hatHead.angle, frame.hat), scale: lerp(HAT_GROUND.scale, 1, frame.hat),
  }
  const hat = { x: lerp(hatBase.x, body.x - 146 * cos, carry), y: lerp(hatBase.y, Math.min(body.y + 5, GROUND - 115), carry) - Math.sin(carry * Math.PI) * 120 * frame.hat,
    angle: lerp(hatBase.angle, -.95, carry), scale: lerp(hatBase.scale, 1, carry) }
  const hatGrip = { x: hat.x - Math.cos(hat.angle) * 112 * hat.scale, y: hat.y - Math.sin(hat.angle) * 112 * hat.scale + 13 * hat.scale }
  const arm = (side: -1 | 1): ArmLayout => {
    const pose = side === 1 ? frame.arms.left : frame.arms.right
    // Short cartoon paws open more at mid-raise; the hidden attachment rolls up
    // into the chest silhouette so a high paw can clear the broad cheek.
    const shoulder = clamp(pose.shoulder + Math.sin(clamp((pose.shoulder - .4) / 2.2) * Math.PI) * .70, 0, 2.70), elbow = clamp(pose.elbow, 0, 1.25)
    const direction = side * cos
    const root = toWorld({ x: side * (77 + Math.sin(shoulder / 2) * 15) * cos + sin * 8, y: -82 * bodyY - smooth((pose.shoulder - .35) / 2.05) * 58 })
    const mid = { x: root.x + direction * Math.sin(shoulder) * 58, y: root.y + Math.cos(shoulder) * 58 }
    let wrist = { x: mid.x + direction * Math.sin(shoulder + elbow) * 49, y: mid.y + Math.cos(shoulder + elbow) * 49 }
    const target = side === -1 ? frame.rightTarget : frame.leftTarget
    if (target) { const goal = toWorld(target); wrist = { x: lerp(wrist.x, goal.x, frame.targetBlend ?? 1), y: lerp(wrist.y, goal.y, frame.targetBlend ?? 1) } }
    const holdingHat = side === -1 && frame.grip > 0
    if (holdingHat) wrist = { x: lerp(wrist.x, hatGrip.x, frame.grip), y: lerp(wrist.y, hatGrip.y, frame.grip) }
    if (side === -1 && frame.bambooReach > 0) {
      const pickup = { x: lerp(BAMBOO_GROUND.x, body.x - 135, frame.bamboo), y: lerp(BAMBOO_GROUND.y, body.y - 35, frame.bamboo) }
      wrist = { x: lerp(wrist.x, pickup.x, frame.bambooReach), y: lerp(wrist.y, pickup.y, frame.bambooReach) }
    }
    if (target || holdingHat || (side === -1 && frame.bambooReach > 0)) {
      const contact = Math.max(target ? frame.targetBlend ?? 1 : 0, holdingHat ? frame.grip : 0, side === -1 ? frame.bambooReach : 0)
      mid.x = lerp(mid.x, lerp(root.x, wrist.x, .48) + direction * (holdingHat ? 55 : 28), contact)
      mid.y = lerp(mid.y, lerp(root.y, wrist.y, .5) + 17, contact)
    }
    return { root, elbow: mid, wrist, angle: Math.atan2(wrist.y - mid.y, wrist.x - mid.x) - Math.PI / 2, side, depth: side * sin, open: shoulder > 1.2 && !holdingHat ? 1 : 0 }
  }
  const left = arm(1), right = arm(-1)
  const bamboo = frame.bamboo > 0 ? {
    x: right.wrist.x, y: right.wrist.y,
    angle: lerp(BAMBOO_GROUND.angle, -.08 + frame.lean * .18, frame.bamboo), scale: lerp(.70, 1, frame.bamboo),
  } : BAMBOO_GROUND
  const feet = ([-1, 1] as const).map(side => ({ side,
    x: 300 + side * (67 + frame.crouch * 19 + frame.sit * 13) * cos + (side === 1 ? frame.stepL : frame.stepR),
    y: GROUND - frame.lift - (side === 1 ? frame.footL : frame.footR),
    sole: Math.max(frame.sit, side === 1 ? frame.soleL : frame.soleR),
  }))
  return { body, bodyX, bodyY, head, headYaw, yaw, toWorld, left, right, hat, bamboo, hatGrip, feet }
}
