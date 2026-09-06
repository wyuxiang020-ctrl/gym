# Gym

Gym 是一个面向个人使用的移动端健身与饮食记录 PWA。它把记录流程拆成 **Plan → Import → Check**：先建立训练计划，把当天动作导入记录页，再勾选真实完成的组；也可以用自然语言解析训练、用文字或照片估算饮食。

## 当前能力

- 身体档案、目标、测量历史与基础指标计算。
- 规则生成计划、5 套模板、动作编辑排序与计划导入；力量和有氧都会先作为待完成记录，做完再勾选。
- 力量/有氧记录、历史预填、MET 热量和统一完成状态；每个力量组可在“次数 / 计时”间切换，有氧可选择项目并记录距离、平均心率。AI 的备注与不确定项写入后继续显示，用户核对完成后可主动清除提示。
- 饮食文字解析、照片识别、备注重算与确认后写入；AI 输出与本地保存都有条目数、名称和营养数值上限。
- 饮水、打卡、月历、连续天数和小熊猫成长反馈。
- JSON 备份导出/导入；业务数据默认只保存在浏览器 `localStorage`。

AI 功能通过 Vercel Serverless Functions 调用 OpenAI Responses API，当前固定到 `gpt-5-mini-2025-08-07`。浏览器端不包含 API key；模型结果使用严格 JSON Schema，并在服务端和前端再次校验。训练计划本身由本地规则生成，训练热量由 MET 公式计算，不交给模型推测。AI 结果先进入可编辑预览：可切换次数/计时、增删组、修改有氧时长/距离/心率；同名力量动作还会要求选择追加、替换或返回编辑。AI 组数追加到手动动作后，该动作标记为“AI辅助”，不会伪装成纯手动记录。

计划导入和 AI 批量确认都会先检查当天项目数与单动作组数，再通过一次完整的 `DayLog` 校验和单次本地写入完成；任一上限或数据校验失败时，不会先写入一部分。计划目标必须含明确的纯次数或时长段，例如 `8-12`、`30秒`、`每组30秒`、分钟或区间；次数目标可把说明写在后续逗号/分号段。`RPE 8`、`3×10`、`AMRAP` 等不会被猜成次数，而会保留原文等待修正。计划有氧会保存原计划类型与分钟标记，用于在用户改选具体项目后继续识别重复导入。

训练打卡与训练页完成反馈复用同一基础完成口径：有效的已完成次数组、计时组，或已勾完成的正时长有氧。完成横幅还要求当天所有训练项目都已完成，因此刚导入的计划不会提前触发打卡或庆祝。

## 本地运行

项目已在 Node.js 24.16 与 Vercel CLI 59.11 上验证。

```powershell
npm install
Copy-Item .env.example .env.local
```

在 `.env.local` 中填入服务器端密钥：

```dotenv
OPENAI_API_KEY=your_openai_api_key
# 只有本机 Node 无法直接访问 OpenAI 时才设置：
# OPENAI_PROXY_URL=http://127.0.0.1:7897
```

完整联调必须使用：

```powershell
npx vercel dev --listen 3000
```

只执行 `npm run dev` 会启动纯前端，不会提供 `/api` AI 接口。

## 检查与评测

```powershell
npm run lint
npm run build
npx tsc -p api/tsconfig.json --noEmit
npm run check:ai-contracts
npm run check:api-guards -- http://127.0.0.1:3000
```

训练文字解析按合约分为 V1 历史基线和 V2 当前回归。先运行 V2 离线检查；它校验 20 条数据集和 47 项评分器行为，不访问本地接口或 OpenAI：

```powershell
npm run eval:workout:v2 -- --validate-only
```

正式运行必须显式加入 `--live`，因为每次会顺序产生 20 次真实 API 请求和费用；运行器本身不重试：

```powershell
# 仅用于复现历史合约
npm run eval:workout:v1 -- --live --base-url http://127.0.0.1:3000 --run-id <unique-v1-run-id>

# 当前 V2 合约；任何新的完整运行仍须另获费用授权并使用全新 Run ID
npm run eval:workout:v2 -- --live --base-url http://127.0.0.1:3000 --run-id <unique-v2-run-id>
```

`npm run eval:workout` 仅为旧命令兼容入口，明确等同于 `eval:workout:v1`，不是“最新版”别名。V1 的 `cases/runner/results/snapshot` 保持冻结；V2 独立支持 `reps` / `durationSeconds` 二选一和待补充的 `minutes: null`，结果不会覆盖 V1。

2026-09-05 V1 baseline（每题首次调用一次，无重试）：12/12 核心题直接通过、153/153 核心字段正确、20/20 HTTP 200 且结构有效、6/8 边界题通过；延迟中位 5290ms（2793–10423ms），总 token 22,574，估算成本 $0.018317 USD（非账单）。两项失败是“模糊有氧时长被写成 1 分钟”和“30 秒平板支撑被写成 30 次”。

V2 曾以 `2026-09-05-openai-regression-v2` 做首次正式尝试：严格顺序执行、评测器和 OpenAI SDK 都不重试，在 WO-14 后以 14 次请求中止。WO-01～13 有可核实的 Response ID 与 usage，已知小计为 18,302 token，按 [OpenAI 官方 GPT-5 Mini 单价](https://developers.openai.com/api/docs/models/gpt-5-mini)估算 $0.013075 USD；WO-14 的 usage 和整次尝试总成本无法取得。该 `.partial.json` 不是完整 20 条成绩，不能据此报告 V2 通过率，也不能当作当前修正版代码的结果。

第二次尝试 `2026-09-06-openai-regression-v2-r2` 在 WO-04 后因本机直连 OpenAI 的网络连接错误自动中止，共发出 4 次本地 API 请求且没有重试。WO-01～03 均为 `direct`，有完整 Response ID / usage；已知小计 4,616 token、估算 $0.002790 USD。WO-04 返回 `Connection error` 且没有模型 Response ID，因此其计费状态不可核实。检查发现本机直连 DNS/443 路径异常，而 `.env.local` 中已有的 `OPENAI_PROXY_URL` 因 Vercel 同时注入 API key 没有被旧加载逻辑读取；当前代码已修正为补载缺失的本地代理配置，同时保留宿主环境显式变量的优先级。无密钥连通性检查经该代理返回预期 HTTP 401。

第三次正式运行 `2026-09-06-openai-regression-v2-r3` 从 WO-01 顺序完成 20/20 次请求且无重试：核心题 12/12 直接可用、核心字段 182/182、动作名精确匹配 15/15、边界题 7/8、结构有效 20/20。延迟中位 5327.5ms（2514–12632ms），总 token 31,629，按 [OpenAI 官方 GPT-5 Mini 单价](https://developers.openai.com/api/docs/models/gpt-5-mini)估算 $0.019134 USD（非账单）；20 条均有唯一 Response ID 与唯一原始响应哈希。人工逐条复核与自动判断一致，改分 0 条。

唯一失败 WO-13 没有猜重量，也正确写出重量缺失，但把 `sets` 清空，丢失了用户明确提供的 4×8 和完成状态。正式结果保存后，Prompt 已补充“仅重量缺失时保留已知组次、用 `weight: 0` 作为待编辑占位”的规则，并增加相应运行时合约样例；该后续修复尚未重新付费回归，不能把 r3 的 7/8 改写成 8/8。

中止根因是旧 Schema 允许 `reps` 与 `durationSeconds` 同时为 `null`，WO-14 因此生成空壳组，运行时校验拒绝后旧接口又以 500 返回并丢失模型元数据。当前 Schema 已用嵌套 `anyOf` 严格实现次数/计时 XOR；缺少组数或次数/时长时要求 `sets: []`，运行时校验也与 Schema 的精确键集合对齐。4 个 AI 接口在取得可核实模型 Response 后，若 JSON 为空/解析失败则返回 422 + `MODEL_OUTPUT_PARSE_FAILED` + `meta`，结构校验失败则返回 422 + `MODEL_OUTPUT_VALIDATION_FAILED` + `meta`；尚未取得可核实 Response 的网络或供应商错误仍为 500，不能保证有 `meta`。

当前离线证据是 V2 的 20 条用例与 47 项评分器自检全部通过（`network_requests=0`）、AI 运行时合约固定样例检查 14/14、API guard 10/10。评测器会把“422 且有 Response ID”计为已调用但该题失败并继续；网络、上游错误或缺少证据才会中止。SDK 固定 `maxRetries: 0` / 110 秒超时，评测器为 120 秒，并在首请求前和完整结束时核对关键源码哈希。前两次中止尝试只保留为 partial，r3 是首个完整 V2 结果；任何新一轮仍必须另获用户授权、使用全新 Run ID 从头运行。真人编辑率、修正耗时和最终保存一致性仍为 `NOT_MEASURED`。详见 `evals/workout-parser/v2/results/2026-09-06-openai-regression-v2-r3-review.md` 与 `evals/workout-parser/v2/README.md`。

AI API 强制使用 `application/json`，并限制请求方法、正文、文字/备注长度、重算食物数量及图片输入。照片在调用模型前由服务端完整解码：只接受匹配声明格式的单帧 JPEG / PNG / WebP / GIF，Base64 解码后的输入文件最多 3 MiB，原图单边不超过 4096 像素且总像素不超过 1600 万；通过后自动旋转、最长边缩到 1024、移除元数据并重编码为 JPEG。无付费 guard 检查现为 10/10，全部在模型调用前被预期拦截。AI 每次最多返回 30 项食物；本地单餐最多保存 100 项，名称最多 120 字符，克数/热量上限 100,000，单项宏量营养素上限 10,000。

当前每 IP 每分钟 30 次的限流仍只是 Serverless 实例内计数器，会随冷启动重置且不同实例不共享。公开部署仍有一个 **P1 风险**：缺少用户鉴权、跨实例共享限流和预算级防滥用保护。

## 数据与隐私边界

- 身体档案、训练、饮食和打卡保存在当前浏览器；清除站点数据或换设备前应先导出备份。
- 使用 AI 解析、识别或重算时，用户主动提交的文字、餐食数据或压缩图片会发送给 OpenAI；界面会在提交入口提示，结果仅在核对确认后写入本地。不要提交不希望交给第三方处理的敏感信息。
- 页面联网时会请求 Google Fonts；用户保存并播放动作视频直链时，浏览器会连接该视频地址。项目没有数据库、登录、支付或统计埋点。
- 导入 JSON 文件最大 10 MB；读取后会校验并二次确认，替换前自动下载当前数据安全备份。若启动时发现本地 JSON 异常，应用会直接进入可达的数据恢复页，保留原始导出与有效备份导入能力并暂停普通写入；导入成功后应用状态会即时重载，不会卡在建档页。
- 手动训练步进器会钳制重量、次数和计时的保存上限；单日饮水记录最多 20,000 ml，避免连续点击或异常备份制造失控数值。
- `.env.local`、`.vercel/`、`node_modules/` 和 `dist/` 已排除在 Git 之外。
- 营养、热量与照片识别都是估算，不构成医疗或营养诊断；关键数据应由用户确认。

## 依赖状态

图片服务端校验使用生产依赖 `sharp` 0.35（当前 lockfile 为 0.35.4）。2026-09-05 检查结果：`npm audit --omit=dev` 为 0 个已知漏洞。完整开发依赖仍报告 29 项（1 low、12 moderate、15 high、1 critical），主要来自 Vercel CLI / `@vercel/*` 的传递依赖；当前没有执行可能引入破坏性版本变化的 `npm audit fix --force`。

## 文档

- `docs/PROJECT_CONTEXT.md`：产品、架构、数据模型和页面流程。
- `docs/AI_FEATURES.md`：AI 接口、提示词、容错、成本与评测。
- `docs/DECISIONS.md`：主要产品和技术取舍。
- `docs/CHANGELOG.md`：按批次记录变更及原因。
