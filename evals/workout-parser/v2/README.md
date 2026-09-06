# Gym 训练解析 V2 回归说明

## 状态：COMPLETED；正式 V2 结果已生成并人工复核

2026-09-06，修复验证运行 `2026-09-06-openai-regression-v2-r4` 从 WO-01 顺序完成 20/20 次请求，评测器与 OpenAI SDK 均无重试。结果为：核心题 12/12 直接可用、核心字段 182/182、动作名精确匹配 15/15、边界题 8/8、结构有效 20/20；延迟中位 6405ms（3755–14421ms），总 token 33,482，估算成本 $0.019038 USD（非账单）。20 条均有唯一 Response ID 和唯一原始响应哈希，运行前后冻结文件哈希一致。

当前正式证据保存在 `results/2026-09-06-openai-regression-v2-r4.json`、同名 Markdown 报告和 `results/2026-09-06-openai-regression-v2-r4-review.md`。人工逐条复核与自动判断一致，改分 0 条。WO-13 已保留四个 8 次完成组、使用 `weight: 0` 待编辑占位并提示补充实际重量；其他 19 条没有规则回归。

r3 仍保留为修复前的 7/8 基线，不能回写。r4 使用新的 Run ID 和修正后 Prompt 得到独立的 8/8 证据。人工复核另记录 WO-18 的非阻断观察：平板支撑结构正确，但额外显示了缺重量提示，后续真人测试应观察是否造成困惑。

## 首次 V2 尝试：中止并保留 partial

- Run ID：`2026-09-05-openai-regression-v2`。
- 策略：严格按 WO-01 起顺序执行，每题一次；评测器重试 0，OpenAI SDK `maxRetries: 0`、超时 110 秒，runner 单请求超时 120 秒。
- 进度：共发出 14 次请求并在 WO-14 后中止；WO-15～20 没有运行，因此尤其没有 WO-15 / WO-18 的付费回归结论。
- 证据：WO-01～13 各有 Response ID、Request ID 和 usage；WO-14 的旧 500 响应没有这些模型元数据。检查点保存在 `results/2026-09-05-openai-regression-v2.partial.json`。
- 前 13 条已知 usage 小计：input 13,445、cached input 0、output 4,857（含 reasoning 3,136）、total 18,302 token。按 [OpenAI 官方 GPT-5 Mini 文本价格](https://developers.openai.com/api/docs/models/gpt-5-mini)估算为 $0.013075 USD；这只是可核算部分，不是账单，也不是 14 次请求或完整 20 条的总成本。WO-14 usage 与整次尝试总成本不可得。

WO-14 的输入能确定“卧推 60kg”，但没有组数和次数。旧 Schema 允许 `reps: null` 与 `durationSeconds: null` 同时出现，因此模型生成一个空壳 set；运行时 validator 拒绝后，旧接口以 500 返回并丢失 `meta`，runner 因缺少 Response ID 证据而 fatal。这个 partial 对应的关键代码哈希也与修正后的代码不同，不能续跑、补写或当作当前实现的质量成绩。

## 第二次 V2 尝试：本机网络路径中止

- Run ID：`2026-09-06-openai-regression-v2-r2`。
- 进度：WO-01～03 均为 `direct`；WO-04 返回 HTTP 500 `Connection error`，无 Response ID，runner 在第 4 次请求后中止且没有重试。
- 已知用量：前三条 input 3,418、cached input 2,048、output 1,198（含 reasoning 640）、total 4,616 token，估算 $0.002790 USD。WO-04 没有 provider metadata，计费状态不可核实，以上不是整次尝试总成本。
- 证据：`results/2026-09-06-openai-regression-v2-r2.partial.json`。

诊断发现系统 DNS/直连 443 路径异常，但本机代理访问 OpenAI API 能返回预期的无密钥 HTTP 401。`.env.local` 已有 `OPENAI_PROXY_URL`，旧代码却只在 API key 缺失时加载该文件；Vercel 注入 key 后，代理配置因而没有进入函数进程。当前 `api/_lib/openai.ts` 会补载缺失的本地代理配置，并恢复宿主环境中已经显式提供的值，使宿主配置继续优先。该代理修复随后支持 r3 完整跑完 20 条；它不改变 r2 仍是中止记录的事实。

## 历史基线

V1 正式运行 `2026-09-05-openai-baseline-v1` 使用当时保存的 Prompt/source 快照，每条用例首次调用一次、无重试：

- 核心题 12/12 直接通过，核心字段 153/153 正确。
- 边界题 6/8 通过。
- 20/20 HTTP 200 且符合当时的严格 Schema。
- WO-15 失败：输入只说“跑了一会儿”，却生成可保存的 `minutes: 1`。
- WO-18 失败：平板支撑 30 秒被写成 `reps: 30`。

完整证据仍保存在 `../v1/results/2026-09-05-openai-baseline-v1.json`、同名 Markdown 报告、人工复核和 `../v1/snapshot/`，不得用 V2 文件覆盖。

## V2 已实现的修复

- AI 力量组 Schema 用嵌套 `anyOf` 定义次数组与计时组两个精确键分支：`reps` / `durationSeconds` 必须一项为正整数、另一项严格为 `null`。服务端运行时 validator 对根级、条目级和 set 级执行相同的精确键要求。
- Prompt 明确把平板支撑等计时动作换算成 `durationSeconds`，禁止把秒数放进 `reps`。
- 动作已知但组数或次数/时长缺失时，Prompt 要求保留动作、返回 `sets: []` 并写明缺失信息，不再生成两个目标都为 `null` 的空壳 set。
- AI 有氧预览允许 `minutes: null`；Prompt 禁止为“跑了一会儿”等输入制造最小分钟数。
- 预览保存校验要求用户补全 1–1440 分钟；力量动作没有有效组、组未完成或数值越界时也会阻止写入。
- 计时组在记录页按秒展示，并且不进入 `weight × reps` 训练容量。
- AI 结果与当天同名力量动作冲突时，用户必须选择追加、替换或返回编辑，选择前不会发生部分写入。
- 4 个 AI 端点在已经取得可核实模型 Response 后，空输出/JSON 解析失败返回 422 + `MODEL_OUTPUT_PARSE_FAILED` + `meta`，运行时结构失败返回 422 + `MODEL_OUTPUT_VALIDATION_FAILED` + `meta`；尚未取得 Response 的网络/供应商错误仍为 500，不保证有 `meta`。

## V2 回归工具

- `cases.jsonl`：20 条 V2 合约用例；核心题的次数组都显式包含 `durationSeconds: null`。
- `RUBRIC.md`：V2 结构、核心字段计分和 8 条边界规则。
- `scripts/run-workout-eval-v2.mjs`：顺序执行 20 条、每题一次、无评测器重试，并保存检查点、源码/数据集哈希、完整响应、模型、usage、延迟和成本估算。422 且有 Response ID 时把该题计为失败并继续；网络/上游、其他非成功 HTTP 或缺少证据时才 fatal。

WO-15 的通过标准是保留跑步条目、`minutes: null`、距离和心率不编造，并在 `uncertain` 明确提示补充时长。WO-18 的通过标准是 3 个 `weight: 0, reps: null, durationSeconds: 30, done: true` 的计时组。

离线检查不会访问本地 API 或 OpenAI：

```powershell
npm run eval:workout:v2 -- --validate-only
npm run check:ai-contracts
```

当前本地证据：20 条用例成功装载、47 项评分器自检通过、`network_requests=0`；补充“仅缺重量的次数/计时、同时缺重量和次数、单位不明、自重动作”样例后，AI 运行时合约固定样例检查为 18/18，API guard 为 10/10。这些离线数字不是模型通过率；模型成绩以正式结果为准。

未带 `--live` 时，运行器会在网络请求前退出。`npm run eval:workout` 是 V1 兼容入口，不代表当前版本；获得新的费用授权后，V2 完整命令是：

```powershell
npm run eval:workout:v2 -- --live --base-url http://127.0.0.1:3000 --run-id <unique-v2-run-id>
```

正式运行会在首个请求前冻结关键源码、Prompt、数据集和 Rubric 哈希，在完整结束时再次核对；只有 20 条证据齐全且哈希未变才会生成正式 JSON / Markdown 成绩。r3 已满足该条件；前两次 partial 仍不能满足。

## 下一次正式回归的前置条件

1. 获得新的 20 次付费调用授权；既有授权不自动延伸到下一次完整运行。
2. 使用全新的唯一 V2 Run ID 从 WO-01 完整运行 20 条；不能续写或追加到现有 partial，也不能覆盖 V1。
3. 使用修正后的 Prompt 重新验证 WO-13 时，逐条人工浏览原始响应并另存复核结论；任何人工覆盖都写明原因。
4. 保存实际模型、源码/Prompt hash、原始响应、Response ID、usage、延迟和成本估算。
5. 真人预览编辑率、修正耗时和最终保存一致性必须通过真实交互另行测量，继续标记为 `NOT_MEASURED`，不能由 API 对照评分推断。
