# PROJECT_CONTEXT.md

## 1. 项目是什么

**Gym** 是一个个人使用的健身与饮食记录 App,做成手机端可以"添加到主屏幕"的网页应用(PWA)。

**要解决的问题**:市面上的健身 App 要么记录训练很繁琐(要一格一格填组数、重量),要么饮食记录要精确称重才能用,门槛高、容易半途而废。这个项目的思路是:训练可以直接从计划导入、勾选完成,或者用一句话描述交给 AI 解析;饮食可以拍照或者说一句话,由 AI 估算营养成分,而不是逐项手动查表。同时用打卡连续天数、宠物养成等轻量游戏化元素维持使用动力。

**目标用户**:目前只有开发者本人一个用户,数据全部存在用户自己手机浏览器本地,没有账号系统、没有服务器数据库、没有多用户概念。

---

## 2. 技术栈与选型

| 层面 | 选型 |
|---|---|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| 样式 | Tailwind CSS v4(通过 `@tailwindcss/vite` 插件,配置写在 `src/index.css` 的 `@theme` 里) |
| 后端 | 无独立后端,用 Vercel Serverless Functions(`/api` 目录下的文件,每个文件是一个接口) |
| AI 能力 | OpenAI Responses API(`gpt-5-mini-2025-08-07` 固定快照),通过官方 `openai` SDK 调用;文字和图片统一走严格 JSON Schema 输出 |
| 图片服务端处理 | 生产依赖 `sharp` 0.35；在模型调用前完整解码、限制格式/尺寸/像素/帧数，并规范化重编码为 JPEG |
| 公开演示保护 | 共享访问码 + Upstash 跨实例限流 / 日预算 + 脱敏审计；Preview / Production 缺配置时 fail closed |
| 数据存储 | 浏览器 `localStorage`,单个 key 存一个大 JSON 对象,没有数据库 |
| PWA / 离线 | `vite-plugin-pwa`,生成 manifest 和 service worker,支持"添加到主屏幕"、离线打开已缓存的页面 |
| 部署 | Vercel(前端静态资源 + serverless 接口一起部署) |
| 代码检查 | oxlint |

**为什么这么选**:详细的取舍理由见 `DECISIONS.md`,这里只列选型结果。

---

## 3. 目录结构说明

```
gym/
├─ src/            前端代码(React 应用)
├─ api/            后端代码(Vercel Serverless Functions,只有 4 个 AI 相关接口)
├─ evals/          版本化 AI 评测数据集、规则、结果和基线源码快照
├─ scripts/        正式评测与 API 边界检查脚本
├─ public/         静态资源(图标等)
├─ docs/           本文档所在目录
├─ vite.config.ts  构建与 PWA 配置
└─ package.json    依赖清单
```

### `src/` 内部结构

| 子目录 | 负责什么 |
|---|---|
| `src/App.tsx` | 应用入口。没有使用 URL 路由(没装 react-router),是靠一个 state 变量在 5 个"标签页"之间切换的单页应用 |
| `src/components/` | 页面级和通用组件,按功能又分了 `workout/`(训练相关)、`meal/`(饮食相关)、`checkin/`(打卡/宠物相关)、`icons/`(图标)四个子目录 |
| `src/lib/` | 不涉及界面的纯逻辑代码:数据存取与完整当天替换(`store.ts`)、导入备份校验(`dataValidation.ts`)、AI 请求与返回校验(`apiClient.ts`/`aiValidation.ts`)、统一训练完成口径(`checkIn.ts`)、类型定义(`types.ts`)、各种计算公式和动作库数据等 |

### `api/` 内部结构

| 文件 | 负责什么 |
|---|---|
| `api/_lib/openai.ts` / `api/_lib/validate.ts` | 封装 OpenAI Responses API、严格 JSON Schema 以及 AI 返回结构校验,4 个接口都复用 |
| `api/_lib/request.ts` | 统一校验 POST + `application/json`、正文与字段上限；用 `sharp` 完整解码并规范化图片，同时提供实例内的每 IP 限流 |
| `api/_lib/demoSafety.ts` | 公开演示访问码、跨实例分钟 / 日限额、预算预留、告警和脱敏审计；本地才允许内存回退 |
| `api/parse-workout.ts`<br>`api/parse-meal.ts`<br>`api/analyze-photo.ts`<br>`api/recalc-meal.ts` | 4 个独立的 serverless 接口,详见第 6 节 |

**重要说明**:`api/` 目录下每个 `.ts` 文件会被 Vercel 独立部署成一个接口,不经过打包(bundler),所以文件之间的相对导入必须写成 `./_lib/openai.js`(带 `.js` 后缀),即使源文件是 `.ts`——这是 Node.js 原生 ESM 模块解析的要求,写错会导致接口在线上直接崩溃(本地开发环境不会报错,是个容易踩的坑)。

---

## 4. 数据模型

所有数据都存在浏览器 `localStorage` 里唯一的一个 key(`gym-data-v1`)对应的 JSON 对象中,不经过本项目的服务器数据库。读写逻辑全部封装在 `src/lib/store.ts` 里,其他代码不会直接操作 `localStorage`。读取本地数据和导入 JSON 备份时都会经过 `dataValidation.ts` 的运行时结构与范围校验;格式不正确的备份不会覆盖现有数据。

导入有效备份前必须再次确认；确认后会先下载一份带时间戳的当前数据安全备份，再整体替换。若浏览器里已有 JSON 无法解析或不兼容，App 启动时会直接进入“本地数据需要恢复”页面，保留原始导出与有效备份导入能力并暂停后续业务写入，避免被无档案分支困在建档页，也避免把异常数据误当成空数据后覆盖。导入成功后父级 profile、测量、计划和页面状态即时重载并回到今天页。

顶层结构叫 `GymData`,包含 6 个字段:

| 字段 | 类型 | 说明 |
|---|---|---|
| `profile` | `Profile \| null` | 身体档案,全局只有一份 |
| `measurements` | `Measurement[]` | 历次身体测量记录 |
| `plans` | `Plan[]` | 保存的训练计划,可以有多份,同时只有一份标记为"当前使用" |
| `dayLogs` | 以日期(`YYYY-MM-DD`)为 key 的字典 | 每天的训练、饮食、饮水、打卡记录 |
| `exerciseVideos` | 以动作名为 key 的字典,值是视频链接 | 用户自己填的动作讲解视频直链 |
| `lastFedDate` | 日期字符串(可选) | 上次给宠物投喂的日期,用来限制"每天只能喂一次" |

### 4.1 `Profile`(身体档案)

| 字段 | 类型 | 说明 |
|---|---|---|
| `gender` | `'male' \| 'female'` | 性别,用于 BMR 公式 |
| `birthYear` | 数字 | 出生年份 |
| `height` | 数字(cm) | 身高 |
| `experience` | `'beginner' \| 'intermediate' \| 'advanced'` | 训练经验,影响自动生成计划的动作数量 |
| `goal` | `'cut' \| 'bulk' \| 'maintain'` | 目标:减脂 / 增肌 / 维持 |
| `targetWeight` | 数字(可选) | 目标体重 |
| `targetBodyFat` | 数字(可选) | 目标体脂率 |
| `targetNote` | 文本(可选) | 用文字描述想要的身材 |
| `trainingDaysPerWeek` | 数字(2-6) | 每周训练天数,用于自动生成计划的分化方式 |
| `activityLevel` | 1-5 | 日常活动量(不含训练),用于 TDEE 计算 |
| `waterTargetMl` | 数字(可选) | 每日饮水目标,不填则按体重 ×30ml 算 |
| `checkInMode` | `'open' \| 'workout' \| 'workout_and_meal'`(可选) | 打卡的判定条件,默认"打开 App 就算" |

### 4.2 `Measurement`(身体测量,一次一条,不是每天必填)

| 字段 | 类型 |
|---|---|
| `date` | 日期字符串 |
| `weight` / `bodyFat` / `waist` / `chest` / `hip` / `arm` / `thigh` | 数字,均可选 |
| `note` | 文本,可选 |

### 4.3 `Plan` / `PlanDay`(训练计划)

一个 `Plan` 包含 `id`、`createdAt`、`name`、`isActive`(是否为当前使用的计划)、`days`(数组)。每个 `PlanDay` 有:

| 字段 | 类型 | 说明 |
|---|---|---|
| `label` | 文本 | 如「Day 1 · 推(胸肩三头)」 |
| `exercises` | 数组 | 每项含 `name`、`sets`、`repRange`、`note`。`repRange` 接受明确的纯次数目标(如 `8-10`、`每组12次`)或 `30秒`、`每组30秒`、`30-45秒`、`0.5分钟/组` 等纯计时格式 |
| `cardio` | 对象(可选) | 当天附带的有氧安排:`type`、`minutes`、`note` |

导入计划时不会“看到数字就取第一个”。次数解析先取逗号/分号前的首段，再要求整段符合纯整数或次数区间；因此 `8-10，RPE8` 取明确的 8 次目标，但 `RPE 8`、`3×10`、`AMRAP`、`8-10 RPE8` 不会被猜测。计时解析要求整个字符串符合秒/分钟格式，范围取下限、分钟换算为秒并四舍五入。无法匹配时生成无组数的待修正动作，并在 `note` 保留“目标次数/时长无法读取”，不会退回默认 8 次。单个计划动作最多生成 20 组。力量与有氧项目先全部在内存中生成并预检，当天上限为 200 个力量动作、100 个有氧项目；通过后才用一次完整 `DayLog` 替换写入，任何失败都不会留下部分导入。计划有氧的 `note` 还保存 `计划来源:<原类型> <分钟>分钟` 标记，因此把“有氧(可自选)”改成具体项目后仍可按原计划识别重复；若用户主动清除该提示，则退回当前类型 + 分钟判断。

### 4.4 `DayLog`(每日记录,以日期为 key)

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | 文本 | |
| `checkedIn` | 布尔 | 当天是否已打卡 |
| `strength` | `StrengthEntry[]` | 当天的力量训练记录 |
| `cardio` | `CardioEntry[]` | 当天的有氧训练记录 |
| `meals` | `Meal[]` | 当天的饮食记录 |
| `water` | 数字(ml) | 当天饮水量，范围 0–20,000 ml |
| `bodyNote` / `mood` | 可选 | 预留字段,目前界面上没有对应入口 |

**`StrengthEntry`(一个力量动作)**:`id`、`name`(动作名)、`sets`、`intensity`(可选,用于热量估算)、`estKcal`(按 MET 公式自动算出)、`source`(`'manual'` 手动、`'nl'` AI 自然语言解析、`'mixed'` 手动记录追加 AI 组数)、`note`/`uncertain`(AI 备注和不确定项)。`mixed` 在界面显示“AI辅助”，避免把混合来源伪装成纯手动。已保存的 `note` / `uncertain` 继续显示，用户核对完成后可点“已处理，清除提示”同时清空。每个 `StrengthSet` 都含 `weight`、`done`，并且在整数 `reps`(次数型)和整数 `durationSeconds`(计时型)中二选一；手动记录和 AI 预览都可逐组切换模式并新增组。训练步进器限制重量不超过 1,000 kg、次数不超过 1,000、单组计时不超过 86,400 秒，单动作不超过 50 组。训练容量只按已完成的 `weight × reps` 计算，计时组不会被当成次数；打卡与完成状态要求至少有一组 `done=true` 且次数或秒数为正。从计划导入但尚未勾选的组不计入档案。补录过去日期时,“上次记录”只会从该日期之前查找,不会误用未来数据。

**`CardioEntry`(一次有氧)**:`id`、`type`(项目名称)、`minutes`、`distance`(可选)、`avgHr`(可选)、`intensity`、`done`(可选)、`estKcal`、`source`、`note`/`uncertain`。计划导入明确写 `done=false` 并且热量为 0；手动/AI 新增为已完成。`done` 保持可选是为了向后兼容：旧记录缺失该字段时按完成处理，而不是在升级后丢失历史训练。导入“有氧(可自选)”后必须先从支持列表中选项目才可勾选完成。已保存的有氧 `note` / `uncertain` 也持续显示，并支持用户确认后清除。

**`Meal`(一餐)**:`id`、`slot`(早餐/午餐/晚餐/加餐)、`rawText`(用户原话,可选)、`photoThumb`(压缩后的照片缩略图 base64,可选)、`items`(`FoodItem[]`)、`note`(备注,可用来触发 AI 重新估算)、`confirmed`。AI 一次最多返回 30 项；新建/确认保存要求每餐 1–100 项，一天最多保存 100 餐。备份读取为兼容历史记录允许每餐 0–100 项。

**`FoodItem`(一样食物)**:`name`、`grams`、`kcal`、`protein`、`carbs`、`fat`、`confidence`(`'high'/'mid'/'low'`,AI 对这一项估算的把握程度)。名称最多 120 字符；`grams` / `kcal` 范围 0–100,000，三个宏量营养素分别为 0–10,000。新确认保存要求克数、热量或三项宏量营养素中至少一个数值大于 0；导入层保留对旧全零项的读取兼容，但仍检查上限。在编辑器里修改 `grams` 时,四项营养数据会按原克数同比例缩放,仍可继续单独修正。

---

## 5. 页面清单

这个 App **没有 URL 路由**,是单页应用,靠底部 5 个标签切换视图(还有一个"建立/编辑档案"的全屏表单,不在标签栏里)。

| 标签 | 组件 | 核心功能 |
|---|---|---|
| 今天 | `TodayTab` | 打卡按钮(根据 `checkInMode` 判断能不能点;训练条件复用 `hasCompletedWorkout()`,要求真实完成的有效力量组或已完成的正时长有氧)、连续打卡天数 + 火焰图标、月历热力图(按当天训练容量深浅上色)、宠物(小熊猫)养成卡片 |
| 训练 | `WorkoutTab`,内部再分 3 个子标签:`动作库` / `训练计划` / `训练记录` | 动作库:52 个唯一动作名,按部位展开为 53 条分类记录(有 1 个动作跨分类),点开看要领卡片、常见错误、自填视频链接。训练计划:规则生成 / 5 套现成模板 / 手动编辑,支持长按拖动调整顺序。训练记录:计划力量与有氧均作为待完成导入,有氧可选项目并勾完成;重复项目可跳过或明确追加。手动记录与 AI 预览的每组都可切换次数/计时,AI 预览还能新增组、编辑距离和平均心率;同名 AI 动作选择追加组、替换组或返回编辑，混合来源显示“AI辅助”。写入后的备注和待核对项持续显示，处理后可清除。全部条目完成提示与打卡复用同一基础完成判定 |
| 饮食 | `MealTab` | 当天饮食记录(文字/拍照/手动/菜谱搭配 4 种录入方式)、按备注重算的可编辑确认预览、克数与营养值比例联动、每日营养目标对比表、饮水打卡卡片;AI 区域明确提示所选文字、餐食数据或压缩照片会发送给 OpenAI |
| 身体 | `BodyTab` | 身体档案编辑入口、BMI/BMR/TDEE 等估算指标、体重体脂腰围趋势折线图、测量记录列表;测量至少填写一项,同一天只保留一条记录 |
| 记录 | `RecordsTab` | 历史每日记录列表(容量、餐数等摘要)、数据导出/导入;文件先限制为 10 MB，再做结构/数值校验和二次确认，替换前自动下载安全备份。检测到现有本地 JSON 不兼容时作为启动恢复页复用,原始导出和有效备份导入仍可操作,成功后即时重载 App 状态 |
| (无标签)身体档案表单 | `ProfileForm`,首次使用或点"编辑档案"时全屏展示 | 填写/修改 `Profile` 的所有字段 |

---

## 6. `api/` 下每个接口的作用、入参、返回结构

4 个接口都是 `POST` 请求,都调用同一个 OpenAI 模型。成功格式统一为 `{ result: ..., meta: ... }`，其中 `meta` 含实际模型、Response ID、可获得时的 Request ID、SDK retry/timeout 配置和 token usage。已经取得可核实模型 Response、但输出为空/JSON 解析失败时，4 个接口统一返回 HTTP 422 + `code: 'MODEL_OUTPUT_PARSE_FAILED'` + `meta`；JSON 可解析但运行时结构校验失败时返回 HTTP 422 + `code: 'MODEL_OUTPUT_VALIDATION_FAILED'` + `meta`。尚未取得可核实 Response 的网络、鉴权、额度或其他供应商错误仍为 500，不保证有 `meta`；错误均可带 `{ error, rawText? }`。

### 6.1 `POST /api/parse-workout`
**作用**:把一段中文训练描述(文字或语音转写)解析成结构化的力量/有氧训练数据。

| | 字段 | 类型 |
|---|---|---|
| 入参 | `text` | 字符串,一段训练描述 |
| 返回(成功) | `result.strength` | 数组,每项含动作名、每组重量以及 `reps` / `durationSeconds` 二选一、完成状态、备注、不确定项 |
| | `result.cardio` | 数组,每项含项目类型、时长、距离、心率、强度、备注、不确定项;AI 预览时 `minutes` 可为 `null`，但补全前不能写入 |

注意:这个接口**不返回热量**——热量由前端用 MET 公式现算,不依赖 AI 估算。

训练预览允许逐组切换次数/计时并增删组，也可修改有氧类型、时长、距离、平均心率与强度。严格 Schema 以嵌套 `anyOf` 要求每个 set 精确包含 `weight / reps / durationSeconds / done`：`reps` 与 `durationSeconds` 必须一项为正整数、另一项严格为 `null`；服务端运行时 validator 对根级、条目级和 set 级也执行相同精确键规则。动作已知但组数或次数/时长缺失时以 `sets: []` 保留待编辑条目，不创建两个目标都为 `null` 的空壳组。确认前再次执行保存校验；同名合并后单动作不得超过 50 组，当天不得超过 200 个力量动作或 100 个有氧项目。通过预检后整批结果才以完整 `DayLog` 单次替换，因此不会出现前几项已写入、后几项失败的半完成状态。

### 6.2 `POST /api/parse-meal`
**作用**:把一段中文饮食描述解析成食物清单并估算营养成分。

| | 字段 | 类型 |
|---|---|---|
| 入参 | `text` | 字符串,一段饮食描述 |
| 返回(成功) | `result.items` | 数组,每项含食物名、克数、热量、蛋白质/碳水/脂肪、置信度 |

### 6.3 `POST /api/analyze-photo`
**作用**:识别一张食物照片,拆分出每一样食物并估算营养成分。

| | 字段 | 类型 |
|---|---|---|
| 入参 | `imageBase64` | 字符串,不带 `data:` 前缀的 base64 图片数据 |
| 入参 | `mediaType` | 字符串(可选),支持 `image/jpeg`/`png`/`webp`/`gif`;不传时默认 JPEG，非法值或与文件头不匹配时拒绝 |
| 返回(成功) | `result.items` | 同 6.2 |

前端在上传前会先把照片压缩到长边不超过 1024px、JPEG 质量 0.7,再转成 base64 传给这个接口。服务端仍把输入当作不可信数据：Base64 解码后最多 3 MiB，声明 MIME、文件头与实际解码格式必须一致；原图单边最多 4096 像素、总像素最多 1600 万且只能单帧。通过后用 `sharp` 自动旋转、按比例缩进 1024 × 1024、透明区铺白、转 sRGB、移除原元数据并以质量 80 重编码为 JPEG，OpenAI 只收到规范化后的图片。

### 6.4 `POST /api/recalc-meal`
**作用**:根据用户备注文字(比如"米饭大概只吃了半碗"),让 AI 重新调整已经估算过的食物清单,而不是让用户自己手动改数字。

| | 字段 | 类型 |
|---|---|---|
| 入参 | `items` | 数组,原始的食物估算清单(结构同 `FoodItem[]`) |
| 入参 | `note` | 字符串,用户的备注 |
| 返回(成功) | `result.items` | 调整后的食物清单,同结构 |

### 通用请求保护与错误处理

`api/_lib/request.ts` 在调用模型前统一处理：只允许 POST，且 `Content-Type` 必须是 `application/json`（可带 charset），正文必须为 JSON 对象；训练/饮食文字最多 2000 字符；重算备注最多 1000 字符、最多 30 个食物项；图片只接受单帧 JPEG / PNG / WebP / GIF，并执行上述完整解码和规范化。超出大小返回 413，方法、媒体类型或字段错误返回 405 / 415 / 400。响应统一设置 `Cache-Control: no-store`。

饮食输出在严格 Schema、服务端和前端都限制为最多 30 项；名称最多 120 字符，克数 / kcal 最高 100,000，蛋白质 / 碳水 / 脂肪各最高 10,000。本地确认层允许用户编辑到单餐 100 项并再次验证同一数值范围，因此“AI 返回上限”和“最终保存上限”需分开理解。

公开演示保护在模型调用前校验共享访问码，并通过 Upstash REST 维护跨实例分钟 / 日请求计数和预算预留；调用结束后按 usage 结算估算成本并写脱敏审计。审计不记录训练文字、饮食内容、照片、原始 IP、访问码或 API key。Vercel Preview / Production 缺少访问码、独立审计 salt 或完整 Redis 配置时返回 503；本地开发才允许实例内内存回退。共享访问码不等于用户身份系统。

无付费边界脚本当前为 10/10；公开演示保护固定检查为 18/18，覆盖缺配置 fail closed、访问码强度、Upstash / Marketplace 变量路径、跨实例限流、预算、失败保守记账、告警去重和审计脱敏。代码检查通过不等于线上已启用；截至 2026-09-06，Vercel Development / Preview / Production 已有非敏感限额，但仍缺 OpenAI、访问码、审计 salt 与 Redis 凭证。

4 个接口都用 `try/catch` 包裹 OpenAI 调用，并区分“尚未取得模型证据”和“已经取得 Response 但输出不可用”。前者返回 500；后者无论是空输出/JSON 解析失败，还是 JSON 结构校验失败，都会返回带错误码和 `meta` 的 422，让 Response ID、usage 等审计证据不再随失败丢失。可获得的原始文字仍放在 `rawText`；前端不会把 422 结果当成成功数据。服务端使用 Structured Outputs 约束结构,前端收到成功响应后仍会再校验一次,避免异常结果进入界面或本地数据。

---

## 7. 外部服务调用

| 服务 | 用途 | 涉及的环境变量名 |
|---|---|---|
| OpenAI Responses API | 用户主动调用上述 4 个接口时,处理训练/饮食文字、餐食数据或压缩图片 | `OPENAI_API_KEY`(存在 Vercel 的环境变量里,前端代码完全不接触这个值,只有 `/api` 下的 serverless 函数在运行时读取) |
| Upstash Redis REST | 公开演示的跨实例限流、预算计数和脱敏审计 | `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`，以及访问码 / 审计 salt / 限额变量 |
| Google Fonts CSS | `src/index.css` 在联网时加载 Barlow / Barlow Condensed 字体样式 | 无 |
| 用户提供的视频直链 | 用户为动作保存并播放外部视频地址时,浏览器会向该地址发起请求 | 无 |

没有服务器数据库、第三方登录、支付或统计埋点。业务记录默认只保存在当前浏览器；但 AI 输入、在线字体和用户主动配置的视频链接会发生上述第三方网络请求，不能笼统描述为“完全离线”或“从不发送数据”。AI 界面已在提交入口附近提示发送范围和确认后写入机制。

**再次强调**:本文档不包含任何密钥的实际值,只写了变量名。

### 本地运行 AI 接口

`npm run dev` 只会启动 Vite 前端,不会执行 `api/` 下的 Vercel Serverless Functions,因此此模式下页面能打开但 4 个 AI 请求都无法到达 OpenAI。本地联调必须同时满足:

1. 安装并使用 Vercel CLI 启动项目的前端与函数运行时(用 `vercel dev`,而不是只用 `vite`)。
2. 在根目录 `.env.local` 提供真实的 `OPENAI_API_KEY`;仓库里的 `.env.example` 只有占位符,不能调用 API。本地函数在 Vercel CLI 未自动注入 Development Secret 时会通过 Node 的 server-only 回退读取该文件。
3. 如果浏览器能访问 OpenAI、但 Node 直连 `api.openai.com` 超时,在 `.env.local` 增加 `OPENAI_PROXY_URL`;服务端会用 Undici `ProxyAgent` 让 OpenAI SDK走该代理。该变量只用于确实需要代理的本地环境,线上网络可直连时不要配置。

`.vercel/project.json` 只代表目录已关联某个 Vercel 项目,不等于本机已经安装 CLI,也不会自动把远端密钥写进本地环境。密钥不得放进前端变量、源码或 Git。

---

## 8. 质量与依赖状态（2026-09-06）

- 训练文字解析已完成一次 20 条 V1 正式基线：12/12 核心题直接通过、153/153 核心字段正确、6/8 边界题通过、20/20 HTTP 200 且结构有效。
- V2 首次正式尝试 `2026-09-05-openai-regression-v2` 严格顺序、评测器与 SDK 均无重试，在 WO-14 后以 14 次请求中止。WO-01～13 有 Response ID / usage，已知小计为 18,302 token、按当时官方单价估算 $0.013075 USD；WO-14 因旧 Schema 允许 `reps` 与 `durationSeconds` 同时为 `null`，服务端校验失败后旧 500 响应丢失 `meta`，其 usage 与整次尝试总成本不可得。partial 不是完整 V2 成绩，不能报告通过率，也不能代表之后修正过的代码。
- 第二次尝试 `2026-09-06-openai-regression-v2-r2` 在 WO-04 因本机 OpenAI 直连网络错误中止，共 4 次请求、无重试；前三题均为 `direct`，已知 4,616 token / $0.002790 USD，WO-04 无 Response ID、计费状态不可核实。诊断确认 `.env.local` 中已有可用 `OPENAI_PROXY_URL`，但旧 helper 在 Vercel 已注入 key 时不会加载它；当前 helper 已改为补载缺失的本地代理值并保持宿主环境优先。
- 第三次正式运行 `2026-09-06-openai-regression-v2-r3` 经修正后的代理路径完成 20/20 次请求且无重试：核心题 12/12 直接可用、字段 182/182、精确动作名 15/15、边界题 7/8、结构 20/20；延迟中位 5327.5ms（2514–12632ms），总 token 31,629，估算成本 $0.019134 USD。20 条均有唯一 Response ID/响应哈希，人工复核改分 0 条。唯一失败 WO-13 因重量未知而清空组，丢失已知的 4×8。
- 修复验证 `2026-09-06-openai-regression-v2-r4` 使用相同合约重新完成 20/20 次请求且无重试：核心 12/12、字段 182/182、精确动作名 15/15、边界 8/8、结构 20/20；延迟中位 6405ms（3755–14421ms），总 token 33,482，估算成本 $0.019038 USD。WO-13 正确保留四个 8 次完成组、使用 0 待编辑占位并提示补充重量，其他 19 条没有规则回归；人工复核改分 0 条。
- 饮食 V1 用 15 条文字、10 条重算和 10 张合成照片完成 35/35 次顺序请求且无重试，结构 35/35；人工复核后 30 direct / 5 partial / 0 fail。修复重算 Prompt 后，同一 10 条重算用例定向回归为 10/10 direct、硬检查 100%。两轮估算成本合计 $0.068159 USD；定向回归不是 35 条全量重跑。
- `npm run eval:workout:v1` 是 V1 历史基线工具，旧 `npm run eval:workout` 只是它的兼容别名；`npm run eval:workout:v2` 使用独立的 20 条数据集、规则和运行器。当前离线证据为 20 条用例 / 47 项评分器自检通过且 `network_requests=0`，`npm run check:ai-contracts` 为 18/18，guard 为 10/10；这些离线结果不等于模型通过率。
- 修正版 V2 runner 把 HTTP 422 + Response ID 记为已调用但该题失败并继续；网络/上游异常、其他非成功 HTTP 或缺少 Response ID 等证据才 fatal。SDK 固定 `maxRetries: 0` / 110 秒，runner 超时 120 秒；首请求前冻结关键文件哈希，完整结束时再次核对。r3 与 r4 均满足完整证据条件；未来再次完整运行仍须另获授权、使用新 Run ID 从头执行，不能续写现有 partial。
- 公开演示安全检查为 18/18；线上限额已配置，但敏感变量和 Upstash Marketplace 资源尚未完成，因此 AI 公开访问保持未激活状态。
- `npm audit --omit=dev` 为 0 个已知漏洞。完整开发依赖审计仍报告 29 项（1 low、12 moderate、15 high、1 critical），主要在 Vercel CLI / `@vercel/*` 的开发工具传递依赖；强制修复可能带来破坏性版本变化，当前没有执行 `npm audit fix --force`。
- `sharp` 0.35 是图片完整解码和安全重编码所需的生产依赖，当前 lockfile 解析为 0.35.4；它不是只在本地检查脚本使用的开发依赖。
- 正式评测没有测量真人编辑率、修正耗时、最终保存一致性、外部用户效果或线上 SLA；8 个 persona 的 Human-in-the-loop 内容是标记清楚的 AI-simulated pretest，也不能作为真人证据。
