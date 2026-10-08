import type { VercelRequest, VercelResponse } from '@vercel/node'
import { askOpenAIForJson, type AIJsonResponseError } from './_lib/openai.js'
import { guardAiRequest, REQUEST_LIMITS, requireImageInput, requireJsonBody } from './_lib/request.js'
import { authorizeAiRequest, finalizeAiRequest } from './_lib/demoSafety.js'
import { EQUIPMENT_PROMPT, EQUIPMENT_SCHEMA } from './_lib/equipment.js'
import { validateEquipmentResult } from '../src/lib/equipment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardAiRequest(req, res, REQUEST_LIMITS.imageRequestBytes)) return
  const body = requireJsonBody(req, res)
  if (!body) return
  const image = await requireImageInput(body, res)
  if (!image) return
  const permit = await authorizeAiRequest(req, res, 'identify-equipment')
  if (!permit) return
  try {
    const parsed = await askOpenAIForJson({
      instructions: EQUIPMENT_PROMPT,
      input: [
        { type: 'input_text', text: '请判断照片主体是否属于本轮支持的坐姿推胸机类别。不能确定就返回 unknown。' },
        { type: 'input_image', image_url: `data:${image.mediaType};base64,${image.imageBase64}`, detail: 'auto' },
      ],
      schemaName: 'equipment_candidate', schema: EQUIPMENT_SCHEMA,
    })
    try {
      const result = validateEquipmentResult(parsed.value)
      await finalizeAiRequest(permit, { status: 200, outcome: 'success', metadata: parsed.metadata })
      res.status(200).json({ result, meta: parsed.metadata })
    } catch {
      await finalizeAiRequest(permit, { status: 422, outcome: 'model_validation_failed', metadata: parsed.metadata })
      res.status(422).json({ error: '器械识别结果未通过校验，请重新拍摄或手动确认。', code: 'MODEL_OUTPUT_VALIDATION_FAILED', rawText: JSON.stringify(parsed.value), meta: parsed.metadata })
    }
  } catch (error) {
    const details = error as AIJsonResponseError
    const hasResponse = Boolean(details.metadata?.responseId)
    await finalizeAiRequest(permit, { status: hasResponse ? 422 : 500, outcome: hasResponse ? 'model_parse_failed' : 'upstream_failed', metadata: details.metadata })
    res.status(hasResponse ? 422 : 500).json({ error: error instanceof Error ? error.message : '器械识别暂时不可用。', rawText: details.rawText, ...(hasResponse ? { code: 'MODEL_OUTPUT_PARSE_FAILED', meta: details.metadata } : {}) })
  }
}
