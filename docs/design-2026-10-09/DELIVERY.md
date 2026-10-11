# Gym 视觉与交互升级 · 2026-10-09

## 体验入口

- 本地日常入口：<http://127.0.0.1:4175/>
- 扫描器械：<http://127.0.0.1:4175/?equipment-scan=1>
- 熊猫陪练：<http://127.0.0.1:4175/?training-companion=1>
- 独立构建预览：<http://127.0.0.1:4185/>。PWA/离线验证在这个独立源进行；它和 4175 的本地档案不互通。
- 在 `E:\gym` 执行 `npm run dev:equipment` 可启动前端 4175 与器械 API 4177；启动不调用模型。构建预览用 `npm run build` 后执行 `npm run preview -- --host 127.0.0.1 --port 4185 --strictPort`。

本轮交付本地修改，没有推送 GitHub 或替换线上版本。上轮已发布版本仍在原域名运行。没有数据模型迁移、没有清空档案；测试全部采用独立浏览器及合成记录。

## 改了什么

| 页面 | 本轮结果 |
| --- | --- |
| 首页 | 真实今日动作/完成组数、单一主操作、原创器械氛围图、取景式扫描入口、本周实际完成状态、按日期查看记录、最近记录；已有打卡与成长功能收在可展开区域 |
| 导航 | 五个原栏目保留；48px 以上主控件、底部安全区、明确当前项；栏目切换保留各自滚动位置；辅助入口和版本检查移到页尾 |
| 器械 | 拍摄、核对、资料、训练四步状态；仅真实请求期间显示扫描线，无虚构百分比；候选、人工确认、未知结果、取消、重试、保存失败保留原行为 |
| 教学 | 核对型号/查看示范两步可回看；坚持 Life Fitness Insignia SS-CP 型号对应关系；按钮主动打开视频；未补写未经审校的调节或动作指导 |
| 训练 | 已有记录优先，动作选择移到记录之后；首个待完成组突出，已确认重量/次数更醒目，增减/确认/完成易点击；重量输入支持小数键盘和明确范围；失败保留输入、持续提示及备份入口 |
| 陪练 | 原计时和动画逻辑不变；大号等宽剩余时间，暂停/延长/结束清楚分组；结束后展示实际已确认/待完成组数、已有容量与缺失说明 |
| 饮食/身体/历史 | 同一配色与表单规范；身体图可切换最近 7/30 条或全部并按日期读值；历史支持展开真实动作/完成数，备份仍可达 |
| PWA | 新哑铃图标、石墨主题色和启动背景；首页图压缩为 WebP 并预缓存；离线边界明确提示；仍由用户明确刷新，数据存储身份不变 |

颜色：页面 `#101214`，表面 `#1B1F22`，正文 `#F3F4EE`，辅助 `#AEB5B8`，强调 `#DFFF32` 配深色字；成功使用绿、提醒使用琥珀、错误使用红及文字。主要操作至少 48px；按压缩放 0.98/120ms，导航选中约 200ms，展开约 200ms，保存反馈约 280ms。系统减少动态设置禁用位移和循环效果。

## 参考观察与落实

- [Technogym Ecosystem](https://corporate.technogym.com/en/about-us/ecosystem)：官方内容说明器械、内容、应用和记录的连接。落实为器械确认 → 对应资料 → 带入动作 → 真实记录。其零售首页本次返回 403；不声称观察过其具体动效、配色或转场。
- [Ladder 官网](https://www.joinladder.com/)和[官方记录界面](https://ladderteams.imgix.net/website/phone/records_v1.png?w=1200)：实际用浏览器观察到深色表面、明亮强调色、突出数字、分类选中和训练记录层级。落实到本项目的首页重心、本周节奏、重量/组数/休息时间、选中态。没有添加其 1RM、团队百分位或其他本项目不存在的指标。
- 本轮没有把 Nike、WHOOP、Peloton 未观察的页面写成已经采用的设计证据。
- 微交互时长来自用户要求及本地实现判断，并非对参考网站动画参数的测量。

参考截图仅在 `evals/visual-upgrade-2026-10-09/reference-*.png` 作观察证据，未加入产品素材。

## 熊猫与图片

原稿仍从 `public/companion-assets/d-panda` 读取。`companionCatalog.ts`、动作曲线与 `PandaFeedback.tsx` 未改变；原表情、事件触发和已减半的时长保留。只调整外围容器和成果数字。

首页原创运动图由内置 `image_gen` 生成；无参考图、无外部品牌和人物。源文件 `training-hero-source.png`，部署文件 `public/brand/training-hero.webp`。图片标作“训练氛围示意”，不充当识别结果或教学示范。

生成提示词：

> Create an original cinematic photographic gym equipment atmosphere image for a Chinese fitness logging app. Landscape 1536x1024 composition. Tight macro crop of a pair of heavy black rubber hex dumbbells and weight plates on a charcoal gym floor, crisp steel handles, subtle lime-yellow rim lighting, dramatic directional natural light, sophisticated deep graphite shadows, tactile surfaces, restrained professional sports editorial art direction. Equipment mostly in right two thirds, left third very dark empty negative space for UI text. No text, no logos, no people, no mascots. This is decorative workout mood photography, not a technical instructional equipment diagram.

## 实际操作与截图

[打开截图总览](START-HERE.html)。截图为本地构建实际运行界面，使用隔离合成记录；不代表用户真实成绩。

1. 首页点“继续训练”；无记录则点扫描或手动添加。
2. 扫描页选照片并主动上传，或选择手动器械。确认类别后核对型号，可查看现有厂商示范。
3. “带入训练记录”保留已确认上下文；点击添加后才写入动作。
4. 编辑重量，点击确认；完成组保存成功后才出现完成状态。开启陪练时进入休息，支持暂停、延长、提前结束。
5. “结束本次陪练”即刻显示已保存摘要，不强制等待熊猫动作结束；待完成组不自动补齐。
6. 首页点本周日期看该天记录；底部“记录”返回完整日期列表；身体趋势选择日期查看真实读值。

本轮提供实际截图、可复现操作步骤及 `evals/visual-upgrade-2026-10-09/interaction-390.zip` 的 Playwright 交互追踪（可用 Trace Viewer 回看 DOM/截图/动作）。未输出连续视频；交互验证包含实际点击、状态和存储断言。

## 验证与限制

最终结果见同目录 `VALIDATION.md`。关键结果：构建与静态检查通过；360/390/430 手机宽度、1440 桌面主流程通过；原有保存、器械异常、陪练计时及教学回归通过；独立 PWA 实际离线重载/更新保留档案通过。

明确未测：真实 iOS/Android 相机和软键盘、硬件安全区、用户已安装的桌面 PWA、真实照片的识别准确率、付费模型调用和专业教学审校。本轮复用此前视频播放器，没有重新声称完成厂商视频实播。减少视口高度只模拟键盘占用空间；150% CSS 文字只验证放大布局，不等于手机系统缩放。

离线只承诺已缓存页面与本地记录；器械识别、外部视频和未缓存熊猫资源需要联网。关闭/切换陪练仍按原规则结束内存计时。尚未确认的表单草稿不会跨页面持久化，已保存内容保留。

建议重点体验：首页训练重心、单手完成一组、重量失败提示、休息计时、型号教学返回、身体图读值。人体检测/镜像继续暂停；识别范围仍只有坐姿推胸机。

