# Gym 饮食 AI 正式评测：2026-09-06-openai-food-baseline-v1

> 本次 35 条均为合成数据，不代表真实用户、真实摄入量或医学结论。图片 direct 仅表示可进入人工确认。

## 汇总

| 模态 | 数量 | Direct | Partial | Fail | 语义召回 | 语义精确率 | 硬检查准确率 |
|---|---:|---:|---:|---:|---:|---:|---:|
| text | 15 | 14 | 0 | 1 | 96.0% | 96.0% | 96.7% |
| recalc | 10 | 5 | 5 | 0 | 100.0% | 100.0% | 87.8% |
| photo | 10 | 7 | 3 | 0 | 90.6% | 87.9% | 92.9% |
| overall | 35 | 26 | 8 | 1 | 94.7% | 93.5% | 92.0% |

- 结构有效：35/35
- 延迟：median 10001ms，p95 20281ms
- Token：48882（input 22533 / output 26349 / reasoning 21376）
- 估算成本：$0.058331；不是账单
- 真人指标：NOT_MEASURED

## 逐题

| Case | 模态 | 判定 | 语义命中 | 硬检查 | 延迟 ms | 问题 |
|---|---|---|---:|---:|---:|---|
| FT-01 | text | direct | 3/3 | 6/6 | 11583 | — |
| FT-02 | text | direct | 3/3 | 7/7 | 10063 | — |
| FT-03 | text | direct | 2/2 | 3/3 | 15934 | — |
| FT-04 | text | fail | 1/2 | 1/3 | 8937 | 缺少:拿铁；多余项目:拿铁（牛奶咖啡），允许0项 |
| FT-05 | text | direct | 2/2 | 5/5 | 10749 | — |
| FT-06 | text | direct | 3/3 | 7/7 | 14105 | — |
| FT-07 | text | direct | 0/0 | 1/1 | 3742 | — |
| FT-08 | text | direct | 0/0 | 1/1 | 3275 | — |
| FT-09 | text | direct | 1/1 | 3/3 | 6491 | — |
| FT-10 | text | direct | 2/2 | 5/5 | 7561 | — |
| FT-11 | text | direct | 1/1 | 3/3 | 7977 | — |
| FT-12 | text | direct | 2/2 | 3/3 | 20281 | — |
| FT-13 | text | direct | 2/2 | 4/4 | 14112 | — |
| FT-14 | text | direct | 1/1 | 3/3 | 5346 | — |
| FT-15 | text | direct | 1/1 | 6/6 | 6888 | — |
| FR-01 | recalc | partial | 2/2 | 6/7 | 6108 | 米饭未逐字段保持原值 |
| FR-02 | recalc | direct | 3/3 | 10/10 | 7985 | — |
| FR-03 | recalc | partial | 2/2 | 4/6 | 6208 | 希腊酸奶未逐字段保持原值；草莓未逐字段保持原值 |
| FR-04 | recalc | direct | 1/1 | 4/4 | 5240 | — |
| FR-05 | recalc | direct | 2/2 | 7/7 | 6085 | — |
| FR-06 | recalc | partial | 2/2 | 6/8 | 10912 | 全脂牛奶仍存在；燕麦未逐字段保持原值 |
| FR-07 | recalc | partial | 2/2 | 5/7 | 7019 | 苹果未逐字段保持原值；花生酱未逐字段保持原值 |
| FR-08 | recalc | direct | 1/1 | 7/7 | 5074 | — |
| FR-09 | recalc | direct | 1/1 | 8/8 | 4420 | — |
| FR-10 | recalc | partial | 3/3 | 8/10 | 8413 | 鸡胸肉未逐字段保持原值；西兰花未逐字段保持原值 |
| FP-01 | photo | direct | 3/3 | 4/4 | 10001 | — |
| FP-02 | photo | direct | 4/4 | 5/5 | 15167 | — |
| FP-03 | photo | direct | 3/3 | 4/4 | 14921 | — |
| FP-04 | photo | partial | 2/3 | 3/4 | 16978 | 缺少:格兰诺拉 |
| FP-05 | photo | partial | 2/3 | 3/4 | 13482 | 缺少:糙米饭 |
| FP-06 | photo | direct | 3/3 | 4/4 | 13432 | — |
| FP-07 | photo | direct | 4/4 | 5/5 | 13750 | — |
| FP-08 | photo | direct | 3/3 | 4/4 | 14345 | — |
| FP-09 | photo | direct | 3/3 | 4/4 | 14357 | — |
| FP-10 | photo | partial | 2/3 | 3/4 | 21687 | 缺少:糙米饭 |

## 可复现证据

- 实际模型：gpt-5-mini-2025-08-07
- Git HEAD：1fe33faebc176e67047f94730a9c0904da339f94
- 运行前工作区：dirty（已记录文件清单）
- 数据集 SHA-256：b2f1c44c67c2684409a47770b09d8623283221efb554b372e68f3af8204958a0
- SDK 重试：0；执行方式：串行；请求数：35/35
- 运行期间关键源码与图片哈希保持不变：是
- 定价核对：2026-09-06，https://developers.openai.com/api/docs/models/gpt-5-mini
