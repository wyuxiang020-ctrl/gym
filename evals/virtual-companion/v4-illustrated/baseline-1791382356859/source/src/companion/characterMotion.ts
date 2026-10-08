import { copyPose, REST_POSE, type CompanionPose, type CharacterMotion } from './types'
import { presetPose, type PresetArm } from './preset'

export const CHARACTER_ACTIONS = [
  { id: 'idle', label: '悠闲待机', hint: '呼吸、眨眼，偶尔歪头看看你。' },
  { id: 'wave', label: '挥爪招呼', hint: '先探头，再挥两下爪子打个招呼。' },
  { id: 'fold', label: '得意抱爪', hint: '抱起小爪，抬抬下巴，得意一下。' },
  { id: 'hop', label: '蓄力蹦跳', hint: '蹲一蹲、弹起来，再软软地落地。' },
  { id: 'shuffle', label: '左右晃晃', hint: '换换重心，小爪一颠一颠。' },
  { id: 'stretch', label: '伸个懒腰', hint: '伸伸爪子，扭扭圆肚子。' },
] as const
export type CharacterAction = typeof CHARACTER_ACTIONS[number]['id']
const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x) }
const windowed = (t: number, start: number, up: number, down: number, end: number) => ease((t - start) / (up - start)) * (1 - ease((t - down) / (end - down)))
const blinkAt = (t: number, at: number) => Math.max(0, 1 - Math.abs(t - at) / 0.12)

export function blendCharacterPose(from: CompanionPose, to: CompanionPose, progress: number): CompanionPose {
  const weight = ease(progress)
  const mix = (a: number, b: number) => a + (b - a) * weight
  const result = copyPose(to)
  for (const side of ['left', 'right'] as const) {
    result[side].shoulder = mix(from[side].shoulder, to[side].shoulder)
    result[side].elbow = mix(from[side].elbow, to[side].elbow)
  }
  if (result.motion) for (const key of Object.keys(result.motion) as (keyof CharacterMotion)[]) {
    result.motion[key] = mix(from.motion?.[key] ?? (key === 'stretch' ? 1 : 0), result.motion[key]!)
  }
  return result
}

// All secondary motion shares the action clock: pause/seek freezes the complete
// performance, and mirror poses never receive this preset-only animation layer.
export function characterPose(milliseconds: number, action: CharacterAction, arm: PresetArm = 'both'): CompanionPose {
  const t = Math.max(0, Math.min(8, Number.isFinite(milliseconds) ? milliseconds / 1000 : 0))
  const phase = t / 8 * Math.PI * 2
  const pose = copyPose(REST_POSE)
  pose.left = { shoulder: 0.20, elbow: 0.16 }
  pose.right = { shoulder: 0.16, elbow: 0.12 }
  const m = {
    lean: -0.035 + Math.sin(phase) * 0.025, turn: 0.10,
    shift: Math.sin(phase) * 0.018, lift: 0, stretch: 1 + Math.sin(phase * 2) * 0.012,
    headTilt: 0.055 + Math.sin(phase - 0.6) * 0.025, headTurn: -0.10 + Math.sin(phase) * 0.07,
    nod: Math.sin(phase * 2 - 0.4) * 0.018,
    blink: Math.max(blinkAt(t, 2.1), blinkAt(t, 6.4)), smile: 0,
    leftFoot: 0, rightFoot: 0, fold: 0, earWiggle: Math.sin(phase * 2) * 0.025,
  }
  pose.motion = m
  if (action === 'wave') {
    const hello = windowed(t, 0.3, 1.2, 5.2, 6.8)
    const flick = windowed(t, 1.3, 1.6, 4.4, 4.9) * Math.sin((t - 1.5) * Math.PI * 3)
    pose.right = { shoulder: 0.16 + hello * (1.86 + flick * 0.13), elbow: 0.12 + hello * (0.42 + flick * 0.24) }
    m.lean += hello * 0.09; m.shift += hello * 0.07
    m.headTilt -= hello * 0.13; m.headTurn += hello * 0.10
    m.smile = hello; m.earWiggle += flick * 0.06
  } else if (action === 'fold') {
    const proud = windowed(t, 0.4, 1.5, 5.5, 7.2)
    pose.left = { shoulder: 0.20 + proud * 1.08, elbow: 0.16 + proud * 0.30 }
    pose.right = { shoulder: 0.16 + proud * 1.20, elbow: 0.12 + proud * 0.37 }
    m.fold = proud; m.turn += proud * 0.17; m.nod -= proud * 0.12
    m.headTilt += proud * 0.035; m.lean -= proud * 0.055
  } else if (action === 'hop') {
    for (const start of [1.0, 4.0]) {
      const anticipation = windowed(t, start - 0.6, start - 0.12, start, start + 0.12)
      const flightTime = (t - start) / 0.82
      const air = flightTime > 0 && flightTime < 1 ? Math.sin(flightTime * Math.PI) : 0
      const impact = windowed(t, start + 0.78, start + 0.9, start + 0.96, start + 1.32)
      m.stretch += -0.11 * anticipation + 0.075 * air - 0.095 * impact
      m.lift += 0.32 * air
      m.nod += 0.09 * anticipation - 0.055 * air
      m.leftFoot += air * 0.60; m.rightFoot += air * 0.45
      m.smile = Math.max(m.smile, air)
      pose.left.shoulder += 0.75 * air; pose.right.shoulder += 0.65 * air
      m.earWiggle += 0.08 * impact
    }
  } else if (action === 'shuffle') {
    const dance = windowed(t, 0.2, 0.9, 6.5, 7.7)
    const step = Math.sin((t - 0.9) * Math.PI * 1.45)
    m.shift += step * 0.17 * dance; m.lean -= step * 0.12 * dance
    m.headTilt += step * 0.075 * dance; m.headTurn -= step * 0.10 * dance
    m.leftFoot = Math.max(0, step) * dance * 0.5; m.rightFoot = Math.max(0, -step) * dance * 0.5
    m.lift = Math.abs(step) * 0.018 * dance
    pose.left.shoulder += (0.25 + step * 0.18) * dance
    pose.right.shoulder += (0.25 - step * 0.18) * dance
  } else if (action === 'stretch') {
    const arms = presetPose(milliseconds, arm)
    pose.left = arms.left; pose.right = arms.right
    const reach = windowed(t, 0.3, 2.7, 4.6, 7.7)
    m.stretch += reach * 0.025
    m.lean += Math.sin(phase) * reach * 0.07
    m.nod -= reach * 0.065
    m.blink = Math.max(m.blink, windowed(t, 2.6, 2.8, 3.2, 3.4) * 0.65)
  }
  return pose
}
