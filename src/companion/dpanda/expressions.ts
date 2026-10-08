import { NEUTRAL_FACE, mixFace, type Face } from './model'

const face = (change: Partial<Face>): Face => ({ ...NEUTRAL_FACE, ...change })
export const D_EXPRESSIONS = [
  { id: 'calm', label: '平静', face: face({}) },
  { id: 'curious', label: '好奇', face: face({ browL: .7, browR: .25, mouth: .18, round: .8, gaze: .65 }) },
  { id: 'focus', label: '专注', face: face({ eyeL: .85, eyeR: .85, focus: .35, smile: .3, gaze: 0 }) },
  { id: 'encourage', label: '鼓励', face: face({ mouth: .52, smile: .9, browL: .2, browR: .2, cheek: .3 }) },
  { id: 'proud', label: '小得意', face: face({ eyeL: .6, eyeR: .8, browL: .45, smile: .8, gaze: -.4 }) },
  { id: 'relaxed', label: '放松', face: face({ eyeL: .08, eyeR: .08, smile: .65, cheek: .2 }) },
  { id: 'laugh', label: '开怀大笑', face: face({ eyeL: 0, eyeR: 0, mouth: 1, smile: 1, cheek: 1, browL: .2, browR: .3 }) },
  { id: 'surprise', label: '哇，惊喜', face: face({ eyeL: 1.16, eyeR: 1.16, browL: .85, browR: .85, mouth: .85, round: 1, smile: .1, gaze: 0 }) },
  { id: 'ready', label: '认真蓄势', face: face({ eyeL: .8, eyeR: .8, focus: .85, smile: .8, mouth: .2, gaze: 0 }) },
  { id: 'wink', label: '调皮眨眼', face: face({ eyeL: .02, eyeR: 1, browL: .1, browR: .5, mouth: .65, smile: 1, cheek: .5 }) },
  { id: 'satisfied', label: '得意一下', face: face({ eyeL: .4, eyeR: .65, browL: .65, browR: -.1, smile: 1, gaze: -.5 }) },
  { id: 'exhale', label: '呼，放松', face: face({ eyeL: .05, eyeR: .05, mouth: .23, round: 1, smile: 0 }) },
] as const
export type ExpressionId = typeof D_EXPRESSIONS[number]['id']
export function expression(id: ExpressionId): Face { return { ...D_EXPRESSIONS.find(item => item.id === id)!.face } }
export function respond(face: Face, id: ExpressionId, strength: number): Face { return mixFace(face, expression(id), strength) }
