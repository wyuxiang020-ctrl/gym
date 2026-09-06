# Gym 饮食 AI 正式评测：2026-09-06-openai-food-recalc-prompt-v2

> 本次 10 条均为合成数据，不代表真实用户、真实摄入量或医学结论。本轮只覆盖重算，不是 35 条全量重跑。

## 汇总

| 模态 | 数量 | Direct | Partial | Fail | 语义召回 | 语义精确率 | 硬检查准确率 |
|---|---:|---:|---:|---:|---:|---:|---:|
| text | 0 | 0 | 0 | 0 | N/A | N/A | N/A |
| recalc | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% |
| photo | 0 | 0 | 0 | 0 | N/A | N/A | N/A |
| overall | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% |

- 结构有效：10/10
- 延迟：median 9165ms，p95 14754ms
- Token：9534（input 5280 / output 4254 / reasoning 3136）
- 估算成本：$0.009828；不是账单
- 真人指标：NOT_MEASURED

## 逐题

| Case | 模态 | 判定 | 语义命中 | 硬检查 | 延迟 ms | 问题 |
|---|---|---|---:|---:|---:|---|
| FR-01 | recalc | direct | 2/2 | 7/7 | 7748 | — |
| FR-02 | recalc | direct | 3/3 | 10/10 | 8446 | — |
| FR-03 | recalc | direct | 2/2 | 6/6 | 8864 | — |
| FR-04 | recalc | direct | 1/1 | 4/4 | 9870 | — |
| FR-05 | recalc | direct | 2/2 | 7/7 | 13453 | — |
| FR-06 | recalc | direct | 2/2 | 8/8 | 13059 | — |
| FR-07 | recalc | direct | 2/2 | 7/7 | 8741 | — |
| FR-08 | recalc | direct | 1/1 | 7/7 | 12270 | — |
| FR-09 | recalc | direct | 1/1 | 8/8 | 9165 | — |
| FR-10 | recalc | direct | 3/3 | 10/10 | 14754 | — |

## 可复现证据

- 实际模型：gpt-5-mini-2025-08-07
- Git HEAD：1fe33faebc176e67047f94730a9c0904da339f94
- 运行前工作区：dirty（已记录文件清单）
- 数据集 SHA-256：b2f1c44c67c2684409a47770b09d8623283221efb554b372e68f3af8204958a0
- SDK 重试：0；执行方式：串行；请求数：10/10
- 运行期间关键源码与图片哈希保持不变：是
- 定价核对：2026-09-06，https://developers.openai.com/api/docs/models/gpt-5-mini
