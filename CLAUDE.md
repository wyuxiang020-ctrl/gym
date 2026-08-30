# CLAUDE.md

给在这个仓库里工作的 Claude(以及任何协作者)看的项目规约。

## 强制规则

**每次修改代码后,同步更新 `docs/` 下受影响的文件,并在 `docs/CHANGELOG.md` 追加一条记录(日期、改了什么、为什么改)。**

具体来说:
- 改了数据模型(`src/lib/types.ts`)、新增/删除页面或 API 接口 → 更新 `docs/PROJECT_CONTEXT.md`
- 改了 AI 相关的 prompt、模型、接口输入输出格式 → 更新 `docs/AI_FEATURES.md`
- 做了一个有取舍的技术/产品决策 → 在 `docs/DECISIONS.md` 里补一条,标清楚是 🟢有明确依据 / 🟡实现时的判断 / 🔴需要用户确认
- 不管改了什么,都要在 `docs/CHANGELOG.md` **顶部**加一条新记录,格式参考文件里已有的条目(日期标题 + 背景一句话 + 分点说明改了什么、为什么)

这不是可选项——文档和代码不同步,`docs/` 就失去了存在的意义。

## 项目是什么

个人健身/饮食记录 PWA,详见 `docs/PROJECT_CONTEXT.md`。开始改代码前建议先读一遍那个文件,再读 `docs/DECISIONS.md` 了解已有取舍,避免重复踩坑或推翻已经讨论过的决定。

## 关键约定,不要违反

1. **所有 `localStorage` 读写必须经过 `src/lib/store.ts`**,不要在组件里直接调 `localStorage`。以后如果要换成真数据库,应该只需要改这一个文件。
2. **`/api/*.ts` 里的相对导入必须带 `.js` 后缀**(比如 `from './_lib/claude.js'`),即使源文件是 `.ts`。Vercel 的 Node 运行时按原生 ESM 解析,不带后缀会导致接口在线上直接崩溃(`ERR_MODULE_NOT_FOUND`),但本地 `vite dev` 不会暴露这个问题,容易漏测。
3. **不要用 `new Date().toISOString().slice(0,10)` 取"今天"的日期**,在 UTC+8 等正时区会因为 UTC 转换算错日期。统一用 `src/lib/date.ts` 里的 `todayStr()` / `toDateStr()`。
4. **API key 永远不出现在前端代码里**。任何新增的外部服务调用,密钥都必须放在 Vercel 环境变量,只在 `/api` 下的 serverless 函数里读取 `process.env.xxx`。
5. **热量计算用 MET 公式(`src/lib/met.ts`),训练计划用规则生成(`src/lib/planGenerator.ts`),都不要改成让 AI 做**——这是明确的产品决策(公式确定、免费、瞬时;AI 反而不稳定),详见 `docs/DECISIONS.md` 2.1/2.2。
6. **不确定的 AI 解析结果不能静默丢弃或编造**。参考 4 个现有 `/api` 接口的写法:解析失败时把原始文字放进 `rawText` 返回给前端;AI 自己没把握的地方用 `uncertain` 字段说清楚,不要让它编数字。
7. **界面文案全部中文**,变量名/代码注释用英文,注释只在"为什么"不明显时才写(参考现有代码的注释密度,不要逐行加注释)。
8. **不引入新的第三方 UI/拖拽库之前先想想是否必要**——目前拖拽排序、图标、动效都是手写的(没用 `dnd-kit` 之类的库),是刻意保持依赖精简。

## 开发与部署

- 本地开发:`npm run dev`(纯 Vite,`/api` 不会跑,AI 相关功能本地测不了,会看到明确的报错而不是崩溃——这是预期行为)
- 完整联调(含 `/api`):需要 `vercel dev`,或者直接部署到 Vercel 的 preview 环境测
- 构建前必须过 `tsc -b`(`npm run build` 已经包含这一步)
- 部署:`git push` 到 `master` 会触发 Vercel 自动部署;也可以手动 `npx vercel --prod --yes`
- 改完东西建议照着这个顺序走一遍:`npm run build` 确认不报错 → 在浏览器里实际验证功能 → 更新 `docs/`(见上面强制规则)→ commit → push → 确认线上部署成功

## 文档地图

- `docs/PROJECT_CONTEXT.md` —— 项目是什么、技术栈、目录结构、完整数据模型、页面清单、API 接口详情
- `docs/AI_FEATURES.md` —— 所有 AI 功能的 prompt 全文、输入输出格式、成本估算
- `docs/DECISIONS.md` —— 关键决策为什么这么定,哪些是确定的、哪些是待确认的
- `docs/CHANGELOG.md` —— 改动历史
