import { EXPANDED_EQUIPMENT, EXPANDED_EXERCISES, EXPANDED_GUIDES } from './equipmentExpansion.js'

export const EQUIPMENT_CATALOG = [
  { kind: '固定器械', id: 'seated_chest_press', name: '坐姿推胸机', area: '胸部', cue: '座椅靠背与胸前握把，推臂向前推；区别于肩推和夹胸' },
  { kind: '固定器械', id: 'lat_pulldown', name: '高位下拉机', area: '背部', cue: '顶部滑轮长杆、座椅和压腿垫，向胸前下拉；不含组合站' },
  { kind: '固定器械', id: 'seated_row', name: '坐姿划船机', area: '背部', cue: '固定力量器械，胸部支撑垫与向身体拉回的握把；不含有氧划船机' },
  { kind: '固定器械', id: 'seated_leg_press', name: '坐姿腿举机', area: '腿部', cue: '水平坐姿、靠背、大脚踏板与插销配重；不含45度斜轨倒蹬机' },
  { kind: '固定器械', id: 'leg_extension', name: '腿屈伸机', area: '腿部', cue: '坐姿靠背，滚垫位于小腿前侧，向前上方伸膝' },
  { kind: '固定器械', id: 'prone_leg_curl', name: '俯卧腿弯举机', area: '腿部', cue: '俯卧长凳和脚踝后侧滚垫，屈膝抬脚；不含坐姿腿弯举机' },
  { kind: '固定器械', id: 'shoulder_press', name: '坐姿肩推机', area: '肩部', cue: '坐姿靠背，握把位于肩侧，推臂向头顶上推' },
  { kind: '固定器械', id: 'pec_fly', name: '蝴蝶机夹胸', area: '胸部', cue: '坐姿靠背、两侧握把沿弧线向胸前合拢；本轮为握把式夹胸' },
  ...EXPANDED_EQUIPMENT,
] as const
export type EquipmentId = typeof EQUIPMENT_CATALOG[number]['id']
export function equipmentById(id: unknown) { return EQUIPMENT_CATALOG.find(item => item.id === id) }

export const CHEST_PRESS = {
  id: 'seated_chest_press',
  name: '坐姿推胸机',
  exercise: '固定器械推胸',
  source: 'https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/insignia-series-chest-press',
  manual: 'https://support.lifefitness.com/hc/en-us/articles/360043013933-Life-Fitness-Insignia-Series-Strength-Owner-s-Manual',
  video: 'https://www.youtube.com/watch?v=_1rj1FY-b1Q',
  videoId: '_1rj1FY-b1Q',
  videoPublisher: 'Life Fitness Australia',
  model: 'Life Fitness Insignia SS-CP',
} as const

// Curated movement variants, never generated from the recognition response.
export const EQUIPMENT_EXERCISES = [
  { equipmentId: 'seated_chest_press', guideSource: 'https://www.puregym.com/exercises/chest/bench-press/seated-chest-press/', id: 'bilateral', name: '双臂推胸', exercise: CHEST_PRESS.exercise, description: '双手同时向前推，完成基础推胸动作。', condition: '按本机标牌调节座椅和起始位置。', videoId: 'sqNwDkUU_Ps', seconds: 60, publisher: 'PureGym', startSeconds: 0, endSeconds: 60, videoNote: '完整讲解 · 座椅调节、坐姿与推起回位' },
  { equipmentId: 'seated_chest_press', guideSource: 'https://www.puregym.com/exercises/chest/bench-press/single-arm-chest-press/', id: 'unilateral', name: '单臂推胸', exercise: '固定器械单臂推胸', description: '一侧完成后再换另一侧。', condition: '仅限左右推臂可独立运动、且机身说明允许单臂使用的器械。', videoId: 'jSuDZxWtDrI', seconds: 60, publisher: 'Bilt Wellness', startSeconds: 12, endSeconds: 72, videoNote: '讲解片段 00:12–01:12 · 原片约 72 秒，可打开来源看完整版' },
  { equipmentId: 'lat_pulldown', id: 'lat-pulldown', name: '高位下拉', exercise: '高位下拉', description: '将长杆从头顶拉向胸前，练习背部发力。', condition: '适用于带压腿垫的高位绳索下拉机。', videoId: 'grz-WsiBbrw', seconds: 60, publisher: 'Planet Fitness', startSeconds: 0, endSeconds: 60, videoNote: '讲解片段 00:00–01:00 · 原片约 68 秒，可打开来源看完整版', guideSource: 'https://www.puregym.com/exercises/back/lat-exercises/' },
  { equipmentId: 'seated_row', id: 'seated-row', name: '器械坐姿划船', exercise: '器械坐姿划船', description: '握把向身体两侧拉回，练习水平拉的动作。', condition: '适用于带胸部支撑垫的力量划船机。', videoId: 'TeFo51Q_Nsc', seconds: 60, publisher: 'PureGym', startSeconds: 0, endSeconds: 60, videoNote: '完整短讲解 · 座椅调节与拉回控制', guideSource: 'https://www.puregym.com/blog/how-to-use-gym-equipment/' },
  { equipmentId: 'seated_leg_press', id: 'seated-leg-press', name: '坐姿腿举', exercise: '坐姿腿举', description: '双脚推动踏板，完成伸腿与屈腿回位。', condition: '适用于水平坐姿配重腿举机。', videoId: 'p5dCqF7wWUw', seconds: 60, publisher: 'PureGym', startSeconds: 0, endSeconds: 60, videoNote: '完整短讲解 · 脚位、推起与回位', guideSource: 'https://www.puregym.com/exercises/legs/quad-exercises/leg-presses/seated-leg-press/' },
  { equipmentId: 'leg_extension', id: 'leg-extension', name: '坐姿腿屈伸', exercise: '坐姿腿屈伸', description: '坐稳后伸膝抬起小腿，再控制回落。', condition: '适用于滚垫抵住小腿前侧的腿屈伸机。', videoId: 'Bch9qTirsVE', seconds: 49, publisher: 'DOP Strength', startSeconds: 0, endSeconds: 49, videoNote: '完整短讲解 · 器械设置与伸膝示范', guideSource: 'https://www.puregym.com/exercises/legs/quad-exercises/leg-extensions/' },
  { equipmentId: 'prone_leg_curl', id: 'prone-leg-curl', name: '俯卧腿弯举', exercise: '俯卧腿弯举', description: '俯卧屈膝，将脚跟抬向臀部后缓慢放回。', condition: '适用于俯卧式腿弯举机。', videoId: 'QjNFk4F5dAs', seconds: 60, publisher: 'PureGym', startSeconds: 0, endSeconds: 60, videoNote: '完整短讲解 · 滚垫位置与屈膝示范', guideSource: 'https://www.puregym.com/blog/how-to-use-gym-equipment/' },
  { equipmentId: 'shoulder_press', id: 'shoulder-press', name: '器械坐姿肩推', exercise: '器械坐姿肩推', description: '从肩部两侧平稳向上推，再缓慢回位。', condition: '适用于坐姿固定器械肩推。', videoId: 'TnhIyp4kmO8', seconds: 55, publisher: 'PureGym', startSeconds: 0, endSeconds: 55, videoNote: '完整短讲解 · 坐姿、上推与回位', guideSource: 'https://www.puregym.com/blog/5-resistance-machines-gym-beginners-need-to-try/' },
  { equipmentId: 'pec_fly', id: 'pec-fly', name: '器械夹胸', exercise: '器械夹胸', description: '保持肘部微弯，将两侧握把合向胸前。', condition: '适用于握把式蝴蝶机；本轮不含反向飞鸟。', videoId: 'AZFC0IjGhtQ', seconds: 56, publisher: 'Danny Matranga', startSeconds: 0, endSeconds: 56, videoNote: '完整短讲解 · 手臂位置与夹胸示范', guideSource: 'https://www.puregym.com/exercises/chest/chest-fly/machine-fly/' },
  ...EXPANDED_EXERCISES,
] as const
export type EquipmentExercise = typeof EQUIPMENT_EXERCISES[number]
export type EquipmentExerciseId = EquipmentExercise['id']
export function exercisesForEquipment(id: EquipmentId) { return EQUIPMENT_EXERCISES.filter(item => item.equipmentId === id) }

// Curated concise guides, not generated from the recognition response.
export const EQUIPMENT_GUIDES: Record<EquipmentExerciseId, readonly { instruction: string; mistake?: string }[]> = {
  ...EXPANDED_GUIDES,
  bilateral: [
    { instruction: '调座椅，让握把与胸部中段齐平；先用轻重量熟悉动作。' },
    { instruction: '双脚踩稳，背部贴垫、手腕放正。', mistake: '耸肩、折腕。' },
    { instruction: '双手平稳向前推，接近伸直即停。', mistake: '猛推、锁死手肘。' },
    { instruction: '缓慢回到起点，全程保持控制。', mistake: '让配重砸落。' },
  ],
  unilateral: [
    { instruction: '确认本机允许单臂使用；调座椅，让握把与胸部中段齐平。' },
    { instruction: '双脚踩稳、背部贴垫，单手握稳。', mistake: '身体扭转、肩背离垫。' },
    { instruction: '平稳向前推，接近伸直即停。', mistake: '猛推、锁死手肘。' },
    { instruction: '缓慢回位，一侧完成再换另一侧。', mistake: '松手回弹、配重砸落。' },
  ],
  'lat-pulldown': [
    { instruction: '调座椅和压腿垫，双脚踩稳，先选能控制的轻重量。' },
    { instruction: '双手握杆、收紧腹部，肩部放低。', mistake: '耸肩、腰部过度后仰。' },
    { instruction: '将杆平稳拉向胸前，手肘朝下。', mistake: '拉到颈后、用身体甩动。' },
    { instruction: '缓慢伸臂回位，保持全程控制。', mistake: '突然松手、配重砸落。' },
  ],
  'seated-row': [
    { instruction: '调座椅和胸垫，使双臂伸直时也能握住握把。' },
    { instruction: '胸部贴垫，双脚踩稳，肩部放低。', mistake: '胸部离垫、腰背摇晃。' },
    { instruction: '收紧腹部，握把拉向身体两侧。', mistake: '耸肩、猛拉借力。' },
    { instruction: '短暂停留，再缓慢伸臂回位。', mistake: '松手回弹、配重砸落。' },
  ],
  'seated-leg-press': [
    { instruction: '调座椅，让起始膝盖约成直角；先用轻重量熟悉。' },
    { instruction: '双脚与肩同宽放在踏板上，背部贴垫。', mistake: '脚跟翘起、臀部离垫。' },
    { instruction: '均匀用力推开踏板，膝盖仍留微弯。', mistake: '膝盖内扣、锁死膝盖。' },
    { instruction: '缓慢屈膝回位，保持背臀稳定。', mistake: '下放过快、蜷腰过深。' },
  ],
  'leg-extension': [
    { instruction: '调靠背坐稳，滚垫抵在脚踝上方的小腿前侧。' },
    { instruction: '背部贴垫，握稳两侧把手，先选轻重量。', mistake: '身体抬起、腰背借力。' },
    { instruction: '平稳伸膝抬起小腿，顶端短暂停留。', mistake: '甩腿、过度伸膝。' },
    { instruction: '缓慢屈膝回到起点，保持重量可控。', mistake: '突然放下、配重砸落。' },
  ],
  'prone-leg-curl': [
    { instruction: '调滚垫到脚踝后侧、脚跟上方，膝盖对齐转轴。' },
    { instruction: '俯卧握稳把手，让髋部贴紧垫面。', mistake: '抬臀、腰部过度拱起。' },
    { instruction: '平稳屈膝，脚跟向臀部抬起并短暂停留。', mistake: '甩腿、猛拉重量。' },
    { instruction: '缓慢伸腿回位，保持身体贴垫。', mistake: '松力回弹、配重砸落。' },
  ],
  'shoulder-press': [
    { instruction: '调座椅，让握把起始与肩部齐平，先用轻重量。' },
    { instruction: '双脚踩稳，背部贴垫，握把时手腕放正。', mistake: '塌腰、折腕。' },
    { instruction: '双手平稳向上推，接近伸直即停。', mistake: '锁死手肘、猛推。' },
    { instruction: '缓慢回到肩侧起点，背部持续贴垫。', mistake: '身体离垫、配重砸落。' },
  ],
  'pec-fly': [
    { instruction: '调座椅，使握把与胸部齐平，起始不超过肩后。' },
    { instruction: '背部和头部贴垫，双脚踩稳，手肘微弯。', mistake: '耸肩、肘部僵直。' },
    { instruction: '沿弧线将握把合向胸前，保持肘部角度。', mistake: '变成推胸、身体前扑。' },
    { instruction: '缓慢张开回位，保持控制。', mistake: '过度后拉、重量回弹。' },
  ],
}

export type EquipmentResult = {
  equipmentId: EquipmentId | 'unknown'
  confidence: 'high' | 'mid' | 'low'
  evidence: string[]
  uncertain: string
}

// Shared by the server and UI: a model cannot introduce a new exercise or tutorial.
export function validateEquipmentResult(value: unknown): EquipmentResult {
  const fail = () => { throw new Error('器械识别结果格式无效，请重新拍摄或手动确认。') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const result = value as Record<string, unknown>
  if (Object.keys(result).sort().join(',') !== 'confidence,equipmentId,evidence,uncertain') return fail()
  if (!equipmentById(result.equipmentId) && result.equipmentId !== 'unknown') return fail()
  if (!['high', 'mid', 'low'].includes(String(result.confidence))) return fail()
  if (!Array.isArray(result.evidence) || result.evidence.length > 3 || result.evidence.some(item => typeof item !== 'string' || !item.trim() || item.length > 160)) return fail()
  if (typeof result.uncertain !== 'string' || !result.uncertain.trim() || result.uncertain.length > 300) return fail()
  if (result.equipmentId === 'unknown' && result.confidence !== 'low') return fail()
  if (result.equipmentId !== 'unknown' && result.evidence.length === 0) return fail()
  return result as EquipmentResult
}

export function exerciseArea(exercise: EquipmentExercise): string {
  return 'area' in exercise ? exercise.area : equipmentById(exercise.equipmentId)?.area ?? ''
}
export function needsExerciseChoice(id: EquipmentId): boolean {
  return equipmentById(id)?.kind === '自由器械' || id === 'cable_station'
}
