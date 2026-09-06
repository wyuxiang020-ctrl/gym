# Gym 训练解析正式回归结果 v2

- Run ID: `2026-09-06-openai-regression-v2-r4`
- 时间: 2026-09-06T07:01:47.324Z — 2026-09-06T07:04:08.599Z
- 产品快照: HEAD `5085274910049645212c70dca09ea35dc1a93e77`, dirty=true
- 数据集 SHA-256: `e90ce00eb894edb06d58dd736f0142ee8f3b34f3113f07b1d606d077009baa19`
- Prompt/source SHA-256: `8d6a87e2847e558a59955dda0e6f950dd0f05885e3f90acb116b12a39bbb4c43`
- 实际模型: `gpt-5-mini-2025-08-07`
- SDK 自动重试上限: 0；SDK 超时: 110000ms
- 环境: Node v24.16.0; win32 x64; local Vercel dev; Codex synthetic runner v2

## 汇总

- 核心题直接可用: 12/12 (100.0%)
- 核心题局部修正: 0/12 (0.0%)
- 核心题失败: 0/12 (0.0%)
- 核心字段准确率: 182/182 (100.0%)
- 边界处理通过: 8/8 (100.0%)
- 结构有效: 20/20 (100.0%)
- 延迟: 中位 6405ms，范围 3755–14421ms
- Token: input 24572，cached 21888，output 8910，reasoning 6400，total 33482
- 估算成本: $0.019038 USD（按运行时记录单价估算，非账单）
- Response ID: 20 条，唯一 20 条；唯一响应哈希 20 条
- 真人预览编辑率、修正耗时、最终保存一致性: NOT_MEASURED

## 逐题结果

| 用例 | 分组 | HTTP | 结构有效 | 判定 | 延迟ms | 规则判定说明 |
|---|---|---:|---|---|---:|---|
| WO-01 | core | 200 | 是 | direct | 14421 | 20/20 |
| WO-02 | core | 200 | 是 | direct | 6490 | 20/20 |
| WO-03 | core | 200 | 是 | direct | 6358 | 26/26 |
| WO-04 | core | 200 | 是 | direct | 4756 | 16/16 |
| WO-05 | core | 200 | 是 | direct | 4361 | 16/16 |
| WO-06 | core | 200 | 是 | direct | 5932 | 12/12 |
| WO-07 | core | 200 | 是 | direct | 5126 | 16/16 |
| WO-08 | core | 200 | 是 | direct | 6074 | 12/12 |
| WO-09 | core | 200 | 是 | direct | 6078 | 7/7 |
| WO-10 | core | 200 | 是 | direct | 7005 | 17/17 |
| WO-11 | core | 200 | 是 | direct | 6452 | 12/12 |
| WO-12 | core | 200 | 是 | direct | 4465 | 8/8 |
| WO-13 | boundary | 200 | 是 | pass | 6565 | 只保留4组8次卧推，使用0占位且在该条目明确提示重量缺失 |
| WO-14 | boundary | 200 | 是 | pass | 10613 | 只保留卧推动作但不造组，并在该条目提示组数/次数缺失 |
| WO-15 | boundary | 200 | 是 | pass | 5983 | 保留跑步，minutes为null且明确提示补充时长 |
| WO-16 | boundary | 200 | 是 | pass | 3755 | 休息语义返回空记录 |
| WO-17 | boundary | 200 | 是 | pass | 6690 | 更正后为4个次数组8/8/8/6 |
| WO-18 | boundary | 200 | 是 | pass | 9384 | 平板支撑正确保留为3个30秒计时组 |
| WO-19 | boundary | 200 | 是 | pass | 12042 | 返回空结果，或只保留4组8次卧推并在该条目明确提示重量单位缺失 |
| WO-20 | boundary | 200 | 是 | pass | 8327 | 返回空结果，或只保留4组未完成的卧推计划 |

## 解释边界

本轮为一次、合成、API parse-only 回归。评测器每题只发一个请求且不重试。它不代表外部用户表现、线上 SLA、真实保存流程或健康结果。原始接口响应保存在同名 JSON 的 `records[].raw_response_or_error`。
