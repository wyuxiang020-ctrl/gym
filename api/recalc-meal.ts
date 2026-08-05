import type { VercelRequest, VercelResponse } from '@vercel/node'
import { askClaudeForJson } from './_lib/claude.js'

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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { items, note } = req.body ?? {}
  if (!Array.isArray(items) || typeof note !== 'string' || !note.trim()) {
    res.status(400).json({ error: 'Missing "items" or "note" in request body' })
    return
  }

  try {
    const parsed = await askClaudeForJson({
      system: SYSTEM_PROMPT,
      content: `原始估算:\n${JSON.stringify(items)}\n\n备注:${note}`,
    })
    res.status(200).json({ result: parsed })
  } catch (err) {
    const rawText = (err as { rawText?: string }).rawText
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error recalculating meal',
      rawText,
    })
  }
}
