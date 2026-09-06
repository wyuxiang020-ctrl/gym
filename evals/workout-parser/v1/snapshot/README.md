# Baseline evaluated-source snapshot

这三个文件是 `2026-09-05-openai-baseline-v1` 实际调用时的服务端关键源码副本。因为当时工作区基于 Git HEAD `d5d853b1e1006ed38946226a6180d0b7d00c47f6` 且存在未提交修改，单独记录 commit 无法重建被测版本；后续 V2 修复会继续修改工作区，所以在这里保留逐字节快照。

| 快照文件 | 对应源码 | SHA-256 |
|---|---|---|
| `api-parse-workout.ts.txt` | `api/parse-workout.ts` | `bfa004ea6e0f8d9bab07ec1782aeef15fdbc6f78b87826357b7593631a3b4d4b` |
| `api-_lib-openai.ts.txt` | `api/_lib/openai.ts` | `9a14843ef9afe98038ebf660b22416e9aafd9ee2ebe7afe3f89b47e7633b724f` |
| `api-_lib-validate.ts.txt` | `api/_lib/validate.ts` | `c752ec95a26be3b5fe1b9bfa82a0f5c8506dfe32ac08e1f98dcdefcff8b9fc6f` |

这些哈希与正式结果 JSON 的 `product_snapshot.file_hashes` 一致。扩展名使用 `.txt`，避免构建工具把快照当成当前可执行源码。
