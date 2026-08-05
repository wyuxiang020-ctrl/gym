import type { VercelRequest, VercelResponse } from '@vercel/node'
import { askClaudeForJson } from './_lib/claude'

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

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { imageBase64, mediaType } = req.body ?? {}
  if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    res.status(400).json({ error: 'Missing "imageBase64" in request body' })
    return
  }

  const resolvedMediaType = ALLOWED_MEDIA_TYPES.includes(mediaType)
    ? mediaType
    : 'image/jpeg'

  try {
    const parsed = await askClaudeForJson({
      system: SYSTEM_PROMPT,
      content: [
        { type: 'text', text: '请识别图中的每一种食物并估算营养数据。' },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: resolvedMediaType,
            data: imageBase64,
          },
        },
      ],
    })
    res.status(200).json({ result: parsed })
  } catch (err) {
    const rawText = (err as { rawText?: string }).rawText
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error analyzing photo',
      rawText,
    })
  }
}
