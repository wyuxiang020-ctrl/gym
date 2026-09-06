# Gym 训练解析正式回归 v2

## 状态与范围

本套件评估 `POST /api/parse-workout` 的 V2 单轮解析合约。20 条均为合成输入，不代表 20 位用户、真实训练建议或外部用户研究。每题由评测器发送一次请求，评测器不重试；UI 编辑、保存流程和真人行为指标需要另外测试。

截至 2026-09-06，本套件已有完整正式结果 `2026-09-06-openai-regression-v2-r3`：20/20 次顺序请求完成且无重试，核心题 12/12 直接可用、核心字段 182/182、边界题 7/8、结构有效 20/20。原始 JSON、Markdown 报告和人工复核均保存在 `results/`；人工改分 0 条。

此前 `2026-09-05-openai-regression-v2` 在 WO-14 后中止，`2026-09-06-openai-regression-v2-r2` 在 WO-04 遇到无 Response ID 的连接错误后中止，两者都只保留 `.partial.json`，不能续写或合并到 r3。r3 唯一失败为 WO-13；正式结果保存后，Prompt 已补充仅重量缺失时保留已知组次的规则，但该后续修复尚未用新 Run ID 重新验证。

## 与 V1 的隔离

- V1 的数据集、运行器、正式结果、人工复核和源码快照全部保留，不由 V2 文件覆盖。
- V2 使用独立的 `cases.jsonl`、`scripts/run-workout-eval-v2.mjs`、Run ID 和 `results/` 输出。
- V2 的力量组同时包含 `reps` 与 `durationSeconds`；两者必须一项为正整数、另一项严格为 `null`。
- V2 的有氧 `minutes` 允许为正数或 `null`。`null` 只表示待用户补充的预览状态，不等于可直接保存。
- 当前 20 条数据集 / 47 项评分器离线自检通过且 `network_requests=0`，AI 运行时合约固定样例检查为 14/14、API guard 为 10/10；它们都不是模型质量成绩。

## 运行与防误付费

离线检查不会访问本地接口或 OpenAI：

```powershell
npm run eval:workout:v2 -- --validate-only
```

没有 `--live` 时，运行器会在发出任何请求前退出。新的完整 20 条正式回归只有在另获付费调用授权后，才能使用全新 Run ID 从 WO-01 运行；不能续写现有 partial：

```powershell
npm run eval:workout:v2 -- --live --base-url http://127.0.0.1:3000 --run-id <unique-v2-run-id>
```

正式运行固定为 20 条、顺序执行、每题一次、评测器不重试；OpenAI SDK 同时固定 `maxRetries: 0`、110 秒超时，而评测器本地超时为 120 秒。HTTP 422 且带 Response ID 表示模型调用已有证据：该题判失败、保留在分母并继续；网络/上游异常、其他非成功 HTTP，或 422 / 2xx 缺少 Response ID 时才 fatal 并中止。中断时保留 `.partial.json` 检查点；完成后写入同名 JSON 与 Markdown，并删除检查点。已有 Run ID 不会被覆盖。关键源码哈希在首个请求前冻结，结束时再次核对；运行期间变化则结果无效并保留检查点。

## V2 结构有效条件

- 根级必须有 `strength` 与 `cardio` 数组。
- 根级、力量/有氧条目和力量 set 都不得缺少或增加 Schema 之外的键；服务端运行时 validator 使用相同精确键规则。
- 每个力量动作必须有非空 `name`、`sets` 数组、字符串 `note` 和字符串数组 `uncertain`。动作已知但组数或次数/时长缺失时允许 `sets: []`，并由边界题检查缺失提示；不得生成 null/null 空壳组。
- 每个非空 set 必须精确包含 `weight`、`reps`、`durationSeconds`、`done`，其中 `weight` 为非负有限数、`done` 为布尔值，并满足嵌套 `anyOf` 定义的二选一：
  - 次数组：`reps` 为至少 1 的整数，`durationSeconds === null`；
  - 计时组：`reps === null`，`durationSeconds` 为至少 1 的整数。
- 每个有氧项目必须有非空 `type`、`minutes`（至少 1 的有限数或 `null`）、`distance`、`avgHr`、`intensity`、`note` 与 `uncertain`。
- 评分器同步检查服务端上限：力量动作 30 项、有氧 10 项、每个动作 50 组、重量 1000kg、次数 1000、计时 86400 秒、有氧 1440 分钟、距离 1000km、平均心率 250，以及名称、备注和不确定项的长度限制。
- 接口失败或结构无效时，题目仍留在分母中并判为失败。

## 核心题 WO-01 至 WO-12

字段分母预先固定：

- 根级 `strength` 数量和 `cardio` 数量各 1 分。
- 每个力量动作：语义动作名 1 分、组数 1 分、每组 `weight` / `reps` / `durationSeconds` / `done` 各 1 分。
- 每个有氧项目：`type` / `minutes` / `intensity` / `distance` / `avgHr` 各 1 分。
- 重量允许 ±0.1kg；次数、秒数、组数和其他明确值必须精确。
- 合理动作同义词可得语义分，但另报 `plan_name_exact_match`，不把语义正确冒充成能直接按字符串并入计划。
- `note` 和 `uncertain` 是保护字段，不计入核心字段分；多余动作、有氧或组数单独记录。

自动判定：

- `direct`：字段满分且无多余动作、项目或组。
- `partial`：结构有效、主体动作仍可用、字段得分至少 75%，但需要局部编辑。
- `fail`：接口或结构失败，字段低于 75%，或主要记录需要重建。

## 边界题 WO-13 至 WO-20

- WO-13：只允许保留一个语义为卧推的力量条目，不得有有氧或额外动作；必须保留原文已知的 4 组 × 8 次和 `done: true`，重量统一用 0 作为待编辑占位；该条目的 `note/uncertain` 必须在同一语义片段同时提及重量和缺失/未知/待补充语义。仅写“重量已确认”或借用其他字段的“未知”不能通过。
- WO-14：只允许保留一个语义为卧推且 `sets` 为空的力量条目，不得有有氧或额外动作；该条目必须同时明确组数与次数缺失，不能把提示写到其他动作，也不能补造已完成组。
- **WO-15（V2 关键回归）**：必须保留一个跑步有氧条目，`minutes === null`、距离和心率为 `null`，未提及强度时按产品规则为 `mid`，并在该条目的 `note/uncertain` 同时提及时长和缺失/未知/待补充语义。空结果、任何编造的正时长或“时间已确认，无需补充”等反向语义都失败。
- WO-16：力量与有氧都为空才通过。
- WO-17：必须得到 4 组 8/8/8/6，且均为次数组。
- **WO-18（V2 关键回归）**：必须保留一个平板支撑动作、恰好 3 组；每组 `weight: 0`、`reps: null`、`durationSeconds: 30`、`done: true`。空结果或把 30 秒放进次数/重量都失败。
- WO-19：空结果可通过；若保留内容，只允许一个语义为卧推的力量条目且不得有有氧，必须保留原文已知的 4 组 × 8 次和 `done: true`，四组重量必须一致为 0（待编辑占位）或 60（保留原数字待确认）；并在同一语义片段同时提及单位和缺失/未知/待补充语义。仅写“单位已确认为 kg”或借用次数的“未知”不能通过。
- WO-20：空结果可通过；若保留计划内容，只允许一个卧推条目，必须精确保留 4 组、每组 60kg × 8 次且全部 `done: false`，不能写成已完成训练或生成额外项目。

边界题只报告 `pass/fail`，不混入核心题直接可用率。

## 留痕与指标边界

正式结果记录首个请求前的 Git HEAD 与 dirty 文件、数据集和关键源码 SHA-256，并在结束时验证源码未变化；同时记录完整接口响应或错误、HTTP 状态、延迟、实际模型、SDK 重试/超时配置、Response / Request ID、usage、原始响应哈希和逐题评分理由。API key 与代理凭据会被脱敏。模型 Response 已取得但输出为空/JSON 解析失败时，端点应返回 422 + `MODEL_OUTPUT_PARSE_FAILED` + `meta`；运行时结构失败应返回 422 + `MODEL_OUTPUT_VALIDATION_FAILED` + `meta`。尚未取得可核实 Response 的供应商/网络失败仍为 500，不保证有 `meta`。

汇总包含核心直接可用率、局部修正率、失败率、字段准确率、边界通过率、结构有效率、动作名精确匹配、延迟、token 和按运行时记录单价计算的估算成本。成本是估算，不是账单。

`observed_preview_edit_rate`、`median_correction_time` 与 `final_saved_record_consistency` 固定标为 `NOT_MEASURED`，不得由 API 对照分数推断真人表现。正式结果仍需逐条人工浏览原始响应；人工覆盖必须另写原因。
