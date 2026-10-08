import type { CompanionPose } from '../types'

export const D_PALETTE = { ink: '#373333', cream: '#f3ebd7', light: '#fff9e9', shade: '#e1d7c1', black: '#343334', blackLight: '#474343', pad: '#ac9780', straw: '#d9b46a', green: '#81945a', darkGreen: '#576540' } as const
export type DView = 'front' | 'left' | 'right' | 'profile-left' | 'profile-right' | 'back'
export const D_VIEWS: { id: DView; label: string; yaw: number }[] = [
  { id: 'front', label: '正面', yaw: 0 }, { id: 'left', label: '左斜侧', yaw: -.48 },
  { id: 'right', label: '右斜侧', yaw: .48 }, { id: 'profile-left', label: '左侧', yaw: -1.57 },
  { id: 'profile-right', label: '右侧', yaw: 1.57 }, { id: 'back', label: '背面', yaw: Math.PI },
]
export interface Point { x: number; y: number }
export interface Face { eyeL: number; eyeR: number; browL: number; browR: number; focus: number; mouth: number; round: number; smile: number; gaze: number; cheek: number }
export interface DFrame {
  arms: CompanionPose
  x: number; lift: number; crouch: number; stretch: number; lean: number; twist: number; sit: number
  headTilt: number; headTurn: number; nod: number; breath: number
  footL: number; footR: number; stepL: number; stepR: number; soleL: number; soleR: number
  face: Face; hat: number; bamboo: number; bambooReach: number; hatTilt: number; hatCarry: number; grip: number
  rightTarget?: Point; leftTarget?: Point; targetBlend?: number
  phase: string
}
export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t) }
export const pulse = (t: number, a: number, b: number, c: number, d: number) => smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)))
export const mixFace = (a: Face, b: Face, t: number): Face => Object.fromEntries(Object.keys(a).map(key => [key, lerp(a[key as keyof Face], b[key as keyof Face], clamp(t))])) as unknown as Face
export const NEUTRAL_FACE: Face = { eyeL: 1, eyeR: 1, browL: 0, browR: 0, focus: 0, mouth: 0, round: 0, smile: .5, gaze: .12, cheek: 0 }
export function baseFrame(): DFrame {
  return { arms: { right: { shoulder: .40, elbow: .04 }, left: { shoulder: .26, elbow: .22 } },
    x: 0, lift: 0, crouch: 0, stretch: 0, lean: 0, twist: 0, sit: 0, headTilt: 0, headTurn: 0, nod: 0, breath: 0,
    footL: 0, footR: 0, stepL: 0, stepR: 0, soleL: 0, soleR: 0, face: { ...NEUTRAL_FACE },
    hat: 0, bamboo: 0, bambooReach: 0, hatTilt: 0, hatCarry: 0, grip: 0, phase: '自然站立' }
}
