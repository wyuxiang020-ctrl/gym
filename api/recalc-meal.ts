import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  askOpenAIForJson,
  FOOD_RESULT_SCHEMA,
  type AIJsonResponseError,
} from './_lib/openai.js'
import {
  guardAiRequest,
  REQUEST_LIMITS,
  requireFoodItems,
  requireJsonBody,
  requireTextField,
} from './_lib/request.js'
import { validateFoodResult } from './_lib/validate.js'

const SYSTEM_PROMPT = `你是一个饮食记录修正助手。用户会给你一份原始的食物估算列表(JSON)和一段备注文字,备注描述了实际情况和估算的差异。
根据备注调整每一项食物的克数和营养数据,没有被备注提到的项目保持不变。
只输出 JSON 本身,不要任何前言、解释或 Markdown 代码块标记(不要用 \`\`\`)。

JSON 格式:
{
  "items": [
    {
      "name": "食物名称",
      "grams": 数字,
      "kcal": 数字,
      "protein": 数字,
      "carbs": 数字,
      "fat": 数字,
      "confidence": "high" | "mid" | "low"
    }
  ]
}
调整后的项目通常应把 confidence 提升到 "high",因为这是用户自己确认过的信息。`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardAiRequest(req, res, REQUEST_LIMITS.recalcRequestBytes)) return

  const body = requireJsonBody(req, res)
  if (!body) return
  const items = requireFoodItems(body, res)
  if (!items) return
  const note = requireTextField(body, 'note', REQUEST_LIMITS.noteCharacters, res)
  if (!note) return

  try {
    const parsed = await askOpenAIForJson({
      instructions: SYSTEM_PROMPT,
      input: `原始估算:\n${JSON.stringify(items)}\n\n备注:${note}`,
      schemaName: 'recalculated_food_result',
      schema: FOOD_RESULT_SCHEMA,
    })

    try {
      const result = validateFoodResult(parsed.value)
      res.status(200).json({ result, meta: parsed.metadata })
    } catch (err) {
      const rawText = (err as { rawText?: string }).rawText
      res.status(422).json({
        error: err instanceof Error ? err.message : 'Invalid recalculated meal result from AI',
        code: 'MODEL_OUTPUT_VALIDATION_FAILED',
        rawText,
        meta: parsed.metadata,
      })
    }
  } catch (err) {
    const details = err as AIJsonResponseError
    const hasModelResponse = Boolean(details.metadata?.responseId)
    res.status(hasModelResponse ? 422 : 500).json({
      error: err instanceof Error ? err.message : 'Unknown error recalculating meal',
      ...(hasModelResponse ? { code: 'MODEL_OUTPUT_PARSE_FAILED', meta: details.metadata } : {}),
      rawText: details.rawText,
    })
  }
}
