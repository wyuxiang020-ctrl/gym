import { copyPose, REST_POSE, type CompanionPose } from './types'

export type PresetArm = 'screen-left' | 'screen-right' | 'both'
export const PRESET_DURATION = 8000
const smooth = (t: number) => t * t * (3 - 2 * t)

export function presetPose(elapsedMs: number, arm: PresetArm): CompanionPose {
  const time = Math.max(0, Math.min(PRESET_DURATION, elapsedMs))
  const level = time < 3000 ? smooth(time / 3000) : time < 4500 ? 1 : time < 7500 ? 1 - smooth((time - 4500) / 3000) : 0
  const pose = copyPose(REST_POSE)
  const raised = { shoulder: REST_POSE.left.shoulder + 2.45 * level, elbow: 0.3 * level }
  if (arm !== 'screen-right') pose.right = { ...raised }
  if (arm !== 'screen-left') pose.left = { ...raised }
  return pose
}
