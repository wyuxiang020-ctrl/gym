# Gym 训练解析正式评测结果

- Run ID: `2026-09-05-openai-baseline-v1`
- 时间: 2026-09-05T04:45:04.948Z — 2026-09-05T04:47:03.325Z
- 产品快照: HEAD `d5d853b1e1006ed38946226a6180d0b7d00c47f6`, dirty=true
- 数据集 SHA-256: `9af47539e9bd41f86e60f2c79d2783b0f27da3492b7453740d3115a5f530c603`
- Prompt/source SHA-256: `bfa004ea6e0f8d9bab07ec1782aeef15fdbc6f78b87826357b7593631a3b4d4b`
- 实际模型: `gpt-5-mini-2025-08-07`
- 环境: Node v24.16.0; win32 x64; local Vercel dev; local proxy; Codex synthetic runner

## 汇总

- 核心题直接可用: 12/12 (100.0%)
- 核心题局部修正: 0/12 (0.0%)
- 核心题失败: 0/12 (0.0%)
- 核心字段准确率: 153/153 (100.0%)
- 边界处理通过: 6/8 (75.0%)
- 结构有效: 20/20 (100.0%)
- 延迟: 中位 5290ms,范围 2793–10423ms
- Token: input 15332,cached 0,output 7242,reasoning 4864,total 22574
- 估算成本: $0.018317 USD（非账单）
- 真人预览编辑率、修正耗时、最终保存一致性: NOT_MEASURED
- 人工复核: 20/20 已读，自动判定改写 0 条；见 `2026-09-05-openai-baseline-v1-review.md`

## 逐题结果

| 用例 | 分组 | HTTP | 结构有效 | 判定 | 延迟ms | 规则判定说明 |
|---|---|---:|---|---|---:|---|
| WO-01 | core | 200 | 是 | direct | 4687 | 16/16 |
| WO-02 | core | 200 | 是 | direct | 4524 | 16/16 |
| WO-03 | core | 200 | 是 | direct | 7042 | 21/21 |
| WO-04 | core | 200 | 是 | direct | 3860 | 13/13 |
| WO-05 | core | 200 | 是 | direct | 5314 | 13/13 |
| WO-06 | core | 200 | 是 | direct | 4311 | 10/10 |
| WO-07 | core | 200 | 是 | direct | 4857 | 13/13 |
| WO-08 | core | 200 | 是 | direct | 5266 | 10/10 |
| WO-09 | core | 200 | 是 | direct | 3853 | 7/7 |
| WO-10 | core | 200 | 是 | direct | 5865 | 15/15 |
| WO-11 | core | 200 | 是 | direct | 4518 | 12/12 |
| WO-12 | core | 200 | 是 | direct | 5377 | 7/7 |
| WO-13 | boundary | 200 | 是 | pass | 7824 | 使用0占位且明确提示重量缺失 |
| WO-14 | boundary | 200 | 是 | pass | 7158 | 保留动作但不造组,并提示组数/次数缺失 |
| WO-15 | boundary | 200 | 是 | fail | 8776 | 为无时长输入编造了可保存的有氧事实 |
| WO-16 | boundary | 200 | 是 | pass | 2793 | 休息语义返回空记录 |
| WO-17 | boundary | 200 | 是 | pass | 4792 | 更正后为4组8/8/8/6 |
| WO-18 | boundary | 200 | 是 | fail | 8149 | 把30秒写成了可保存的次数或重量 |
| WO-19 | boundary | 200 | 是 | pass | 8960 | 未静默确认缺失的重量单位 |
| WO-20 | boundary | 200 | 是 | pass | 10423 | 没有把未来计划写成已完成 |

## 解释边界

本轮为一次、合成、API parse-only 评测。它不代表外部用户表现、线上 SLA、真实保存流程或健康结果。原始接口响应保存在同名 JSON 的 `records[].raw_response_or_error`。
