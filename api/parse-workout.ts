import type { VercelRequest, VercelResponse } from '@vercel/node'
import { askClaudeForJson } from './_lib/claude.js'

const SYSTEM_PROMPT = `你是一个健身记录解析助手。将用户输入的一段中文训练描述(可能来自语音转写)解析为结构化 JSON。
只输出 JSON 本身,不要任何前言、解释或 Markdown 代码块标记(不要用 \`\`\`)。

JSON 格式:
{
  "strength": [
    {
      "name": "动作名称",
      "sets": [{ "weight": 数字, "reps": 数字, "done": true }],
      "note": "识别不出的原文片段,没有则省略",
      "uncertain": ["描述没把握的地方,没有则省略"]
    }
  ],
  "cardio": [
    {
      "type": "跑步/单车/椭圆机/游泳/跳绳/划船机/快走",
      "minutes": 数字,
      "distance": 数字或null,
      "avgHr": 数字或null,
      "intensity": "low" | "mid" | "high",
      "note": "识别不出的原文片段,没有则省略",
      "uncertain": ["描述没把握的地方,没有则省略"]
    }
  ]
}

规则:
- 不要输出热量(estKcal),热量由程序用 MET 公式计算,不需要你估算。
- 重量单位统一转换成 kg 的纯数字。"公斤"、"kg"、"KG"、"千克" 都视为 kg;如果原文是磅(lb/斤),按常识换算成 kg。
- "4 组 8 次" 这类简写要展开成 4 个独立的 set,每个 { reps: 8 }。如果每组次数不同(如"前三组 8 次最后一组 6 次"),按实际展开,不要都填成一样。
- sets 里的 done 一律填 true(用户在描述已完成的训练)。
- intensity 没有明确提到时,默认 "mid"。
- 遇到不确定的地方(比如重量、次数、强度是靠推测得出的),在该条目的 uncertain 数组里写清楚是什么不确定,不要静默地编造数字。
- 完全无法归类到某个动作/项目的原文片段,放进对应条目最相关的 note 字段;如果整体都无法识别,返回 { "strength": [], "cardio": [] }。
- 不要猜测原文没有提到的信息。`

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
      error: err instanceof Error ? err.message : 'Unknown error parsing workout',
      rawText,
    })
  }
}
