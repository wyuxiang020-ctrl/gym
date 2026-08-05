import type { VercelRequest, VercelResponse } from '@vercel/node'
import { askClaudeForJson } from './_lib/claude'

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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { text } = req.body ?? {}
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Missing "text" in request body' })
    return
  }

  try {
    const parsed = await askClaudeForJson({
      system: SYSTEM_PROMPT,
      content: text,
    })
    res.status(200).json({ result: parsed })
  } catch (err) {
    const rawText = (err as { rawText?: string }).rawText
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error parsing meal',
      rawText,
    })
  }
}
