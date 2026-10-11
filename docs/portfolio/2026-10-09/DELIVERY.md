# Gym 产品作品集与简历交付

更新日期：2026-10-09。用户要求撤下举哑铃、跑步、拳击试作，整理少技术名词的简历项目内容，并将成果图片为主的完整作品集加入指定整合作品网站。

## 交付内容

- `delivery/index.html`：独立网页案例，可离线打开、展开说明、放大图片。
- `delivery/documents/portfolio.pdf`：6 页横向产品作品集，以实际界面和角色成果为主。
- `delivery/documents/prd.html` 与 `prd.pdf`：4 页 PRD，含目标、范围、三类设计情境、主要流程、功能验收、异常恢复与待验证项。
- `delivery/documents/resume.html`、`resume.pdf`、`resume.txt`：1 页简历项目内容，含四条完整描述和紧凑版。
- `delivery/documents/evidence.html`：证据与范围说明。
- `Gym-完整产品作品集-2026-10-09.zip`：可直接发送的完整网页、截图和文档，约 7.1 MB。
- `screenshots/`：11 张本次新拍实际界面；来源清单见 `manifest.json`。

## 产品与网页修改

Gym 本地产品恢复原有熊猫反馈，不再加载三种运动的组件、样式和入口；训练保存与休息流程保留。试作源文件与历史记录保留但不在产品主流程引用，不作为当前成果。

用户指定网站：`E:/ai作品网站/unified-portfolio`。更新 `/projects/gym/`、项目列表元信息及网页简历 Gym 条目，添加成果图、可下载 PDF/ZIP。其他项目和个人经历内容保持原样。覆盖前四个源文件与发布标识保存在 `before-site/`。网页沿用原站图库与导航。

基础 Gym 线上版本与新版本地视觉分别标注。此次发布目标是作品网站；没有把尚未部署的 Gym 新版视觉标为产品线上已更新。

## 内容口径

- 本人主导需求、优先级、交互方向与验收；代码通过 AI 编程工具协作实现。
- 作者说明此前许多意见来自同学、周边朋友，按“作者自述及转述反馈归纳”呈现，不虚构参与者、引用原话、人数或效果指标。
- 新手认识器械、固定计划训练、事后饮食补记为设计情境，不是真人访谈。
- 截图使用隔离合成档案；饮食 AI 预览使用固定返回；器械结果采用手动选择路径。没有使用用户健康记录，没有付费模型调用。
- 20 条训练、35 条饮食基线及 10 条重算定向回归为历史模型评测，不冒称本轮新测试或真人样本。

## 验证

- Gym 构建与改动组件静态检查通过，原陪练 10 组回归通过：`evals/training-companion/run-1791548506730/results.json`。
- 作品网站 26 个路由构建成功；含下载网页共 29 个 HTML，1,607 个本地引用零失败。
- 390/1440 两种视口：无横向溢出、图库打开/切图/退出、设计情境展开、7 项下载、网页简历新条目及运行错误检查通过。见 `qa/results.json`。
- PDF 为 6/4/1 页，Poppler 转图后共 11 页逐页查看，未见截断或乱码；渲染在 `tmp/pdfs/gym-review/`。
- 未将桌面视口检查等同真实手机验收，也未验证用户留存、节省时间或真实照片识别准确率。

## 发布

作品站内容提交 `663c666` 已推送到 `wyuxiang020-ctrl/portfolio` 的 `master`，正常推送，无强推。页面标识 `2026-10-09.5`。部署及线上核验另见 `qa/production.json`；未出现该文件前不把推送等同正式网页已更新。

作品集参考：

- [Matt Lawson / Copilot Studio](https://mattlawson.design/work/copilot-studio)：结果与实际界面前置，少量说明解释关键取舍。
- [Min Thu Kyaw / AI Job Search Agent](https://minthukyaw.com/projects/ai-job-search-agent)：明确本人角色、范围与验证阶段。

仅参考组织方式，不使用参考项目的指标、图片或用户意见。

### 正式网页核验完成

Vercel production deployment 6960631991 返回 success，正式域名版本 2026-10-09.5。https://yuxiangworks.com/projects/gym/ 新案例、全部案例图片、图库及网页简历条目通过检查；三份 PDF 和 ZIP 在线文件 SHA-256 与本地一致，四个文字文档返回 200。完整记录见 qa/production.json。作品站发布完成，Gym 产品新版视觉仍为本地版本。
