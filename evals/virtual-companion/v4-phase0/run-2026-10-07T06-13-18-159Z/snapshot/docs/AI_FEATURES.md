# AI_FEATURES.md

## 2026-10-01 缺失确认 V3.2

API、Prompt、JSON Schema、模型及预算保护未变；本轮没有真实模型请求。改变的是前端人工确认与最终保存规则：`missingWeightConfirmed: true` 仅允许 unknown/null，必须来自用户明确操作。即使模型响应带此字段，`parseWorkoutResponse` 也不会采纳；`parseWorkoutDraft` 则保留合法本地确认，以支持刷新继续编辑。

重量未记录但已完成的组可经确认保存，未确认 unknown 仍阻止保存；不计入重量容量及当前热量估算。模型自报 uncertain 不等于准确率，原解析提示保留供核对。新证据属于固定响应软件回归，并非新的独立模型测试，见 [V3.2 交付](missing-weight-v3-2/DELIVERY.md) 与 [新评分口径](../evals/workout-save/v3-2/RUBRIC.md)。

## 2026-10-01 保存恢复 V3.1

本轮未改变模型、Prompt、Schema、接口或调用预算，只修复预览编辑与草稿恢复。草稿可保留尚未满足保存条件的字段，模型响应和最终确认写入仍严格校验；重量临时输入须确认或取消后才能提交整份 AI 预览。

新增一次真实 Preview 请求与本地界面联调，保留原始响应、usage、确认值和重开数据；其余定向流程检查使用固定响应。不是新一轮模型基准，旧 20 题与冻结留出成绩仍是历史数据，详见 [V3.1 交付报告](save-recovery-v3-1/DELIVERY.md)。真人与真实照片测试没有新增结果。

## 2026-09-30 保存流程 V3

模型快照、输出 token 上限、SDK 重试与服务端预算保护未改。训练接口新增每组必填 `weightState`，非 known 的 weight 必须 null；服务端拒绝 known/0。缺单位或未明确负重情况须保留已知组次并标 unknown。前端按四态编辑，确认与真正写入前各校验一次。新增有氧必填 done，未来内容不能写成已完成。

前端所有 JSON AI 请求设置 120 秒总等待；训练解析支持主动取消、卸载时取消、同标签页刷新恢复原文与预览、失败保留已有编辑，无自动重试。输入原文改变使旧预览失效。Strict JSON Schema 仅约束结构，不保证模型理解正确（[官方说明](https://developers.openai.com/api/docs/guides/structured-outputs)）；本轮真实回归发现过模型自行推断自重，失败记录与规则修订分开保存，见 `evals/workout-save/v3`。

下文的 V1/V2 评测成绩都是历史 parse-only 成绩，不能代表 V3 保存流程或真实用户结果。本轮规则及范围见 [V3 评分标准](../evals/workout-save/v3/RUBRIC.md)；Prompt 的权威执行版本为 `api/parse-workout.ts`，以下新增规则应与其一同维护。

本项目目前有 4 个 AI 接口，全部位于 `api/`，由 Vercel Serverless Functions 调用 OpenAI Responses API。前端从不持有 API key；用户主动发起解析、识别或重算后，相应文字、餐食数据或压缩图片才会发送给 OpenAI。

## 1. 模型与公共调用配置

当前 4 个接口统一使用 **`gpt-5-mini-2025-08-07`**，模型常量写在 `api/_lib/openai.ts`。这里固定日期快照，是为了让正式评测能够对应到明确模型版本；[OpenAI 官方模型页](https://developers.openai.com/api/docs/models/gpt-5-mini)说明 snapshot 用于锁定模型版本和行为。以后若更换模型或该快照不可用，必须建立新的评测结果，不能把旧基线直接当作新模型表现。

公共调用参数：

- OpenAI Responses API，`max_output_tokens: 2048`。
- OpenAI SDK 固定 `maxRetries: 0`、超时 110 秒；V2 评测器自己的单请求超时为 120 秒，避免 SDK 或 runner 隐式重复计费。
- `store: false`，本应用不要求 OpenAI 保存可再次获取的 Response 状态；这不等同于对第三方数据政策作额外承诺。
- `text.format` 使用严格 JSON Schema（`strict: true`）。
- 图片以 `input_image` data URL 传入，`detail: 'auto'`。
- 成功响应统一为 `{ result, meta }`。`meta` 包含实际模型、Response ID、可获得时的 Request ID，以及 input / cached input / output / reasoning / total token 用量。

## 2. 输出、校验与 Human-in-the-loop

完整数据流是：

`用户输入 → API 请求边界检查 → OpenAI 严格结构化输出 → 服务端运行时校验 → 前端运行时校验 → 可编辑预览 → 用户确认 → localStorage`

4 个接口收到 `output_text` 后仍执行 `JSON.parse()`，并由 `api/_lib/validate.ts` 校验结构、枚举和数值边界；前端 `src/lib/aiValidation.ts` 在渲染或写入前再次校验。不合法结果不会静默进入本地记录，错误中会尽可能保留 `rawText`，原输入也会保留供用户修改或手动记录。

训练解析延续 V2 的约束，另叠加上述 V3 重量与保存规则：

- 次数型力量组使用整数 `reps`，计时型力量组使用整数 `durationSeconds`；严格 Schema 用嵌套 `anyOf` 把 set 拆成两个精确键分支，两字段都必须存在，但必须一项为正整数、另一项严格为 `null`。服务端运行时校验与 Schema 的根级、条目级和 set 级精确键集合对齐；前端确认后再转成可选字段，本地备份校验也拒绝小数次数/秒数。
- `minutes` 在 AI 预览阶段允许为 `null`。例如只说“跑了一会儿”时，界面要求补充 1–1440 分钟，未补充前不能写入。
- 原文能确定动作、却缺少组数或次数/时长时，模型应保留动作并返回 `sets: []`，把缺失信息写进 `note` / `uncertain`，不能创建两个目标都为 `null` 的空壳组。空组动作只用于可编辑预览；确认保存仍要求至少一个有效组，组未完成、数值超界或 XOR 不成立时也会阻止写入。
- 每一组都能在“次数 / 计时”之间切换；预览允许新增或删除力量组，并编辑有氧类型、时长、距离、平均心率和强度。所有编辑值会在确认时重新校验，而不是默认信任初次模型结果。
- AI 识别出与当天已有记录同名的力量动作时，不会直接改数据；用户必须选择“追加新组数”“替换同名动作组数”或“返回编辑”，确认前不写入任何内容。
- AI 组数追加到已有手动动作后，`StrengthEntry.source` 改为 `mixed`，记录页显示“AI辅助”；替换则标记为 `nl`。来源信息因此能区分纯手动、纯 AI 与混合编辑。
- AI 整批确认会先在内存中完成同名合并、热量重算和上限预检：单动作合并后最多 50 组，当天最多 200 个力量动作和 100 个有氧项目。随后通过 `replaceDayLog()` 对完整当天记录做一次校验和单次写入；失败时不会留下部分新增记录。
- 已确认写入的力量和有氧仍会显示模型返回的 `note` / `uncertain`，而不是只在预览中出现。用户核对或修正后可点“已处理，清除提示”，一次清空这两类提示；清除是用户确认动作，不代表系统自动证明内容正确。
- 训练与饮食界面都会明确提示：相应文字、餐食数据或压缩照片会发送给 OpenAI，结果只在用户核对并确认后写入本地。

## 3. 逐接口：Prompt 全文与输入输出

### 3.1 `POST /api/parse-workout` —— 自然语言训练记录解析

系统提示词全文：

````text
你是一个健身记录解析助手。将用户输入的一段中文训练描述(可能来自语音转写)解析为结构化 JSON。
只输出 JSON 本身,不要任何前言、解释或 Markdown 代码块标记(不要用 ```)。

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
- 不要猜测原文没有提到的信息。
````

输入：`text`，最多 2000 个字符。输出：`strength[]` + `cardio[]`。Prompt 为便于阅读写“数字”，实际严格 JSON Schema 对 `reps` / `durationSeconds` 使用 `integer`，后续两层校验也要求整数。AI 不返回热量；训练热量由 `src/lib/met.ts` 的 MET 公式计算。

### 3.2 `POST /api/parse-meal` —— 自然语言饮食解析

系统提示词全文：

````text
你是一个饮食记录解析助手。将用户输入的一段中文饮食描述解析为结构化 JSON，并估算每一种食物的营养数据。
只输出 JSON 本身，不要任何前言、解释或 Markdown 代码块标记（不要用 ```）。
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
如果完全无法识别为食物，返回 { "items": [] }。
````

输入：`text`，最多 2000 个字符。输出：`items[]`，每项含名称、克数、热量、蛋白质、碳水、脂肪和模型自报置信度。置信度没有经过统计校准，只是供预览核对的提示。严格 Schema、服务端和前端都限制 AI 一次最多返回 30 项；名称最多 120 字符，克数 / kcal 为 0–100,000，蛋白质 / 碳水 / 脂肪各为 0–10,000。

### 3.3 `POST /api/analyze-photo` —— 食物照片识别

系统提示词全文：

````text
你是一个食物照片识别助手。识别图片中的每一种食物，并估算营养数据。
只输出 JSON 本身，不要任何前言、解释或 Markdown 代码块标记（不要用 ```）。
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
如果图片中无法识别出食物，返回 { "items": [] }。
````

输入：不带 `data:` 前缀的 `imageBase64` + 可选 `mediaType`。前端先把图片缩到最长边不超过 1024px、JPEG 质量 0.7；服务端不会只信任这一步，而是用生产依赖 `sharp` 0.35 再做独立校验与规范化：

1. 验证 Base64 可规范解码、解码后不超过 3 MiB，并用文件头和 `sharp` 实际识别格式双重核对声明的 MIME；输入只接受 JPEG / PNG / WebP / GIF。
2. 以失败即拒绝的方式完整解码；宽、高各不超过 4096 像素，总像素不超过 16,000,000，只允许单帧，动态或多帧图片拒绝。
3. 按图片方向自动旋转，在不放大的前提下缩进 1024 × 1024 边界，透明区域铺白、转 sRGB，并以质量 80 重编码为 JPEG。重编码不携带原始元数据，发送给 OpenAI 的始终是这个规范化后的单帧 JPEG，而不是不可信原文件。

输出结构同 3.2。

### 3.4 `POST /api/recalc-meal` —— 按备注重新估算

系统提示词全文：

````text
你是一个饮食记录修正助手。用户会给你一份原始的食物估算列表(JSON)和一段备注文字,备注描述了实际情况和估算的差异。
根据备注调整每一项食物的克数和营养数据,没有被备注提到的项目保持不变。
只输出 JSON 本身,不要任何前言、解释或 Markdown 代码块标记(不要用 ```)。

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
调整后的项目通常应把 confidence 提升到 "high",因为这是用户自己确认过的信息。
````

输入：1–30 个合法 `items`（序列化后最多 32 KiB）+ 最多 1000 字符的 `note`。接口把两者拼成 `原始估算:\n<JSON>\n\n备注:<note>`。返回结果先展示原/新热量与可编辑清单，只有用户确认才替换原记录。

## 4. API 请求保护与错误处理

4 个接口共同使用 `api/_lib/request.ts`：

| 保护项 | 当前行为 |
|---|---|
| 方法与正文 | 只允许 POST，并强制 `Content-Type: application/json`（允许 charset 参数）；正文还必须是 JSON 对象。错误分别返回 405 / 415 / 400 |
| 文字 | 训练与饮食文字最多 2000 字符，请求正文最多 16 KiB |
| 重算 | 备注最多 1000 字符、最多 30 项食物、食物列表最多 32 KiB、请求正文最多 64 KiB |
| 图片 | 仅单帧 JPEG / PNG / WebP / GIF；Base64 解码后最多 3 MiB，单边最多 4096 像素、总像素最多 1600 万；完整解码后缩至最长边 1024、去元数据并重编码为 JPEG |
| 食物结果与保存 | AI 结果最多 30 项；可编辑预览与手动单餐最多保存 100 项。名称最多 120 字符，克数 / kcal 上限 100,000，三项宏量营养素各上限 10,000；确认保存时还要求克数、热量或三项宏量营养素中至少一个数值大于 0 |
| 频率与预算 | 公开环境使用 Upstash 跨实例分钟 / 日请求限制和日预算预留；本地开发可使用内存回退。超出返回 429 和 `Retry-After` |
| 缓存 | 所有 API 响应设置 `Cache-Control: no-store` |

4 个端点还共用 `api/_lib/demoSafety.ts`：服务端校验 `X-Gym-Access-Code`，使用哈希后的客户端标识在 Upstash 维护每分钟和每日计数，调用前预留预算、调用后按 usage 结算，并写入不含输入内容的脱敏审计。达到默认 80% 日预算时只触发一次告警。Vercel Preview / Production 缺少访问码、审计 salt 或完整 Upstash 配置时返回 503；只有非公开本地开发才允许内存回退。共享访问码不是完整账号系统，仍应配合 OpenAI 项目预算与通知。

`npm run check:api-guards -- http://127.0.0.1:3000` 当前 10/10 通过：覆盖非 POST、非 JSON、空/超长文字、伪造/仅文件头/截断/超尺寸图片，以及空重算清单和超长备注；这些请求都在任何模型调用前被拒绝，因此该检查不产生模型费用。它证明边界拦截按预期工作，不证明公开部署已安全。

`npm run check:demo-safety` 当前 18/18 通过，覆盖缺配置 fail closed、访问码强度、Upstash 公开路径、Vercel Marketplace 变量别名、跨实例限流、并发预算预留、无 usage 失败的保守记账、告警去重和审计脱敏等固定场景。2026-09-06 已通过 Marketplace 创建并连接免费 `gym-ai-safety` Redis，并在三个环境配置 OpenAI key、访问码、审计 salt 与限额。Preview 实测为两次 401 拦截与一次 200 模型成功，Upstash 的请求、结算和脱敏审计一致；Production 尚未发布，429 / 503 只完成固定测试而非线上故障注入。

上述“最多 30 项”是单次 AI 响应和重算请求边界，“单餐 1–100 项”是用户新确认写入的边界，两者不是同一个指标。备份导入校验每餐 0–100 项和相同数值上限；为兼容历史数据，导入层仍可读取旧的空餐或全零食物，不会自动改写成新值。

4 个接口对已经取得可核实模型 Response 的失败使用可审计的 422：`output_text` 为空或 JSON 解析失败时返回 `code: 'MODEL_OUTPUT_PARSE_FAILED'`，JSON 可解析但运行时结构校验失败时返回 `code: 'MODEL_OUTPUT_VALIDATION_FAILED'`；两类都带可获得的 `rawText` 与 `meta`（Response ID、usage 等）。只有在尚未取得可核实 Response 时发生的网络、鉴权、额度或其他供应商异常才返回 500，此时不保证有 `meta`。前端仍会把未配置密钥、无额度、纯 Vite 未启动 `/api` 等常见情况转换成中文提示，不会把失败结果写入本地。

本地完整联调用 `vercel dev`；只运行 `npm run dev` 不会提供 `/api`。Vercel CLI 未注入 Development Secret 时，服务端才会从受 Git 忽略的 `.env.local` 读取 `OPENAI_API_KEY`。如果 Node 直连 OpenAI 超时，可仅在需要的环境里设置 `OPENAI_PROXY_URL`；代码也支持标准 `HTTPS_PROXY` / `HTTP_PROXY`，没有把本机代理地址写死。

## 5. Gym 20 条正式评测

V1 数据集、规则、结果和当时源码快照位于 `evals/workout-parser/v1/`。正式运行 ID 为 `2026-09-05-openai-baseline-v1`，20 条用例各调用一次，没有重试；实际模型均为 `gpt-5-mini-2025-08-07`。

V1 历史基线由 `npm run eval:workout:v1` / `scripts/run-workout-eval.mjs` 维护；旧命令 `npm run eval:workout` 只作为明确的 V1 兼容别名，不代表当前版本。V2 已有独立的 20 条 `cases.jsonl`、`RUBRIC.md` 和 `scripts/run-workout-eval-v2.mjs`，正式入口是 `npm run eval:workout:v2`，两代数据和结果不会互相覆盖。

V2 当前离线证据为：20 条用例成功装载、47 项评分器自检通过且 `network_requests=0`；补充缺重量及相邻场景后，`npm run check:ai-contracts` 的 AI 运行时合约固定样例检查为 18/18，API guard 为 10/10。未带 `--live` 时运行器会在任何网络请求前以退出码 1 停止。这些只证明评测器、合约和防误调用机制可用；模型质量成绩以正式结果文件为准。

| 指标 | V1 正式结果 |
|---|---:|
| 核心题直接可用 | 12/12（100%） |
| 核心字段准确 | 153/153（100%） |
| 边界题通过 | 6/8（75%） |
| HTTP 200 + 结构有效 | 20/20（100%） |
| 延迟 | 中位 5290ms；范围 2793–10423ms |
| Token | input 15,332；cached 0；output 7,242；reasoning 4,864；total 22,574 |
| 估算成本 | $0.018317 USD（按当时公开单价计算，非账单） |

两项失败：

- `WO-15`：“跑了一会儿”被写成可保存的 `minutes: 1`。
- `WO-18`：“平板支撑 3 组，每组 30 秒”被写成 `reps: 30`。

### V2 首次正式尝试：部分运行，不是完整成绩

`2026-09-05-openai-regression-v2` 严格顺序执行、每题一次，评测器和 SDK 都没有重试；运行在 WO-14 后以 14 次请求中止，检查点保存在 `evals/workout-parser/v2/results/2026-09-05-openai-regression-v2.partial.json`。WO-01～13 有 Response ID 和 usage；它们的已知小计为 input 13,445、cached input 0、output 4,857（含 reasoning 3,136）、total 18,302 token，按本页第 6 节单价估算为 $0.013075 USD。WO-14 没有回传 Response ID / usage，因此第 14 次和整次尝试的精确成本不可得，以上数字不能称为整轮成本。

WO-14 暴露的是旧合约缺口：旧 Schema 允许 `reps` 与 `durationSeconds` 同时为 `null`，模型为“卧推 60kg，组数和次数没记”生成了空壳 set；运行时校验失败后，旧端点以 500 返回并丢失 `meta`，runner 因缺少计费证据而中止。因为只覆盖 WO-01～14，且之后的 Schema、Prompt、校验和错误格式都已改变，该 partial **不能生成 V2 通过率、不能证明 WO-15 / WO-18 已通过，也不能代表当前代码**。

第二次尝试 `2026-09-06-openai-regression-v2-r2` 在 WO-04 遇到无 Response ID 的 `Connection error`，共发出 4 次本地 API 请求且无重试；WO-01～03 为 `direct`，已知小计 4,616 token、估算 $0.002790 USD，WO-04 计费状态不可核实。诊断发现本机直连 OpenAI 的 DNS/443 路径异常，而 `.env.local` 中已有代理配置没有在 Vercel 已注入 key 的情况下被旧加载逻辑读取。当前 helper 会补载缺失的本地代理配置并保留宿主显式变量优先级；经代理进行的无密钥 API 检查返回预期 HTTP 401。该 partial 仍不是完整成绩，也不代表代理加载修复后的模型质量。

### V2 正式结果：完整运行并人工复核

第三次运行 `2026-09-06-openai-regression-v2-r3` 经修正后的代理加载路径从 WO-01 顺序完成 20/20 次请求，评测器和 SDK 均无重试。实际模型全部为 `gpt-5-mini-2025-08-07`，20 条均有唯一 Response ID 与唯一原始响应哈希，运行前后冻结文件哈希一致。

| 指标 | V2 r3 正式结果 |
|---|---:|
| 核心题直接可用 | 12/12（100%） |
| 核心字段准确 | 182/182（100%） |
| 动作名精确匹配 | 15/15（100%） |
| 边界题通过 | 7/8（87.5%） |
| HTTP 200 + 结构有效 | 20/20（100%） |
| 延迟 | 中位 5327.5ms；范围 2514–12632ms |
| Token | input 22,712；cached input 19,456；output 8,917；reasoning 6,400；total 31,629 |
| 估算成本 | $0.019134 USD（按运行时记录单价估算，非账单） |

人工逐条阅读 20 条原始响应，与自动判断一致，改分 0 条。唯一失败 WO-13 正确识别并提示重量缺失，也没有猜正重量，但把 `sets` 清空，丢失了用户明确提供的 4×8 和完成状态。r3 保存后，Prompt 补充“仅重量缺失时保留已知组次、每组用 `weight: 0` 作为待编辑占位并提示补充”的独立规则；r3 作为修复前证据保持 7/8，不进行回写。

### V2 r4：WO-13 修复验证

`2026-09-06-openai-regression-v2-r4` 使用相同数据集、Rubric 和固定模型，从 WO-01 重新完成 20/20 次顺序请求且无重试。结果为核心 12/12 direct、字段 182/182、动作名 15/15、边界 8/8、结构 20/20；延迟中位 6405ms（3755–14421ms），总 token 33,482，估算成本 $0.019038 USD（非账单）。20 条都有唯一 Response ID/原始响应哈希，冻结源码运行前后一致，人工复核改分 0 条。

WO-13 正确保留了四个 8 次完成组，以 `weight: 0` 作为待编辑占位，并在同一条目要求补充实际重量；其他 19 条没有规则回归。WO-18 虽然结构和计时语义正确，但额外出现“未提到重量”的不确定提示；它不违反当前 Rubric，作为后续真人预览测试的非阻断观察项保留。

修复后，Schema 用嵌套 `anyOf` 严格实现 set XOR；缺少组数或次数/时长时返回 `sets: []`；运行时 validator 与 Schema 的精确键要求一致。4 个 AI 端点会为已取得 Response 的解析失败或结构失败返回带 `meta` 的 422。V2 runner 把“422 且有 Response ID”作为已经发生调用、可计入分母的该题失败并继续；网络/上游异常、非该类 HTTP 错误或缺少 Response ID 等证据时才 fatal。SDK 为 `maxRetries: 0` / 110 秒，runner 为 120 秒；完整运行在首请求前冻结关键文件哈希，并在结束时再次核对。

V1、V2 r3 与 r4 的人工复核都对各自 20 条接口响应逐条阅读，均与自动判定一致，改分 0 条。下列真人指标均为 **NOT_MEASURED**：预览页实际编辑率、修正耗时、确认后的最终保存一致性、Plan Import 与手动记录的 A/B 时间、外部用户可用性、留存和健康效果。V1 与 V2 都是合成、单轮、API parse-only 评测，不是 20 位用户测试，也不代表线上 SLA。

## 5.1 Gym 饮食 AI V1 正式评测

`evals/food-ai/v1/` 包含 15 条文字、10 条备注重算与 10 张合成照片用例、Rubric、无重试顺序运行器、图片生成/变体来源清单和结果。完整基线 `2026-09-06-openai-food-baseline-v1` 共发起 35/35 次调用：结构 35/35，自动判定 26 direct / 8 partial / 1 fail，语义召回 94.7%、精确率 93.5%、硬检查 92.0%。人工逐条复核发现 4 条名称别名误报，复核后为 30 direct / 5 partial / 0 fail、语义召回 100%、精确率 98.7%、硬检查 94.9%。

5 个真实缺口都在重算：没有被备注点名的食物发生营养或置信度变化，以及 FR-06 将全脂牛奶的营养改成脱脂后名称没有同步。Prompt 因此增加“未涉及条目逐字段保持”“不主动抬高置信度”“替换食材同步名称”的硬规则。定向运行 `2026-09-06-openai-food-recalc-prompt-v2` 只重跑 10 条重算用例，结果为 10/10 direct、语义和硬检查均 100%；它不是 35 条全量重跑。

基线延迟中位 10001ms、p95 20281ms、总 token 48,882、估算成本 $0.058331；定向回归延迟中位 9165ms、p95 14754ms、总 token 9,534、估算成本 $0.009828。两次均为合成输入与单轮模型结果，成本不是账单，图片 direct 只表示可以进入人工确认，不表示营养估算等于真实值。

## 6. Token 与成本

GPT-5 Mini 官方模型页当前列出的文本价格是：输入 $0.25 / 百万 token、缓存输入 $0.025 / 百万 token、输出 $2.00 / 百万 token；价格会变化，应以 [OpenAI 官方模型页](https://developers.openai.com/api/docs/models/gpt-5-mini)和账户账单为准。

V1、V2 r3 与 r4 的 20 条训练解析，以及饮食 V1 的 35 条基线和 10 条重算定向回归，均已有完整 usage 样本。前两次 V2 partial 的已知小计仍只用于解释中断历史，不与完整结果合并成模型成绩。图片成本受尺寸和输入处理影响，只能引用本次数据集结果，不能外推为固定单次成本。

## 7. 仍需验证或补齐

- V2 r4 已完成 WO-13 修复验证并人工复核；后续模型或 Prompt 变化仍必须另获费用授权、使用全新 Run ID 从 WO-01 开始，不得覆盖既有结果或续写 partial。
- 饮食 V1 数据集和首次正式结果已完成；下一次只有在模型、Prompt、Schema 或评分规则变化后才建立新 Run ID，历史基线不回写。
- 用真实预览操作测量编辑率、修正时间和最终保存一致性；这些 Human-in-the-loop 指标不能由规则对照自动推断。
- Preview 已完成一组真实 401 / 200 happy-path 与 Redis 审计核验；仍需形成多次采样后才能报告线上延迟或冷启动分布，当前本地延迟不能作为线上 SLA。
- 公开演示配置与 Preview 激活已完成；Production 发布前仍需设置 OpenAI 项目级预算 / 通知，并在不影响公开配置的受控环境补做 429 / 503 故障注入。
- 当前使用非流式返回，因为必须拿到完整 JSON 并校验后才能进入预览；如果将来优化感知延迟，需要重新设计可验证的渐进式体验。
