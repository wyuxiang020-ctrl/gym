# Gym 训练解析正式回归结果 v2

- Run ID: `2026-09-06-openai-regression-v2-r3`
- 时间: 2026-09-06T03:43:00.725Z — 2026-09-06T03:44:57.351Z
- 产品快照: HEAD `d5d853b1e1006ed38946226a6180d0b7d00c47f6`, dirty=true
- 数据集 SHA-256: `e90ce00eb894edb06d58dd736f0142ee8f3b34f3113f07b1d606d077009baa19`
- Prompt/source SHA-256: `5c8bafcc034d0d829e16db74947c4b3644141c9450741ba4859db6765fd5150f`
- 实际模型: `gpt-5-mini-2025-08-07`
- SDK 自动重试上限: 0；SDK 超时: 110000ms
- 环境: Node v24.16.0; win32 x64; local Vercel dev; Codex synthetic runner v2

## 汇总

- 核心题直接可用: 12/12 (100.0%)
- 核心题局部修正: 0/12 (0.0%)
- 核心题失败: 0/12 (0.0%)
- 核心字段准确率: 182/182 (100.0%)
- 边界处理通过: 7/8 (87.5%)
- 结构有效: 20/20 (100.0%)
- 延迟: 中位 5327.5ms，范围 2514–12632ms
- Token: input 22712，cached 19456，output 8917，reasoning 6400，total 31629
- 估算成本: $0.019134 USD（按运行时记录单价估算，非账单）
- Response ID: 20 条，唯一 20 条；唯一响应哈希 20 条
- 真人预览编辑率、修正耗时、最终保存一致性: NOT_MEASURED

## 逐题结果

| 用例 | 分组 | HTTP | 结构有效 | 判定 | 延迟ms | 规则判定说明 |
|---|---|---:|---|---|---:|---|
| WO-01 | core | 200 | 是 | direct | 11724 | 20/20 |
| WO-02 | core | 200 | 是 | direct | 5254 | 20/20 |
| WO-03 | core | 200 | 是 | direct | 7234 | 26/26 |
| WO-04 | core | 200 | 是 | direct | 5299 | 16/16 |
| WO-05 | core | 200 | 是 | direct | 4089 | 16/16 |
| WO-06 | core | 200 | 是 | direct | 3515 | 12/12 |
| WO-07 | core | 200 | 是 | direct | 4560 | 16/16 |
| WO-08 | core | 200 | 是 | direct | 4332 | 12/12 |
| WO-09 | core | 200 | 是 | direct | 4391 | 7/7 |
| WO-10 | core | 200 | 是 | direct | 5803 | 17/17 |
| WO-11 | core | 200 | 是 | direct | 12632 | 12/12 |
| WO-12 | core | 200 | 是 | direct | 3444 | 8/8 |
| WO-13 | boundary | 200 | 是 | fail | 6438 | 存在多余项目、已知组次/完成状态被改写、猜测正重量、丢失卧推或缺失提示未绑定卧推条目 |
| WO-14 | boundary | 200 | 是 | pass | 5356 | 只保留卧推动作但不造组，并在该条目提示组数/次数缺失 |
| WO-15 | boundary | 200 | 是 | pass | 6110 | 保留跑步，minutes为null且明确提示补充时长 |
| WO-16 | boundary | 200 | 是 | pass | 2514 | 休息语义返回空记录 |
| WO-17 | boundary | 200 | 是 | pass | 4677 | 更正后为4个次数组8/8/8/6 |
| WO-18 | boundary | 200 | 是 | pass | 6431 | 平板支撑正确保留为3个30秒计时组 |
| WO-19 | boundary | 200 | 是 | pass | 5372 | 返回空结果，或只保留4组8次卧推并在该条目明确提示重量单位缺失 |
| WO-20 | boundary | 200 | 是 | pass | 7107 | 返回空结果，或只保留4组未完成的卧推计划 |

## 解释边界

本轮为一次、合成、API parse-only 回归。评测器每题只发一个请求且不重试。它不代表外部用户表现、线上 SLA、真实保存流程或健康结果。原始接口响应保存在同名 JSON 的 `records[].raw_response_or_error`。
