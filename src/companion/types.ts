// Right-handed world: +Y up, +Z faces the viewer, +X is the panda's anatomical left.
// Shoulder raises outwards from a down-facing upper arm. Elbow is local flexion.
export interface ArmPose { shoulder: number; elbow: number }
export interface CharacterMotion {
  lean?: number; turn?: number; shift?: number; lift?: number; stretch?: number
  headTilt?: number; headTurn?: number; nod?: number; blink?: number; smile?: number
  leftFoot?: number; rightFoot?: number; fold?: number; earWiggle?: number
  kick?: number; crouch?: number; hatTip?: number; look?: number; impact?: number
}
export interface CompanionPose { left: ArmPose; right: ArmPose; motion?: CharacterMotion }
export type DisplayMode = 'clear' | 'pixel'
export type CameraView = 'front' | 'three-quarter' | 'side'
export interface RenderStats {
  fps: number
  frameP50Ms: number
  frameP95Ms: number
  width: number
  height: number
  dpr: number
  bufferWidth: number
  bufferHeight: number
  pixelSize: number
}
export const REST_POSE: CompanionPose = {
  left: { shoulder: 0.10, elbow: 0 },
  right: { shoulder: 0.10, elbow: 0 },
}
export const copyPose = (pose: CompanionPose): CompanionPose => ({ left: { ...pose.left }, right: { ...pose.right }, ...(pose.motion ? { motion: { ...pose.motion } } : {}) })
