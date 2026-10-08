import { REST_POSE, type CompanionPose, type ArmPose } from './types'

export const INTERACTION_DURATION = 2400
export type RaiseSide = 'right' | 'left' | 'both'
export const ARM_SOURCE = {
  right: { root: [91, 161], cut: [53,94], elbow: [55, 109], angle: 2.56, sign: -1 },
  left: { root: [229, 161], cut: [246,136], elbow: [259, 111], angle: 2.56, sign: 1 },
} as const
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const ease = (v: number) => { const x = clamp(v, 0, 1); return x*x*x*(x*(x*6-15)+10) }
export function raisePreset(time: number, side: RaiseSide): CompanionPose {
  const t = clamp(time, 0, INTERACTION_DURATION)
  const amount = t < 1050 ? ease((t-150)/900) : t < 1350 ? 1 : 1-ease((t-1350)/1000)
  const arm = { shoulder: .1 + 2.46*amount, elbow: .10*Math.sin(amount*Math.PI) }
  return { left: side === 'right' ? REST_POSE.left : arm, right: side === 'left' ? REST_POSE.right : arm }
}
// The original arm is already raised. Rotate source pixels about its visible
// attachment; a restrained forearm bend preserves the short-paw silhouette.
export function deformArm(x: number, y: number, side: 'left'|'right', pose: ArmPose): [number,number] {
  const rig=ARM_SOURCE[side], [rx,ry]=rig.root, [ex,ey]=rig.elbow
  const [cx,cy]=rig.cut, sourceAlong=(x-cx)*rig.sign*.57-(y-cy)*.82
  const attach=1-ease(sourceAlong/35)
  x+=(rx-cx)*attach; y+=(ry-cy)*attach
  const lowered=ease((2.56-pose.shoulder)/2.46), retract=24*lowered*ease(sourceAlong/35)
  x-=rig.sign*.57*retract; y+=.82*retract
  const vx=ex-rx,vy=ey-ry, length=Math.hypot(vx,vy)
  const along=((x-ex)*vx+(y-ey)*vy)/length
  const bend=clamp(pose.elbow,0,1.25)*.35*ease((along+12)/60)*-rig.sign
  const dx=x-ex,dy=y-ey
  const px=ex+dx*Math.cos(bend)-dy*Math.sin(bend), py=ey+dx*Math.sin(bend)+dy*Math.cos(bend)
  const angle=rig.sign*(rig.angle-clamp(pose.shoulder,.1,2.56))
  const tuck=-rig.sign*2*lowered, short=1-.08*lowered
  return [rx+((px-rx)*Math.cos(angle)-(py-ry)*Math.sin(angle))*short+tuck,ry+((px-rx)*Math.sin(angle)+(py-ry)*Math.cos(angle))*short-5*lowered]
}

