import { ACTIONS, type ActionId } from './actionMotion'

export type NewMotion = 'bow' | 'wave' | 'walk' | 'lookback' | 'rest' | 'jump' | 'celebrate'
export type Clip = {
  id: string
  title: string
  category: 'actions' | 'expressions'
  duration: number
  sourceDuration: number
  description: string
  boundary: string
  source: string
  crop: readonly [number, number, number, number]
  scale: number
  offset: readonly [number, number]
  texture: string
  shadow?: string
  motion: 'idle' | ActionId | NewMotion | 'portrait'
  footY: number
  headEnd: number
  expression?: number
  checkpoints: readonly (readonly [string, number])[]
}

type AuthoredClip = Omit<Clip, 'sourceDuration'>
const poseClip = (id: NewMotion, title: string, duration: number, source: string, crop: Clip['crop'], scale: number, footY: number, headEnd: number, description: string, boundary: string, checkpoints: Clip['checkpoints']): AuthoredClip => ({
  id, title, duration, source, crop, scale, footY, headEnd, description, boundary, checkpoints,
  category: 'actions', motion: id, offset: [(480 - crop[2] * scale) / 2, 508 - footY * scale],
  texture: `library/${id}-original.svg`, shadow: `library/${id}-ground.svg`,
})

const AUTHORED_MOTIONS: readonly AuthoredClip[] = [
  { id: 'idle', title: '呼吸与眨眼', category: 'actions', duration: 6000, description: '安静站一会，呼吸，眨一下眼。', boundary: '已认可的待机，双脚保持原位。', source: 'D2-character-accessories.png', crop: [50, 140, 390, 475], scale: 1, offset: [45, 42], texture: 'gentle/stand-original.svg', shadow: 'gentle/ground-original.svg', motion: 'idle', footY: 422, headEnd: 207, checkpoints: [['吸气', 1900], ['眨眼', 2380], ['呼气', 4100]] },
  ...ACTIONS.map(action => ({ ...action, category: 'actions' as const, motion: action.id, headEnd: 207, boundary: action.id === 'hat' ? '从原稿扶帽姿势开始，爪与帽檐保持接触。' : action.id === 'stretch' ? '从原稿伸展姿势开始，保持原来的闭眼和抬爪造型。' : '沿用已认可的第二版点头。' })),
  poseClip('bow', '持帽致意', 4200, 'D2-key-poses.png', [1185, 145, 305, 352], 1.16, 331, 182, '稍稍俯身，手里的帽子跟随，再轻轻回正。', '使用已经摘帽的原稿，表演持帽行礼。', [['准备', 500], ['致意', 1710], ['回正', 3240]]),
  poseClip('wave', '挥爪招呼', 4300, 'D3-movement.png', [54, 537, 422, 368], 1.05, 342, 196, '抬着的爪沿弧线招呼两下，身体随后收稳。', '保留原稿单脚支撑和高举爪的姿势。', [['招呼', 1190], ['再挥一下', 2150], ['收稳', 3600]]),
  poseClip('walk', '持竹同行', 4500, 'D3-movement.png', [542, 542, 438, 365], 1.02, 342, 195, '持竹迈步的姿势里，重心前送，另一只爪轻轻跟随。', '这是迈步姿势的局部表演；连续换脚行走仍需过渡原画。', [['承重', 1150], ['跟随', 2230], ['站稳', 3800]]),
  poseClip('lookback', '回望邀请', 4000, 'D3-movement.png', [1100, 535, 386, 371], 1.08, 346, 169, '从原稿回望姿势出发，稍偏头看向你，再轻轻收回。', '保留原稿朝向，不补画转身时不可见的侧脸。', [['注意', 580], ['回望', 1650], ['收稳', 3250]]),
  poseClip('celebrate', '小小庆祝', 3800, 'D2-key-poses.png', [808, 548, 310, 331], 1.22, 308, 173, '举起的爪轻轻振一下，胸腹打开，开心地停一拍。', '原稿单脚支撑，抬起的脚做少量平衡。', [['准备', 480], ['开心', 1440], ['放松', 3030]]),
  poseClip('rest', '坐着歇歇', 6500, 'D2-key-poses.png', [1070, 600, 452, 284], 1, 268, 164, '坐着慢慢呼吸，头和爪随呼气放松。', '从原稿坐姿开始；地上的草帽和竹子保持原位。', [['吸气', 2030], ['稍停', 2800], ['放松', 4910]]),
  poseClip('jump', '小跳欢呼', 3300, 'D3-movement.png', [580, 132, 408, 370], 1.08, 332, 176, '轻轻蓄力，举爪欢呼，落地后柔软收稳。', '沿用 D3“跃起欢呼”原稿，保留举爪、抬脚与笑脸。', [['蓄力', 700], ['欢呼', 1500], ['落地', 2220]]),
]

const portraitRows = [
  ['平静', '好奇', '专注', '鼓励', '小得意', '放松'],
  ['开怀大笑', '哇，惊喜', '认真蓄势', '调皮眨眼', '得意一下', '呼——放松'],
]
// Use each complete original portrait, including its hat/paws. Never paste a different face onto the body.
const AUTHORED_EXPRESSIONS: readonly AuthoredClip[] = portraitRows.flatMap((labels, board) => labels.map((title, index) => {
  const crop: Clip['crop'] = [board === 0 ? [50, 550, 1070][index % 3] : [20, 540, 1035][index % 3], index < 3 ? 125 : board === 0 ? 545 : 538, board === 0 ? 450 : 465, index < 3 ? 356 : board === 0 ? 346 : 353]
  const id = `expression-${board * 6 + index + 1}`
  return { id, title, category: 'expressions' as const, duration: index === 5 ? 5200 : 3600, description: `${title}的原稿表情，配合头部与胸口的轻微动态。`, boundary: '完整沿用这张表情原稿，不把不同头像贴到身体上。', source: board === 0 ? 'D2-expressions.png' : 'D3-expressions.png', crop, scale: .94, offset: [(480 - crop[2] * .94) / 2, 155], texture: `library/${id}-original.svg`, motion: 'portrait' as const, footY: crop[3] - 12, headEnd: index < 3 ? 233 : 232, expression: board * 6 + index, checkpoints: [['开始', 450], ['表情', 1600], ['放松', 2950]] }
}))

// Keep the authored curves intact; the player and every checkpoint use half of their original duration.
function halfDuration(clip: AuthoredClip): Clip {
  return { ...clip, sourceDuration: clip.duration, duration: clip.duration * .5, checkpoints: clip.checkpoints.map(([label, time]) => [label, time * .5] as const) }
}
export const MOTION_CLIPS: readonly Clip[] = AUTHORED_MOTIONS.map(halfDuration)
export const EXPRESSION_CLIPS: readonly Clip[] = AUTHORED_EXPRESSIONS.map(halfDuration)
export const ALL_CLIPS = [...MOTION_CLIPS, ...EXPRESSION_CLIPS]
export function companionClip(id: string): Clip { return ALL_CLIPS.find(clip => clip.id === id) ?? MOTION_CLIPS[0] }
