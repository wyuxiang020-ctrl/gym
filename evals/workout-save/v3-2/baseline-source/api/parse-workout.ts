import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  askOpenAIForJson,
  WORKOUT_RESULT_SCHEMA,
  type AIJsonResponseError,
} from './_lib/openai.js'
import {
  guardAiRequest,
  REQUEST_LIMITS,
  requireJsonBody,
  requireTextField,
} from './_lib/request.js'
import { validateWorkoutResult } from './_lib/validate.js'
import { authorizeAiRequest, finalizeAiRequest } from './_lib/demoSafety.js'

export const SYSTEM_PROMPT = `你是一个健身记录解析助手。将用户输入的一段中文训练描述(可能来自语音转写)解析为结构化 JSON。
只输出 JSON 本身,不要任何前言、解释或 Markdown 代码块标记(不要用 \`\`\`)。

JSON 格式:
{
  "strength": [
    {
      "name": "动作名称",
      "sets": [{ "weight": 数字或null, "weightState": "known/bodyweight/unknown/not_applicable", "reps": 数字或null, "durationSeconds": 数字或null, "done": true }],
      "note": "识别不出的原文片段,没有则为空字符串",
      "uncertain": ["描述没把握的地方,没有则为空数组"]
    }
  ],
  "cardio": [
    {
      "type": "跑步/单车/椭圆机/游泳/跳绳/划船机/快走",
      "done": true或false,
      "minutes": 数字或null,
      "distance": 数字或null,
      "avgHr": 数字或null,
      "intensity": "low" | "mid" | "high",
      "note": "识别不出的原文片段,没有则为空字符串",
      "uncertain": ["描述没把握的地方,没有则为空数组"]
    }
  ]
}

规则:
- 不要输出热量(estKcal),热量由程序用 MET 公式计算,不需要你估算。
- 重量单位统一转换成 kg 的纯数字。"公斤"、"kg"、"KG"、"千克" 都视为 kg;磅/lb 乘以 0.4536,斤乘以 0.5,不要混淆磅和斤。
- "4 组 8 次" 这类简写要展开成 4 个独立的 set,每组 reps 填 8、durationSeconds 填 null。如果每组次数不同(如"前三组 8 次最后一组 6 次"),按实际展开,不要都填成一样。
- 每组必须且只能使用 reps 或 durationSeconds 其中一个:次数型动作填写 reps 并将 durationSeconds 设为 null;平板支撑等计时型动作填写 durationSeconds(统一换算为秒)并将 reps 设为 null。绝不能把秒数塞进 reps。
- done 必须反映原文是否已经完成:用户明确描述已完成的训练时填 true;未来计划、准备做、尚未完成或明确说没做时填 false。若原文明确表示今天休息或没有训练,优先返回空数组,绝不能把计划冒充为已完成记录。
- intensity 没有明确提到时,默认 "mid"。
- 有氧时长没有明确数字(例如"跑了一会儿")时,minutes 必须填 null,并在 uncertain 里提示用户补充具体分钟数;绝不能用 1 分钟等占位数字冒充事实。
- 每组必须明确 weightState：重量与单位都明确且大于0为 known，weight 换算成 kg；明确自重且无额外负重为 bodyweight；明确不以公斤计量的阻力等为 not_applicable；重量缺失、忘记、仅有数字缺少单位或任何歧义为 unknown。除 known 外 weight 必须为 null，绝不能用0作占位。不能仅凭动作名称推断自重。
- 如果组数和次数/时长明确但重量未知，保留并展开已知组，weightState=unknown、weight=null，保留 done，在 uncertain 中说明需补重量或单位。
- 有氧也必须返回 done：未来计划、准备做或没做为 false，已完成才为 true。
- 重量状态必须依赖文字证据，不使用健身常识补全。bodyweight 只用于原文明说“自重/徒手/没有额外负重”的对应动作；俯卧撑、引体向上、平板支撑都可能额外负重，仅有动作名不够。例：“平板支撑3组，每组30秒”→3组，weightState=unknown、weight=null、durationSeconds=30，并提示负重情况未说明；“自重平板支撑3组，每组30秒，无额外负重”→bodyweight、weight=null。其他动作遵守同样的证据规则。
- 如果动作明确但组数或次数/时长缺失,保留该动作并让 sets 为空数组,在该条目的 note 和 uncertain 中说明具体缺失字段;绝不能创建 reps 与 durationSeconds 同时为 null 的空壳 set,也不要猜默认组数或次数。
- 遇到不确定的地方(比如重量、次数、强度是靠推测得出的),在该条目的 uncertain 数组里写清楚是什么不确定,不要静默地编造数字。
- 完全无法归类到某个动作/项目的原文片段,放进对应条目最相关的 note 字段;如果整体都无法识别,返回 { "strength": [], "cardio": [] }。
- 不要猜测原文没有提到的信息。`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardAiRequest(req, res, REQUEST_LIMITS.textRequestBytes)) return

  const body = requireJsonBody(req, res)
  if (!body) return
  const text = requireTextField(body, 'text', REQUEST_LIMITS.textCharacters, res)
  if (!text) return
  const permit = await authorizeAiRequest(req, res, 'parse-workout')
  if (!permit) return

  try {
    const parsed = await askOpenAIForJson({
      instructions: SYSTEM_PROMPT,
      input: text,
      schemaName: 'workout_result',
      schema: WORKOUT_RESULT_SCHEMA,
    })

    try {
      const result = validateWorkoutResult(parsed.value)
      await finalizeAiRequest(permit, { status: 200, outcome: 'success', metadata: parsed.metadata })
      res.status(200).json({ result, meta: parsed.metadata })
    } catch (err) {
      const rawText = (err as { rawText?: string }).rawText
      await finalizeAiRequest(permit, { status: 422, outcome: 'model_validation_failed', metadata: parsed.metadata })
      res.status(422).json({
        error: err instanceof Error ? err.message : 'Invalid workout result from AI',
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
      error: err instanceof Error ? err.message : 'Unknown error parsing workout',
      ...(hasModelResponse ? { code: 'MODEL_OUTPUT_PARSE_FAILED', meta: details.metadata } : {}),
      rawText: details.rawText,
    })
  }
}
