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
  { id: 'bilateral', name: '双臂推胸', exercise: CHEST_PRESS.exercise, description: '双手同时向前推，完成基础推胸动作。', condition: '按本机标牌调节座椅和起始位置。', videoId: 'sqNwDkUU_Ps', seconds: 60, publisher: 'PureGym', startSeconds: 0, endSeconds: 60, videoNote: '完整讲解 · 座椅调节、坐姿与推起回位' },
  { id: 'unilateral', name: '单臂推胸', exercise: '固定器械单臂推胸', description: '一侧完成后再换另一侧。', condition: '仅限左右推臂可独立运动、且机身说明允许单臂使用的器械。', videoId: 'jSuDZxWtDrI', seconds: 60, publisher: 'Bilt Wellness', startSeconds: 12, endSeconds: 72, videoNote: '讲解片段 00:12–01:12 · 原片约 72 秒，可打开来源看完整版' },
] as const
export type EquipmentExercise = typeof EQUIPMENT_EXERCISES[number]
export type EquipmentExerciseId = EquipmentExercise['id']

// Concise paraphrases of PureGym's machine chest press guides; no model-generated coaching.
export const EQUIPMENT_GUIDES: Record<EquipmentExerciseId, readonly { instruction: string; mistake?: string }[]> = {
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
}

export type EquipmentResult = {
  equipmentId: typeof CHEST_PRESS.id | 'unknown'
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
  if (result.equipmentId !== CHEST_PRESS.id && result.equipmentId !== 'unknown') return fail()
  if (!['high', 'mid', 'low'].includes(String(result.confidence))) return fail()
  if (!Array.isArray(result.evidence) || result.evidence.length > 3 || result.evidence.some(item => typeof item !== 'string' || !item.trim() || item.length > 160)) return fail()
  if (typeof result.uncertain !== 'string' || !result.uncertain.trim() || result.uncertain.length > 300) return fail()
  if (result.equipmentId === 'unknown' && result.confidence !== 'low') return fail()
  if (result.equipmentId !== 'unknown' && result.evidence.length === 0) return fail()
  return result as EquipmentResult
}
