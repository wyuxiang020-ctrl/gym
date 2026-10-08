# 图稿来源与生成记录

assets 中七张 PNG 均从本项目已有设计成果按原字节复制，没有重新生成或压缩。图稿使用内置 imagegen 制作；D3 动作与 D4 互动均选用修正后的最终图片。

| 包内文件 | 原设计文件 | 用途 |
| --- | --- | --- |
| assets/D1-character-turnaround.png | panda-design-study/short-paw-direction-d-v1.png | 已选 D 初始方向与概念转面 |
| assets/D2-character-accessories.png | panda-design-study/d-refinement/D2-character-accessories.png | 主体、草帽、竹子 |
| assets/D2-expressions.png | panda-design-study/d-refinement/D2-expressions.png | 常态六表情 |
| assets/D2-key-poses.png | panda-design-study/d-refinement/D2-key-poses.png | 八个关键姿势 |
| assets/D3-movement.png | panda-design-study/d3-expression-motion/D3-movement.png | 修正后的大幅动作图 |
| assets/D3-expressions.png | panda-design-study/d3-expression-motion/D3-expressions.png | 峰值六表情 |
| assets/D4-hand-interaction.png | panda-design-study/d4-hand-interaction/D4-hand-interaction.png | 修正单侧腕结后的分镜 |

原设计路径相对于仓库 docs/virtual-companion-v4。跨电脑使用时无需依赖这些原路径，实际图像已在本包 assets 中。

四份 D1 至 D4 的 image-prompts.json 是原始生成记录，保留当时提示词、参考路径和修订过程。里面可能出现未选 A/B/C、修正前输出或用户机器的旧绝对路径；它们是追溯记录，不能覆盖本包制作规范，也不能保证在另一电脑直接重放。D1 文件中仅 D 方向是本次选用角色。

本包不纳入未选方案图与修正前图，防止误作为制作主稿。D3 初稿曾有多余落地轮廓与步态问题，D4 初稿曾有双腕结；已保存的主图为修正版。

references/user-prop-reference.png 为用户提供的外部参考，只用于学习草帽与竹子参与动作的方式。没有将其处理成产品素材，也未将任何第三方网页图片下载进本包。

设计板不等于正交尺寸、透明精灵、逐帧序列、模型或动画。MANIFEST.json 在包根目录记录文件大小与 SHA-256；校验范围不包含 MANIFEST.json 自身。
