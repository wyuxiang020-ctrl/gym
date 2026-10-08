import type { CompanionPose } from '../types'
import { baseFrame, clamp, mixFace, NEUTRAL_FACE, pulse, smooth, type DFrame } from './model'
import { expression, respond, type ExpressionId } from './expressions'

export const D_ACTIONS = [
  { id: 'idle', label: '安静陪伴', duration: 7000, hint: '脚下站稳，轻轻呼吸，留意你的动静。' },
  { id: 'raise', label: '抬爪 · 停住 · 放下', duration: 10000, hint: '预设样片：抬到中段停住，再举高、保持、放下。' },
  { id: 'hat', label: '扶帽招呼', duration: 6200, hint: '戴上草帽，右爪触到帽檐，再轻轻向你致意。' },
  { id: 'removeHat', label: '摘帽致意', duration: 7500, hint: '从帽檐抓稳，先离开头顶，再摘到身侧、低头致意。' },
  { id: 'wave', label: '大幅招呼', duration: 3500, hint: '先注意到你，再打开身体，挥两下短爪。' },
  { id: 'walk', label: '持竹同行', duration: 12000, hint: '戴帽、握竹，交换支撑向前走，停稳后放下道具。' },
  { id: 'look', label: '转身回望', duration: 5800, hint: '脚先转向，胸肩随后，最后回头看你。' },
  { id: 'stretch', label: '轻轻伸展', duration: 4600, hint: '站稳，短爪与胸腹一起打开，呼气收回。' },
  { id: 'rest', label: '坐下歇歇', duration: 3800, hint: '先压低重心，再坐稳。想继续时会先撑起身子。' },
  { id: 'cheer', label: '跃起欢呼', duration: 3300, hint: '压低蓄势、蹬地展开、柔软落地，最后安静收稳。' },
  { id: 'encourage', label: '温柔鼓励', duration: 1900, hint: '看向你，轻轻点头，送一个短暂的笑容。' },
  { id: 'celebrate', label: '小小庆祝', duration: 2400, hint: '一爪高举，一脚支撑，小小得意一下。' },
  { id: 'rise', label: '起身', duration: 2100, hint: '重心先向脚掌移，再用力撑起、站稳。' },
] as const
export type DAction = typeof D_ACTIONS[number]['id']
export type RaiseSide = 'left' | 'right' | 'both'
export const duration = (id: DAction) => D_ACTIONS.find(a => a.id === id)!.duration
const blink = (t: number, at: number) => Math.max(0, 1 - Math.abs(t - at) / .095)
function hatPreparation(f: DFrame, t: number, end: number) {
  const pickup = smooth((t - .42) / .86), put = smooth((t - end + 1.45) / .92)
  f.hat = pickup * (1 - put)
  f.grip = Math.max(pulse(t, .08, .38, 1.25, 1.70), pulse(t, end - 1.9, end - 1.5, end - .44, end - .1))
  const bend = Math.max(pulse(t, 0, .42, .67, 1.45), pulse(t, end - 1.2, end - .65, end - .38, end))
  f.crouch = bend * .90; f.x = bend * -28; f.nod = bend * .12
}
export function dPose(milliseconds: number, id: DAction, reduced = false, side: RaiseSide = 'left'): DFrame {
  const t = clamp(milliseconds / 1000, 0, duration(id) / 1000)
  const f = baseFrame(), end = duration(id) / 1000
  f.breath = Math.sin(t / end * Math.PI * 2) * .008
  f.face.eyeL = f.face.eyeR = 1 - Math.max(blink(t, 2.6), blink(t, 6.1))
  if (id === 'idle') {
    const glance = pulse(t, 1, 1.35, 1.9, 2.25)
    f.face.gaze = .12 + glance * .45; f.headTurn = glance * .035
    f.phase = '安静陪伴'
  } else if (id === 'raise') {
    const level = t < 1 ? 0 : t < 2.8 ? smooth((t - 1) / 1.8) * .48 : t < 4 ? .48 : t < 5.6 ? .48 + smooth((t - 4) / 1.6) * .52 : t < 7 ? 1 : 1 - smooth((t - 7) / 2.3)
    for (const key of (side === 'both' ? ['left', 'right'] : [side]) as ('left' | 'right')[]) f.arms[key] = { shoulder: .1 + level * 2.30, elbow: level * .26 }
    f.face = respond(f.face, 'encourage', level * .7); f.face.gaze = (side === 'right' ? -1 : 1) * pulse(t, 1, 1.6, 2.1, 2.6) * .5
    f.phase = t < 1 ? '自然站立' : t < 2.8 ? '抬到中段' : t < 4 ? '中段保持' : t < 5.6 ? '继续举高' : t < 7 ? '举高保持' : t < 9.3 ? '慢慢放下' : '回到自然'
  } else if (id === 'hat') {
    hatPreparation(f, t, end)
    const touch = pulse(t, 1.85, 2.25, 3.42, 3.92), tip = pulse(t, 2.35, 2.65, 2.85, 3.4)
    f.grip = Math.max(f.grip, touch); f.hatTilt = -.12 * tip
    f.lean += .045 * touch; f.headTilt = -.055 * touch; f.face = respond(f.face, 'encourage', touch)
    f.phase = t < 1.7 ? '取帽戴好' : t < 4 ? '触帽檐 · 招呼' : '放下草帽'
  } else if (id === 'removeHat' || id === 'look') {
    const pickup = smooth((t - .42) / .86)
    const carry = pulse(t, 1.8, 2.8, end - 1.55, end - .65)
    f.hat = pickup * (1 - smooth((t - end + 2) / .4))
    f.hatCarry = carry; f.grip = Math.max(pulse(t, .08, .38, 1.25, 1.7), pulse(t, 1.5, 1.8, end - .65, end - .1))
    const bend = Math.max(pulse(t, 0, .42, .67, 1.45), pulse(t, end - 1.7, end - 1.2, end - .55, end))
    f.crouch = .88 * bend; f.x = -25 * bend
    const bow = pulse(t, 3, 3.65, 4.2, 4.95)
    if (id === 'removeHat') { f.nod = bow * .4; f.lean = bow * -.10; f.headTilt = bow * .08; f.face = respond(f.face, 'encourage', bow * .7) }
    else { const turn = pulse(t, 1.6, 2.5, 3.7, 4.7); f.twist = turn * 2.35; f.headTurn = -turn * 1.70; f.headTilt = -turn * .12; f.face = respond(f.face, 'encourage', turn); f.stepL = turn * 9; f.stepR = turn * -6 }
    f.phase = t < 1.6 ? '取帽戴好' : t < 2.8 ? '离开头顶' : t < end - 1.5 ? (id === 'look' ? '转身回望' : '摘帽致意') : '收稳 · 放帽'
  } else if (id === 'wave') {
    const ready = pulse(t, .1, .3, .35, .55), opened = pulse(t, .35, 1.0, 2.45, 3.35)
    const swing = pulse(t, 1.05, 1.18, 2.25, 2.45) * Math.sin((t - 1.1) * Math.PI * (reduced ? 1.5 : 3.2))
    f.crouch = .18 * ready; f.lean = -.14 * opened; f.headTilt = .08 * opened
    f.arms.right = { shoulder: .12 + opened * 2.20 + swing * .12, elbow: .04 + opened * .25 + swing * .13 }
    f.arms.left = { shoulder: .26 + opened * 1.05, elbow: .22 - .1 * opened }
    f.footL = opened * (reduced ? 0 : 13); f.soleL = opened * .4
    f.face = respond(f.face, 'encourage', opened); f.phase = opened > .8 ? '打开 · 挥爪' : '注意 · 收稳'
  } else if (id === 'walk') {
    // Both props are moved by the right paw in separate preparation segments.
    hatPreparation(f, t, end)
    const pick = smooth((t - 1.95) / .85), put = smooth((t - 8.0) / .7)
    f.bamboo = pick * (1 - put)
    f.bambooReach = pulse(t, 1.5, 1.95, 8.7, 9.05)
    const reach = Math.max(pulse(t, 1.5, 1.92, 2.15, 2.85), pulse(t, 7.9, 8.4, 8.55, 8.95))
    f.crouch = Math.max(f.crouch, reach * .85)
    const travel = pulse(t, 3, 3.3, 6.95, 7.7), cycle = (t - 3) / 1.5 * Math.PI * 2
    // A planted paw stays at a world-space contact; only the swing paw advances.
    const step = (start: number) => smooth((t - start) / .7)
    const swing = (start: number) => Math.sin(clamp((t - start) / .7) * Math.PI)
    const stride = reduced ? 10 : 26
    f.stepL = (step(3.3) - step(5.3)) * stride
    f.stepR = (step(4.3) - step(6.3)) * stride
    f.x += (f.stepL + f.stepR) * .5
    f.footL = (swing(3.3) + swing(5.3)) * (reduced ? 8 : 24)
    f.footR = (swing(4.3) + swing(6.3)) * (reduced ? 8 : 24)
    f.soleL = f.footL / 30; f.soleR = f.footR / 30
    f.twist = Math.sin(cycle) * .10 * travel; f.lean = .04 * travel; f.headTilt = -Math.sin(cycle - .35) * .035 * travel
    f.stepL += 67 * (1 - Math.cos(f.twist)); f.stepR -= 67 * (1 - Math.cos(f.twist))
    f.arms.left = { shoulder: .26 + (Math.sin(cycle) + 1) * .3 * travel, elbow: .22 }
    f.face = respond(f.face, 'encourage', travel * .6); f.phase = t < 3 ? '戴帽 · 握竹' : t < 7.7 ? '持竹同行' : '停稳 · 放下道具'
  } else if (id === 'stretch') {
    const reach = pulse(t, .35, 1.6, 2.7, 4.2)
    for (const key of (side === 'both' ? ['left', 'right'] : [side]) as ('left' | 'right')[]) f.arms[key] = { shoulder: .12 + reach * 2.25, elbow: reach * .3 }
    f.stretch = reach; f.lean = (side === 'right' ? 1 : -1) * .12 * reach; f.headTilt = -.5 * f.lean
    f.nod = -.1 * reach; f.face = respond(f.face, 'relaxed', reach); f.phase = reach > .9 ? '舒展保持' : '伸展 · 呼气收回'
  } else if (id === 'rest') {
    f.crouch = pulse(t, .15, .95, 1.15, 2.1) * .65
    f.sit = smooth((t - .85) / 1.55); f.nod = pulse(t, .5, 1.25, 1.5, 2.1) * .2
    f.rightTarget = { x: -68, y: -17 }; f.leftTarget = { x: 68, y: -14 }; f.targetBlend = f.sit
    f.face = respond(f.face, 'relaxed', smooth((t - 1.4) / 1.2)); f.phase = t < 2.4 ? '弯膝 · 臀部落地' : '坐稳歇歇'
  } else if (id === 'rise') {
    const forward = pulse(t, 0, .45, .8, 1.35)
    f.sit = 1 - smooth((t - .45) / 1.25); f.crouch = pulse(t, .65, 1.1, 1.3, 1.9) * .35
    f.rightTarget = { x: -68, y: -17 }; f.leftTarget = { x: 68, y: -14 }; f.targetBlend = f.sit
    f.nod = forward * .28; f.lean = -.045 * forward; f.phase = t < .6 ? '重心移到脚上' : '撑起 · 站稳'
    f.face = respond(f.face, 'relaxed', f.sit)
  } else if (id === 'cheer') {
    const prep = pulse(t, .08, .64, .73, 1.06), u = (t - .93) / .93
    const air = u > 0 && u < 1 ? 4 * u * (1 - u) : 0
    const land = pulse(t, 1.84, 2.01, 2.10, 2.68), open = pulse(t, .74, 1.1, 1.62, 2.6)
    f.crouch = prep * .96 + land * .90; f.lift = reduced ? 0 : air * 83
    f.stretch = air * .45; f.lean = -.10 * air; f.headTilt = air * .14; f.nod = prep * .2 + land * .12
    f.arms.right = { shoulder: .12 + open * 2.25 + prep * .98, elbow: .04 + open * .3 }
    f.arms.left = { shoulder: .26 + open * 1.52 + prep * .65, elbow: .22 + open * .1 }
    f.footL = air * (reduced ? 0 : 23); f.footR = air * (reduced ? 0 : 8); f.soleL = air; f.soleR = air * .3
    f.face = respond(respond(f.face, 'ready', prep), 'laugh', open); f.phase = t < .93 ? '压低蓄势' : t < 1.86 ? (reduced ? '开心展开 · 减少动态' : '蹬地 · 腾空欢呼') : t < 2.65 ? '接地 · 吸收冲击' : '恢复站稳'
    if (reduced) { f.crouch *= .18; f.lean *= .3 }
  } else if (id === 'encourage') {
    const nod = pulse(t, .1, .5, .65, 1.4), smile = pulse(t, .25, .55, 1.15, 1.8)
    f.nod = nod * .18; f.stretch = smile * .1; f.arms.left = { shoulder: .26 + smile * .55, elbow: .22 + smile * .5 }
    f.face = respond(f.face, 'encourage', smile); f.phase = '看向你 · 点头鼓励'
  } else if (id === 'celebrate') {
    const yay = pulse(t, .2, .7, 1.45, 2.25)
    f.arms.right = { shoulder: .12 + yay * 2.28, elbow: .04 + yay * .25 }
    f.arms.left = { shoulder: .26 + yay * .85, elbow: .22 }
    f.lean = -.11 * yay; f.footL = reduced ? 0 : yay * 35; f.soleL = yay * .8; f.headTilt = yay * .10
    f.face = respond(f.face, 'satisfied', yay); f.phase = '单脚支撑 · 小小得意'
  }
  if (reduced) { f.x *= .4; f.lean *= .5; f.headTilt *= .6; f.breath *= .3 }
  if (!['idle', 'rest', 'rise'].includes(id)) {
    const edge = pulse(t, 0, .18, end - .20, end), base = baseFrame()
    for (const key of ['left', 'right'] as const) for (const joint of ['shoulder', 'elbow'] as const) f.arms[key][joint] = base.arms[key][joint] + (f.arms[key][joint] - base.arms[key][joint]) * edge
  }
  return f
}

export function mirrorFrame(pose: CompanionPose, now: number, highSince: number | null): DFrame {
  const f = baseFrame(); f.arms = { left: { ...pose.left }, right: { ...pose.right } }
  const high = Math.max(pose.left.shoulder, pose.right.shoulder)
  const response = highSince === null ? 0 : Math.max(0, 1 - (now - highSince) / 1300)
  f.face = respond(f.face, 'encourage', high > .4 ? .3 + response * .55 : 0)
  const shut = Math.max(0, 1 - Math.abs((now % 4700) - 3900) / 100)
  f.face.eyeL *= 1 - shut; f.face.eyeR *= 1 - shut
  f.phase = '由当前手臂输入控制'; return f
}
export function withExpression(frame: DFrame, id: ExpressionId | 'auto'): DFrame {
  if (id === 'auto') return frame
  return { ...frame, face: mixFace(NEUTRAL_FACE, expression(id), 1) }
}
