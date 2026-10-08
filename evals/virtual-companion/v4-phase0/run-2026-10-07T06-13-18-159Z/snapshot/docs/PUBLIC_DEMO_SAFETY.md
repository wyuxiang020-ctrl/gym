# Gym 公开演示保护

## 当前激活状态（2026-09-06）

- Vercel Marketplace 免费 Redis `gym-ai-safety` 已创建并连接 Development、Preview、Production；区域为 `sin1`，自动升级关闭。
- Marketplace 已自动注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN` 等连接变量，代码兼容这组名称。
- 非敏感的分钟限额、每日次数、每日预算、单次预留和告警阈值已配置。
- `OPENAI_API_KEY`、`GYM_DEMO_ACCESS_CODE`、`AI_AUDIT_HASH_SALT` 已按用户授权作为 Secret 写入三个环境；文档不记录实际值。
- Preview `https://gym-ri1ngrd2q-yuxiang-wang-s-projects.vercel.app` 已部署并完成真实 happy-path 验证；Production 尚未发布。

### Preview 验证记录

- 无访问码与错误访问码各发起一次 `POST /api/parse-meal`，Vercel 请求日志确认两次均为 HTTP 401，模型没有被调用。
- 正确访问码发起一次相同接口请求，Vercel 请求日志为 HTTP 200；页面收到“水 250g、0 kcal、把握高”的可编辑结果，并继续要求用户确认后才写入。
- Upstash 只读核验显示当日 `requests=1`、`reserved_micro_usd=0`、`spent_micro_usd=513`、`audit_events=1`；最新审计为 `parse-meal / 200 / success / gpt-5-mini-2025-08-07`，有 Response ID、538 total tokens，客户端标识为 24 位哈希。
- 本次部署最近 30 分钟没有 error-level 运行日志。429 超限和 503 fail-closed 没有通过修改线上配置做故障注入；它们由 18/18 固定安全检查覆盖，不能表述为 Preview 实测。

## 已实现

四个 AI 接口共用同一层服务端保护：

1. **共享访问码**：浏览器只在当前标签页的 `sessionStorage` 保存用户输入，随请求通过 `X-Gym-Access-Code` 发送；真实访问码只存在服务端环境变量。比较采用固定长度 SHA-256 后的 constant-time compare。
2. **跨实例限流**：生产与预览环境要求 Upstash Redis REST。按脱敏后的客户端标识限制每分钟请求数，并设置全局每日请求上限。
3. **预算预留与提醒**：每次调用先预留一笔最大估算成本，防止并发请求同时越过日预算；完成后释放预留并按模型 usage 写入实际估算成本。若上游失败且拿不到 usage，则把整笔预留保守计为成本。默认达到 80% 时只提醒一次；配置 webhook 后发送不含用户内容的 JSON，否则写入服务端 warning log。
4. **脱敏审计**：只记录时间、route、哈希客户端、状态、outcome、模型、Response ID、token、估算成本和延迟，不记录训练文字、饮食内容、照片、IP、访问码或 API key。审计列表最多 1000 条，Redis 中保留 30 天。
5. **Fail closed**：Vercel Preview / Production 缺少访问码、审计 salt 或完整 Redis 配置时，AI 接口返回 503，不会退回单实例内存保护。内存模式只服务本地开发。

## 必须配置的服务端变量

在 Vercel 的 Development、Preview、Production 中按需配置，Secret 不得使用 `VITE_` 前缀：

| 变量 | 是否敏感 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` | 是 | OpenAI 服务端密钥 |
| `GYM_DEMO_ACCESS_CODE` | 是 | 给作品集访客的共享访问码；公开环境至少 16 字符，建议随机且定期轮换 |
| `AI_AUDIT_HASH_SALT` | 是 | 与访问码不同的随机 salt，用于客户端标识脱敏；公开环境至少 16 字符 |
| `UPSTASH_REDIS_REST_URL` | 否 | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | 是 | Upstash REST token |
| `AI_REQUESTS_PER_MINUTE` | 否 | 默认 20 |
| `AI_DAILY_REQUEST_LIMIT` | 否 | 默认 200 |
| `AI_DAILY_BUDGET_MICRO_USD` | 否 | 默认 2,000,000，即 2 美元 |
| `AI_REQUEST_RESERVE_MICRO_USD` | 否 | 默认 25,000，即每次预留 0.025 美元 |
| `AI_BUDGET_ALERT_PERCENT` | 否 | 默认 80，达到日预算百分比时提醒一次 |
| `AI_BUDGET_ALERT_WEBHOOK_URL` | 是 | 可选；接收脱敏预算提醒的 HTTPS webhook |

`AI_DAILY_BUDGET_MICRO_USD` 使用“微美元”：1 美元 = 1,000,000。实际成本仍是根据 token 的估算，不等于供应商账单；应同时在 OpenAI Platform 设置项目级预算与通知。

通过 Vercel Marketplace 创建 Upstash 时，平台可能注入等价的 `KV_REST_API_URL` / `KV_REST_API_TOKEN`；代码同时支持这组名称，不需要复制或暴露凭证。

## 上线顺序

1. 在 Upstash 创建 Redis 数据库，复制 REST URL 和 Token。
2. 在 Vercel Project Settings → Environment Variables 中添加上表变量；密钥类使用 Sensitive/Secret。
3. 为 Preview 与 Production 分别配置不同访问码；修改变量后必须重新部署才会生效。
4. 先在 Preview 验证：无访问码 401、错误访问码 401、正确访问码成功、超限 429、保护后端异常 503。
5. 检查 Redis 中当日 request / reserved / spent counter 和 `gym:ai:audit`，确认没有原始健康数据。
6. 在 OpenAI Platform 为该 Project 设置独立预算/通知，最后再开放作品集链接。

## 本地行为

本地默认允许内存保护，便于 `vercel dev` 与正式评测；设置 `AI_ALLOW_LOCAL_MEMORY_GUARD=false` 可强制检查 Redis 配置。若本地配置了 `GYM_DEMO_ACCESS_CODE`，页面右上角“AI 访问码”会保存到当前标签页并自动随请求发送。

## 已知边界

- 共享访问码是低摩擦作品集防滥用措施，不是账号系统；访问码泄露后应立即轮换。
- 应用预算是第二道保护，不能替代 OpenAI 账户侧预算、通知和用量监控。
- Upstash pipeline 中各 Redis 命令是顺序但非事务执行；计数与预算预留使用原子 `INCR/INCRBY`，在极端后端中断时可能保守地少放行请求，但不会静默退回不安全模式。

参考：Upstash REST pipeline、Vercel Environment Variables 与 Sensitive Variables、OpenAI GPT-5 Mini 计价页，均于 2026-09-06 核对。
