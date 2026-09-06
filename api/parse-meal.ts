import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  askOpenAIForJson,
  FOOD_RESULT_SCHEMA,
  type AIJsonResponseError,
} from './_lib/openai.js'
import {
  guardAiRequest,
  REQUEST_LIMITS,
  requireJsonBody,
  requireTextField,
} from './_lib/request.js'
import { validateFoodResult } from './_lib/validate.js'

const SYSTEM_PROMPT = `你是一个饮食记录解析助手。将用户输入的一段中文饮食描述解析为结构化 JSON，并估算每一种食物的营养数据。
只输出 JSON 本身，不要任何前言、解释或 Markdown 代码块标记（不要用 \`\`\`）。
JSON 格式：
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
一段描述里可能包含多种食物，请拆分为多个 item。grams 按常识估算份量。
confidence 表示你对这一项估算的把握程度：描述具体（如写明重量、品牌）用 "high"，描述模糊用 "low"。
如果完全无法识别为食物，返回 { "items": [] }。`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardAiRequest(req, res, REQUEST_LIMITS.textRequestBytes)) return

  const body = requireJsonBody(req, res)
  if (!body) return
  const text = requireTextField(body, 'text', REQUEST_LIMITS.textCharacters, res)
  if (!text) return

  try {
    const parsed = await askOpenAIForJson({
      instructions: SYSTEM_PROMPT,
      input: text,
      schemaName: 'food_result',
      schema: FOOD_RESULT_SCHEMA,
    })

    try {
      const result = validateFoodResult(parsed.value)
      res.status(200).json({ result, meta: parsed.metadata })
    } catch (err) {
      const rawText = (err as { rawText?: string }).rawText
      res.status(422).json({
        error: err instanceof Error ? err.message : 'Invalid meal result from AI',
        code: 'MODEL_OUTPUT_VALIDATION_FAILED',
        rawText,
        meta: parsed.metadata,
      })
    }
  } catch (err) {
    const details = err as AIJsonResponseError
    const hasModelResponse = Boolean(details.metadata?.responseId)
    res.status(hasModelResponse ? 422 : 500).json({
      error: err instanceof Error ? err.message : 'Unknown error parsing meal',
      ...(hasModelResponse ? { code: 'MODEL_OUTPUT_PARSE_FAILED', meta: details.metadata } : {}),
      rawText: details.rawText,
    })
  }
}
