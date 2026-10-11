/** Public facts migrated from the AI resume (2026-10-02) and architecture about/contact pages. */
export const profile = {
  name: '王誉翔',
  enName: 'Yuxiang Wang',
  tagline: '关注知识检索与个人效率工具的 AI 产品实践者',
  role: 'AI 产品经理 / 产品策划',
  direction: 'AI 产品',
  email: 'm17347819733@163.com',
  phone: '15065171825',
  phoneDisplay: '+86 150 6517 1825',
  github: 'https://github.com/wyuxiang020-ctrl',
  xiaohongshu: '9535218642',
  language: 'IELTS 6.5',
  website: 'https://yuxiangworks.com/',
  portrait: '/images/yuxiang-portrait.jpg',
  resumePdf: '/downloads/yuxiang-wang-resume.pdf',
  originalResumePdf: '/downloads/yuxiang-wang-resume-original-2026-10-02.pdf',
  sourceUpdated: '2026.10.09',
  education: [
    { institution: '曼彻斯特大学 / 曼彻斯特建筑学院', date: '2025.09 — 至今', degree: 'MA Architecture and Adaptive Reuse · 硕士在读', result: '预计 Distinction', description: '建筑设计与适应性改造；跨学科研究、复杂信息梳理与方案表达。' },
    { institution: '四川美术学院', date: '2020.09 — 2025.06', degree: '建筑学学士', result: 'GPA 3.85 / 4.0 · 专业排名 1 / 50', description: '连续四年校级奖学金 · 本科毕业展入选。' },
  ],
  experience: [
    { institution: '重庆市设计院有限公司 · 建筑设计六院', date: '2024.03–2024.08', role: '建筑实习生', projects: [
      { name: '川渝（广安）教育协同发展试验基地建设项目', description: '重庆永安高校校园规划建筑项目联合负责人，参与将教育协同与地域特色的方向细化为功能布局、道路衔接和高差适配问题；参与实地踏勘、场地分析及方案比较，与设计师共绘总平面备选方案，完成图书馆、科研楼、食堂平立面图，支持团队完成投标方案交付并成功中标。' },
      { name: '北碚区酒店·医疗·康养文化小镇策划', description: '围绕酒店、医疗、康养与文化融合的策划目标，梳理养生、度假、周末游及亲子客群的不同需求；结合政策、区位与文化资源分析，参与功能定位与分期开发分析，绘制项目定位与开发重点的图示说明。' },
      { name: '重庆市巴山仪器有限责任公司职工安置房项目', description: '参与施工图深化，负责楼梯间、卫生间、屋面排水及部分节点大样，配合完成平立剖面图；按设计师反馈修订细节，使方案落到可实施图纸，项目于 2025 年落地并投入使用。' },
    ] },
  ],
  skills: [
    { name: '产品与评测', description: '需求拆解、用户流程、MVP 取舍、边界情况、评测与验收。' },
    { name: 'AI 产品实践', description: '理解结构化输出、RAG 与多模态交互；持续使用 ChatGPT、Claude、Codex 推进个人项目。' },
    { name: '建筑与表达', description: 'Rhino、SketchUp、CAD；场地研究、空间设计与图纸表达。' },
  ],
  awards: [
    { name: '国家奖学金', detail: '2024.09', note: '' },
    { name: '米兰设计周中国高校设计学科师生优秀作品展二等奖', detail: '', note: '按 2026.10.02 更新简历记载；旧建筑站记为三等奖，等级待证书核对。' },
    { name: '校级一、二等奖学金；三好学生、优秀学生干部', detail: '', note: '' },
  ],
  exhibitions: [
    { name: '四川美术学院 2025 届毕业展', project: '½ 日记——大院时光', href: '/architecture/half-diary/' },
    { name: '四川美术学院第 27 届本科生年展（2023）', project: '延续与重构', href: '/architecture/continuation/' },
  ],
} as const;

export const resumeProjects = [
  { name: '建筑团队 RAG 知识助手', en: 'Project Knowledge Copilot', date: '2026.05 — 至今', href: '/projects/knowledge-copilot/', points: [
    { label: '问题洞察与规划', text: '基于个人建筑资料分散、AI 回答难核验的场景，以用户任务（JTBD）拆解“找到证据—形成结论—原文核验”；独立负责 MVP、交互与评测，优先打通可信问答，暂缓企业权限与复杂 Agent。' },
    { label: 'RAG 方案与可信交互', text: '将系统拆为资料入库、检索、生成与证据核验四层，借助 AI Coding 基于 Next.js、pgvector、Voyage AI 与 Claude API 完成原型；区分回答、证据不足、引用异常与请求失败，设计引用校验、拒答及恢复路径。' },
    { label: '文档处理与迭代', text: '支持项目范围选择、可恢复批量向量化及分卷 PDF 阅读，将物理分卷组织为保留原页码的逻辑文档；处理 293 页真实资料、完成 289 个片段向量化，持续跟踪生成失败和等待时间。' },
    { label: '分层评测与取舍', text: '建立 16 题基线，分别检查检索命中、回答依据、引用与拒答。8 个已知答案问题 Hit@1 为 7/8（87.5%）；跨项目实验中，11 个检查项的目标项目覆盖由 9/11 增至 11/11，有效证据仍为 6/11，因此保留原默认策略。' },
  ] },
  { name: 'Gym · AI 健身与饮食记录', en: '个人产品项目', date: '2026.07 — 至今', href: '/projects/gym/', points: [
    { label: '发现问题、确定方向', text: '从自己的健身经历及同学、朋友的反馈出发，梳理查动作、重复录入、记录难坚持等问题，把产品重点调整为“认识器械—查看资料—开始训练—回看进步”。' },
    { label: '把需求做成可用产品', text: '负责需求、页面流程和验收标准，借助 AI 编程工具完成手机优先的健身产品，连接器械确认、训练计划、逐组记录、饮食记录和熊猫陪伴，并支持网页及桌面安装使用。' },
    { label: '让 AI 结果可检查', text: '将训练描述、饮食文字和照片转成可修改草稿，设计缺失提醒、重量确认和保存失败恢复；未知重量不默认填零，用户确认后才成为正式记录。' },
    { label: '根据反馈持续取舍', text: '根据查教学不方便、训练氛围不足、角色动作不自然等反馈调整入口与界面，暂停人体动作识别并撤下效果不佳的运动动画；用场景用例和实际界面检查记录、刷新与恢复是否一致。' },
  ] },
  { name: 'AI 辅助开发与交互式 3D', en: 'Architecture Portfolio Website', date: '2026.04 — 至今', href: '/projects/spatial-portfolio/', points: [
    { label: '用户阅读与产品表达', text: '面向招聘方和设计同行，将建筑作品组织为概览、过程、图纸与 3D 探索；通过分层内容、预设视角与图层控制，让读者先理解核心方案，再按需深入查看，减少图像堆叠和大型素材加载负担。' },
    { label: '原型落地与验收', text: '负责信息架构、内容取舍和交互验收，借助 Claude Code / Codex 交付原建筑站 11 个页面、两个真实模型；验证大图关闭恢复、返回后单画布和加载失败降级，原站于 2026 年 9 月完成生产发布。当前合并版的本地检查与线上发布分别记录。' },
  ] },
] as const;
