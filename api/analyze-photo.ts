import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  askOpenAIForJson,
  FOOD_RESULT_SCHEMA,
  type AIJsonResponseError,
} from './_lib/openai.js'
import {
  guardAiRequest,
  REQUEST_LIMITS,
  requireImageInput,
  requireJsonBody,
} from './_lib/request.js'
import { validateFoodResult } from './_lib/validate.js'
import { authorizeAiRequest, finalizeAiRequest } from './_lib/demoSafety.js'

const SYSTEM_PROMPT = `你是一个食物照片识别助手。识别图片中的每一种食物，并估算营养数据。
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
图中可能有多种食物，请拆分为多个 item。grams 按视觉份量常识估算。
confidence 表示你对这一项估算的把握程度，看不清或难以判断分量时用 "low"。
如果图片中无法识别出食物，返回 { "items": [] }。`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardAiRequest(req, res, REQUEST_LIMITS.imageRequestBytes)) return

  const body = requireJsonBody(req, res)
  if (!body) return
  const image = await requireImageInput(body, res)
  if (!image) return
  const permit = await authorizeAiRequest(req, res, 'analyze-photo')
  if (!permit) return

  try {
    const parsed = await askOpenAIForJson({
      instructions: SYSTEM_PROMPT,
      input: [
        { type: 'input_text', text: '请识别图中的每一种食物并估算营养数据。' },
        {
          type: 'input_image',
          image_url: `data:${image.mediaType};base64,${image.imageBase64}`,
          detail: 'auto',
        },
      ],
      schemaName: 'photo_food_result',
      schema: FOOD_RESULT_SCHEMA,
    })

    try {
      const result = validateFoodResult(parsed.value)
      await finalizeAiRequest(permit, { status: 200, outcome: 'success', metadata: parsed.metadata })
      res.status(200).json({ result, meta: parsed.metadata })
    } catch (err) {
      const rawText = (err as { rawText?: string }).rawText
      await finalizeAiRequest(permit, { status: 422, outcome: 'model_validation_failed', metadata: parsed.metadata })
      res.status(422).json({
        error: err instanceof Error ? err.message : 'Invalid photo result from AI',
        code: 'MODEL_OUTPUT_VALIDATION_FAILED',
        rawText,
        meta: parsed.metadata,
      })
    }
  } catch (err) {
    const details = err as AIJsonResponseError
    const hasModelResponse = Boolean(details.metadata?.responseId)
    await finalizeAiRequest(permit, { status: hasModelResponse ? 422 : 500, outcome: hasModelResponse ? 'model_parse_failed' : 'upstream_failed', metadata: details.metadata })
    res.status(hasModelResponse ? 422 : 500).json({
      error: err instanceof Error ? err.message : 'Unknown error analyzing photo',
      ...(hasModelResponse ? { code: 'MODEL_OUTPUT_PARSE_FAILED', meta: details.metadata } : {}),
      rawText: details.rawText,
    })
  }
}
