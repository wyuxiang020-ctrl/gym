import { copyPose, REST_POSE, type CompanionPose, type CharacterMotion } from './types'
import { presetPose, type PresetArm } from './preset'

export const CHARACTER_ACTIONS = [
  { id: 'idle', label: '蓄势待发', hint: '压低重心，看看左右，随时准备出招。' },
  { id: 'wave', label: '俏皮招手', hint: '探探头，抬起爪子，热情地招两下手。' },
  { id: 'fold', label: '抱拳行礼', hint: '收爪抱拳，低头致意，再得意地抬起下巴。' },
  { id: 'hop', label: '腾空踢腿', hint: '先蓄力，再腾空出脚，稳稳落地收势。' },
  { id: 'shuffle', label: '灵活小碎步', hint: '脚下轻快换步，肚皮、脑袋和帽檐跟着晃。' },
  { id: 'stretch', label: '伸个懒腰', hint: '爪子伸高一点，身子舒展开，再慢慢收回。' },
] as const
export type CharacterAction = typeof CHARACTER_ACTIONS[number]['id']
const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x) }
const pulse = (t: number, a: number, b: number, c: number, d: number) => ease((t - a) / (b - a)) * (1 - ease((t - c) / (d - c)))
const blinkAt = (t: number, at: number) => Math.max(0, 1 - Math.abs(t - at) / .11)

export function blendCharacterPose(from: CompanionPose, to: CompanionPose, progress: number): CompanionPose {
  const weight = ease(progress), mix = (a: number, b: number) => a + (b - a) * weight
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

// Uneven action beats (anticipation, fast release, hold, settle) make a
// performance readable. Every secondary motion shares the pausable timeline.
export function characterPose(milliseconds: number, action: CharacterAction, arm: PresetArm = 'both'): CompanionPose {
  const t = Math.max(0, Math.min(8, Number.isFinite(milliseconds) ? milliseconds / 1000 : 0))
  const phase = t / 8 * Math.PI * 2
  const pose = copyPose(REST_POSE)
  pose.left = { shoulder: .57 + Math.sin(phase * 2) * .055, elbow: .69 }
  pose.right = { shoulder: .76 + Math.sin(phase * 2 - .5) * .06, elbow: .88 }
  const m = {
    lean: -.045 + Math.sin(phase) * .035, turn: 0,
    shift: Math.sin(phase) * .045, lift: 0, stretch: 1 + Math.sin(phase * 2) * .018,
    headTilt: -.045 + Math.sin(phase - .8) * .035, headTurn: Math.sin(phase) * .08,
    nod: Math.sin(phase * 2 - .7) * .025, blink: Math.max(blinkAt(t, 2.3), blinkAt(t, 6.7)), smile: 0,
    leftFoot: 0, rightFoot: 0, fold: 0, earWiggle: Math.sin(phase * 2 - 1) * .035,
    kick: 0, crouch: .10, hatTip: Math.sin(phase * 2 - 1.2) * .023,
    look: pulse(t, 1, 1.5, 2.5, 3) * -.7 + pulse(t, 4.3, 4.7, 5.8, 6.3) * .6,
    impact: 0,
  }
  pose.motion = m
  if (action === 'wave') {
    const rise = pulse(t, .25, .8, 5.5, 6.8)
    const wave = pulse(t, .8, 1.05, 4.7, 5.2) * Math.sin((t - 1) * Math.PI * 2.7)
    const prep = pulse(t, .05, .25, .35, .65)
    pose.right = { shoulder: .76 + rise * 1.12 + wave * .22, elbow: .88 - rise * .3 + wave * .24 }
    pose.left = { shoulder: .57 - rise * .28, elbow: .69 + rise * .27 }
    m.lean += rise * .10 - prep * .06; m.shift += rise * .14
    m.headTilt -= rise * .15 + wave * .045; m.nod -= rise * .1
    m.hatTip += wave * .075; m.look = -.7 * rise
    m.smile = rise; m.stretch += rise * .025 + wave * .008
  } else if (action === 'fold') {
    const salute = pulse(t, .3, 1.2, 5.4, 6.8)
    const bow = pulse(t, 1.2, 1.85, 2.35, 3.25)
    const proud = pulse(t, 3.1, 3.6, 5.0, 5.5)
    m.fold = salute; m.crouch += .15 * bow; m.stretch -= .055 * bow
    m.nod += .3 * bow - .16 * proud; m.headTilt += .12 * bow - .04 * proud
    m.hatTip += .15 * pulse(t, 1.5, 2.1, 2.4, 3.7)
    m.lean += bow * .12; m.look = -proud * .35
    m.blink = Math.max(m.blink, bow * .82)
  } else if (action === 'hop') {
    for (const start of [1.25, 4.8]) {
      const prep = pulse(t, start - .9, start - .16, start - .08, start + .1)
      const u = (t - start) / .85
      const air = u > 0 && u < 1 ? 4 * u * (1 - u) : 0
      const kick = pulse(t, start + .05, start + .24, start + .48, start + .76)
      const land = pulse(t, start + .8, start + .95, start + 1.00, start + 1.5)
      m.crouch += prep * .72 + land * .56
      m.stretch += -.13 * prep + .06 * air - .10 * land
      m.lift += .46 * air; m.kick = Math.max(m.kick, kick)
      m.leftFoot += .4 * air; m.rightFoot += .3 * air
      m.lean += -.10 * prep + .22 * kick - .06 * land
      m.shift += .15 * air; m.headTilt -= .19 * kick
      m.nod += .17 * prep - .07 * kick + .16 * land
      m.hatTip += -.1 * prep + .17 * pulse(t, start + .18, start + .4, start + .7, start + 1.3)
      pose.left.shoulder += .8 * air; pose.left.elbow -= .36 * air
      pose.right.shoulder += .55 * air; pose.right.elbow -= .28 * air
      m.impact = Math.max(m.impact, land); m.look = -.85 * kick
    }
  } else if (action === 'shuffle') {
    const dance = pulse(t, .2, .7, 6.8, 7.8)
    const step = Math.sin((t - .7) * Math.PI * 2.5)
    const lag = Math.sin((t - .83) * Math.PI * 2.5)
    m.shift += step * .18 * dance; m.lean -= step * .12 * dance
    m.headTilt += lag * .12 * dance; m.headTurn -= lag * .13 * dance
    m.leftFoot = Math.max(0, step) * dance * .8; m.rightFoot = Math.max(0, -step) * dance * .8
    m.lift = Math.abs(step) * .05 * dance; m.stretch += Math.abs(step) * .03 * dance
    m.hatTip += lag * .10 * dance; m.smile = dance
    pose.left.shoulder += step * .28 * dance; pose.right.shoulder -= step * .28 * dance
    pose.left.elbow += lag * .22 * dance; pose.right.elbow -= lag * .22 * dance
  } else if (action === 'stretch') {
    const arms = presetPose(milliseconds, arm)
    pose.left = arms.left; pose.right = arms.right
    const reach = pulse(t, .2, 2.1, 4.3, 7.5)
    m.stretch += reach * .065; m.crouch *= 1 - reach
    m.lean += Math.sin(phase) * reach * .15; m.nod -= reach * .2
    m.headTilt -= Math.sin(phase) * reach * .10; m.hatTip += reach * -.05
    m.blink = Math.max(m.blink, pulse(t, 2.2, 2.5, 3.3, 3.7) * .87)
  }
  return pose
}
