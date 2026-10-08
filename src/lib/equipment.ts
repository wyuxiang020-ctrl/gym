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
