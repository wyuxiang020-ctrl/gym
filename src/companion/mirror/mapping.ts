import type { ArmPose, CompanionPose } from '../types'
import { copyPose, REST_POSE } from '../types'

export interface PoseLandmark {
  x: number
  y: number
  z?: number
  visibility?: number
  presence?: number
}

export const MIRROR_LIMITS = {
  minVisibility: 0.65,
  maxFrameAgeMs: 350,
  maxShoulder: 2.60,
  maxElbow: 1.25,
  maxArmAngle: 2.95,
} as const

export type MappingResult =
  | { ok: true; pose: CompanionPose; confidence: number; valid?: { left: boolean; right: boolean }; message?: string }
  | { ok: false; reason: string; message: string }

const invalid = (reason: string, message: string): MappingResult => ({ ok: false, reason, message })
const jointIndices = [11, 13, 15, 12, 14, 16]
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))

// Input is the unflipped camera frame. Only the preview is CSS-flipped; anatomical
// human left drives panda right so both appear on the same side of the mirror.
export function mapMirrorPose(
  bodies: PoseLandmark[][],
  width: number,
  height: number,
  capturedAt: number,
  now: number,
  allowPartial = false,
): MappingResult {
  if (![width, height, capturedAt, now].every(Number.isFinite) || width <= 0 || height <= 0) {
    return invalid('dimensions', '相机画面尺寸无效，请重新开启。')
  }
  if (now < capturedAt || now - capturedAt > MIRROR_LIMITS.maxFrameAgeMs) {
    return invalid('stale', '画面更新过慢，已暂停跟随。')
  }
  if (bodies.length !== 1) {
    return invalid('body-count', bodies.length > 1 ? '请只保留一人在画面内。' : '没有清楚看到上半身，已暂停跟随。')
  }
  const points = bodies[0]
  const invalidPoint = (index: number) => {
    const point = points[index]
    return !point || ![point.x, point.y, point.visibility].every(Number.isFinite)
      || point.visibility! < MIRROR_LIMITS.minVisibility
      || (point.presence !== undefined && (!Number.isFinite(point.presence) || point.presence < MIRROR_LIMITS.minVisibility))
      || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1
  }
  const occluded = jointIndices.some(invalidPoint)
  if (occluded && (!allowPartial || [11, 12].some(invalidPoint))) {
    return invalid('visibility', '肩、肘或手腕被遮挡，请让双臂完整入镜。')
  }
  const left = points[11]
  const right = points[12]
  const shoulderWidth = (left.x - right.x) * width
  if (shoulderWidth < width * 0.10 || Math.abs(left.y - right.y) * height > shoulderWidth * 0.40) {
    return invalid('orientation', '请面向镜头保持直立；侧身和大幅倾斜暂不支持。')
  }
  const arm = (shoulderIndex: number, elbowIndex: number, wristIndex: number, direction: number): ArmPose | null => {
    if ([shoulderIndex, elbowIndex, wristIndex].some(invalidPoint)) return null
    const shoulder = points[shoulderIndex]
    const elbow = points[elbowIndex]
    const wrist = points[wristIndex]
    // Normalized x and y have different scales on a non-square video frame.
    const ux = (elbow.x - shoulder.x) * width * direction
    const uy = (elbow.y - shoulder.y) * height
    const fx = (wrist.x - elbow.x) * width * direction
    const fy = (wrist.y - elbow.y) * height
    const upperLength = Math.hypot(ux, uy)
    const lowerLength = Math.hypot(fx, fy)
    if ([upperLength, lowerLength].some(length => length < shoulderWidth * 0.20 || length > shoulderWidth * 2.5)) return null
    // Depth is only a conservative rejection signal, never a 3D rotation input.
    if ([shoulder.z, elbow.z, wrist.z].every(Number.isFinite)
      && (Math.abs(elbow.z! - shoulder.z!) * width > upperLength * 0.9
        || Math.abs(wrist.z! - elbow.z!) * width > lowerLength * 0.9)) return null
    const raise = Math.atan2(ux, uy)
    const flex = wrapAngle(Math.atan2(fx, fy) - raise)
    const tolerance = 0.04
    if (raise < -tolerance || flex < -tolerance
      || raise > MIRROR_LIMITS.maxShoulder + tolerance
      || flex > MIRROR_LIMITS.maxElbow + tolerance
      || raise + flex > MIRROR_LIMITS.maxArmAngle + tolerance) return null
    const clampedRaise = Math.max(0, Math.min(MIRROR_LIMITS.maxShoulder, raise))
    return { shoulder: clampedRaise, elbow: Math.max(0, Math.min(flex, MIRROR_LIMITS.maxElbow, MIRROR_LIMITS.maxArmAngle - clampedRaise)) }
  }
  const humanLeft = arm(11, 13, 15, 1)
  const humanRight = arm(12, 14, 16, -1)
  if (!humanLeft || !humanRight) {
    if (allowPartial && (humanLeft || humanRight)) {
      return { ok: true, pose: { left: humanRight ?? REST_POSE.left, right: humanLeft ?? REST_POSE.right },
        confidence: Math.min(...(humanLeft ? [11, 13, 15] : [12, 14, 16]).map(index => points[index].visibility!)),
        valid: { left: Boolean(humanRight), right: Boolean(humanLeft) },
        message: `${humanLeft ? '画面右侧' : '画面左侧'}的手臂暂时看不清或超出范围，已暂停该侧；另一侧继续跟随。` }
    }
    if (occluded) return invalid('visibility', '手臂暂时看不清，已暂停跟随。请回到画面中。')
    return invalid('unsupported-pose', '当前姿势超出实验范围：请在身体两侧抬手，避免交叉或向镜头伸手。')
  }
  return {
    ok: true,
    pose: { left: humanRight, right: humanLeft },
    confidence: Math.min(...jointIndices.map(index => points[index].visibility!)),
  }
}

// Smoothing is only called after confidence, freshness and range checks pass.
// Keeping the last displayed pose makes recovery gradual without inventing observations.
export class MirrorPoseFilter {
  private pose = copyPose(REST_POSE)
  private lastAt: number | null = null
  private missingSince: Record<'left' | 'right', number | null> = { left: null, right: null }

  apply(target: CompanionPose, now: number, valid = { left: true, right: true }): CompanionPose {
    const elapsed = this.lastAt === null ? 50 : Math.max(0, Math.min(100, now - this.lastAt))
    this.lastAt = now
    const alpha = 1 - Math.exp(-elapsed / 85)
    const maxStep = elapsed * 0.005
    for (const side of ['left', 'right'] as const) {
      if (valid[side]) this.missingSince[side] = null
      else {
        this.missingSince[side] ??= now
        if (now - this.missingSince[side]! < 1200) continue
      }
      for (const joint of ['shoulder', 'elbow'] as const) {
        const value = valid[side] ? target[side][joint] : REST_POSE[side][joint]
        const delta = (value - this.pose[side][joint]) * (valid[side] ? alpha : 1 - Math.exp(-elapsed / 450))
        this.pose[side][joint] += Math.max(-maxStep, Math.min(maxStep, delta))
      }
    }
    return copyPose(this.pose)
  }

  pause(): void { this.lastAt = null }
}
