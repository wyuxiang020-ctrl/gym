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
| AI 能力 | Anthropic Claude API(`claude-sonnet-4-6` 模型),通过 `@anthropic-ai/sdk` 调用 |
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
| `src/lib/` | 不涉及界面的纯逻辑代码:数据存取(`store.ts`)、类型定义(`types.ts`)、各种计算公式(BMI/BMR/热量/营养目标等)、动作库数据、AI 调用的前端封装等 |

### `api/` 内部结构

| 文件 | 负责什么 |
|---|---|
| `api/_lib/claude.ts` | 封装"调用 Claude 并解析出 JSON"这一段公共逻辑,4 个接口都复用它 |
| `api/parse-workout.ts`<br>`api/parse-meal.ts`<br>`api/analyze-photo.ts`<br>`api/recalc-meal.ts` | 4 个独立的 serverless 接口,详见第 6 节 |

**重要说明**:`api/` 目录下每个 `.ts` 文件会被 Vercel 独立部署成一个接口,不经过打包(bundler),所以文件之间的相对导入必须写成 `./_lib/claude.js`(带 `.js` 后缀),即使源文件是 `.ts`——这是 Node.js 原生 ESM 模块解析的要求,写错会导致接口在线上直接崩溃(本地开发环境不会报错,是个容易踩的坑)。

---

## 4. 数据模型

所有数据都存在浏览器 `localStorage` 里唯一的一个 key(`gym-data-v1`)对应的 JSON 对象中,不经过任何服务器或数据库。读写逻辑全部封装在 `src/lib/store.ts` 里,其他代码不会直接操作 `localStorage`。

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
| `exercises` | 数组 | 每项含 `name`(动作名)、`sets`(组数)、`repRange`(次数区间,如 "8-10")、`note`(可选) |
| `cardio` | 对象(可选) | 当天附带的有氧安排:`type`、`minutes`、`note` |

### 4.4 `DayLog`(每日记录,以日期为 key)

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` | 文本 | |
| `checkedIn` | 布尔 | 当天是否已打卡 |
| `strength` | `StrengthEntry[]` | 当天的力量训练记录 |
| `cardio` | `CardioEntry[]` | 当天的有氧训练记录 |
| `meals` | `Meal[]` | 当天的饮食记录 |
| `water` | 数字(ml) | 当天饮水量 |
| `bodyNote` / `mood` | 可选 | 预留字段,目前界面上没有对应入口 |

**`StrengthEntry`(一个力量动作)**:`id`、`name`(动作名)、`sets`(数组,每组含 `weight`/`reps`/`done`)、`intensity`(可选,用于热量估算)、`estKcal`(按 MET 公式自动算出)、`source`(`'manual'` 手动添加 或 `'nl'` 自然语言解析得到)、`note`/`uncertain`(AI 解析时的备注和不确定项)。

**`CardioEntry`(一次有氧)**:`id`、`type`(项目名称)、`minutes`、`distance`(可选)、`avgHr`(可选)、`intensity`、`estKcal`、`source`、`note`/`uncertain`。

**`Meal`(一餐)**:`id`、`slot`(早餐/午餐/晚餐/加餐)、`rawText`(用户原话,可选)、`photoThumb`(压缩后的照片缩略图 base64,可选)、`items`(`FoodItem[]`)、`note`(备注,可用来触发 AI 重新估算)、`confirmed`。

**`FoodItem`(一样食物)**:`name`、`grams`、`kcal`、`protein`、`carbs`、`fat`、`confidence`(`'high'/'mid'/'low'`,AI 对这一项估算的把握程度)。

---

## 5. 页面清单

这个 App **没有 URL 路由**,是单页应用,靠底部 5 个标签切换视图(还有一个"建立/编辑档案"的全屏表单,不在标签栏里)。

| 标签 | 组件 | 核心功能 |
|---|---|---|
| 今天 | `TodayTab` | 打卡按钮(根据 `checkInMode` 判断能不能点)、连续打卡天数 + 火焰图标、月历热力图(按当天训练容量深浅上色)、宠物(小熊猫)养成卡片 |
| 训练 | `WorkoutTab`,内部再分 3 个子标签:`动作库` / `训练计划` / `训练记录` | 动作库:51 个动作,按部位分类浏览,点开看要领卡片、常见错误、自填视频链接。训练计划:规则生成 / 5 套现成模板 / 手动编辑,支持长按拖动调整顺序。训练记录:从计划导入当天动作打勾记录,或用自然语言描述交给 AI 解析,全部完成后有"已计入档案"的鼓励提示 |
| 饮食 | `MealTab` | 当天饮食记录(文字/拍照/手动/菜谱搭配 4 种录入方式)、每日营养目标对比表、饮水打卡卡片 |
| 身体 | `BodyTab` | 身体档案编辑入口、BMI/BMR/TDEE 等估算指标、体重体脂腰围趋势折线图、测量记录列表 |
| 记录 | `RecordsTab` | 历史每日记录列表(容量、餐数等摘要)、数据导出/导入(JSON 文件,防止清缓存丢数据) |
| (无标签)身体档案表单 | `ProfileForm`,首次使用或点"编辑档案"时全屏展示 | 填写/修改 `Profile` 的所有字段 |

---

## 6. `api/` 下每个接口的作用、入参、返回结构

4 个接口都是 `POST` 请求,都调用同一个 Claude 模型,返回格式统一为 `{ result: ... }`(成功)或 `{ error: string, rawText?: string }`(失败)。

### 6.1 `POST /api/parse-workout`
**作用**:把一段中文训练描述(文字或语音转写)解析成结构化的力量/有氧训练数据。

| | 字段 | 类型 |
|---|---|---|
| 入参 | `text` | 字符串,一段训练描述 |
| 返回(成功) | `result.strength` | 数组,每项含动作名、每组的重量/次数、备注、不确定项 |
| | `result.cardio` | 数组,每项含项目类型、时长、距离、心率、强度、备注、不确定项 |

注意:这个接口**不返回热量**——热量由前端用 MET 公式现算,不依赖 AI 估算。

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
| 入参 | `mediaType` | 字符串(可选),支持 `image/jpeg`/`png`/`webp`/`gif`,不传或非法值时按 `image/jpeg` 处理 |
| 返回(成功) | `result.items` | 同 6.2 |

前端在上传前会先把照片压缩到长边不超过 1024px、JPEG 质量 0.7,再转成 base64 传给这个接口。

### 6.4 `POST /api/recalc-meal`
**作用**:根据用户备注文字(比如"米饭大概只吃了半碗"),让 AI 重新调整已经估算过的食物清单,而不是让用户自己手动改数字。

| | 字段 | 类型 |
|---|---|---|
| 入参 | `items` | 数组,原始的食物估算清单(结构同 `FoodItem[]`) |
| 入参 | `note` | 字符串,用户的备注 |
| 返回(成功) | `result.items` | 调整后的食物清单,同结构 |

### 通用错误处理
4 个接口都用 `try/catch` 包裹调用逻辑:请求方法不对返回 405,缺少必填参数返回 400,调用 Claude 失败或 Claude 返回的内容解析不出 JSON 时返回 500,并且**尽量把 AI 原始返回的文字放进 `rawText` 字段里**,不会因为解析失败就把内容丢掉。

---

## 7. 外部服务调用

| 服务 | 用途 | 涉及的环境变量名 |
|---|---|---|
| Anthropic Claude API | 上述 4 个接口调用,做自然语言解析、图片识别 | `ANTHROPIC_API_KEY`(存在 Vercel 的环境变量里,前端代码完全不接触这个值,只有 `/api` 下的 serverless 函数在运行时读取) |

没有调用其他任何第三方服务(没有数据库服务、没有第三方登录、没有支付、没有统计埋点)。

**再次强调**:本文档不包含任何密钥的实际值,只写了变量名。
