# 原画轻摆样片 · 2026-10-08

[打开历史 4.8 秒样片](http://127.0.0.1:4175/?companion-lab=1&review=gentle-v1) · [返回原图核对](http://127.0.0.1:4175/?companion-lab=1&review=originals)

此整体轻摆版已被用户认为僵硬，保留为历史。当前改为[呼吸与眨眼样片](../d-panda-idle/DELIVERY.md)，`review=gentle` 链接已指向新版。以下为旧版交付记录。

本次执行用户已同意的范围：从确认过的空手站姿分离背景，只做一段整体轻摆后回正。没有增加眨眼、局部关节、连续举手、动作库或摄像头。形象和动作幅度待用户审看。

## 样片

- 按“播放 4.8 秒样片”开始，顺序为静止、轻倾、短暂停留、反向轻倾、回正。最大倾斜 1.2°，固定大小；播放一次，默认不自动播放或循环。
- 可以暂停、拖动进度、以每步 1/30 秒检查，或回到原位。切换“同位置原图”时会停止并回正，便于核对五官与轮廓。
- 浅色、深色和透明棋盘背景用于查看毛尖、耳朵、爪子和腕结边缘。隐藏页面时暂停；素材失败有提示，并阻止空白播放。

## 形象保留方式

素材来自 `D2-character-accessories.png` 的 `[50, 140, 390, 475]` 区域，与原核对页的空手站姿相同。

没有重新生成或重画熊猫。透明资产是 **SVG 容器内嵌完整原 PNG，加背景透明遮罩**；遮罩根据原有轮廓选择前景，仅改变背景和外缘可见性。熊猫像素仍由原 PNG 提供。脚底原稿中可见的阴影单独保留，未补画身体下方不可见的区域。

- [透明角色 SVG](../../../public/companion-assets/d-panda/gentle/stand-original.svg)
- [原地面阴影 SVG](../../../public/companion-assets/d-panda/gentle/ground-original.svg)
- [来源、裁切范围和参数](../../../public/companion-assets/d-panda/gentle/manifest.json)

背景遮罩是由源像素计算的代码资产，不是将熊猫重描成矢量形状。透明素材中的原 PNG 与交付原图的 SHA-256 完全一致。没有修改七张设计原图。

**验证边界：**不透明角色区域的原画 RGB 保持一致；外缘有透明度处理，旋转及等比显示也会经过浏览器采样，因此不宣称动态截图每个屏幕像素与静态原图相同。原画边缘混有纸色，深背景下可能看见轻微浅边；没有通过改色或补画掩盖。当前是一张原画的整体轻摆，不是四肢或面部动画。

## 验证结果

- [样片七组检查](../../../evals/virtual-companion/d-panda/gentle-check-1791442911431/result.json)：内嵌原图字节一致；浏览器解码后 106,208 个不透明角色像素 RGB 差异为 0；暂停、逐帧、固定大小、最大角度、同位置对照、播放一次回正、隐藏暂停、390 像素视口和失败提示通过。
- [原图十四组回归](../../../evals/virtual-companion/d-panda/originals-check-1791442912866/result.json)：七张图与源文件字节一致，九个原尺寸画面与对应原稿区域的像素差异仍为 0。
- TypeScript 与独立生产构建通过：`evals/virtual-companion/d-panda/build-1791443010428/app`。
- 没有恢复旧绘制或镜像模块，没有部署。移动检查为浏览器视口检查，不是物理手机实测。

[实际桌面画面](../../../evals/virtual-companion/d-panda/gentle-check-1791442911431/desktop.png) · [透明边缘检查](../../../evals/virtual-companion/d-panda/gentle-check-1791442911431/edge-checker.png) · [深色背景检查](../../../evals/virtual-companion/d-panda/gentle-check-1791442911431/edge-dark.png)

## 维护

运行：`npm run dev:companion`。素材准备：`node scripts/prepare-d-panda-gentle.mjs`。样片核验：`node scripts/check-d-panda-gentle.mjs`。原图回归：`node scripts/check-d-panda-originals.mjs`。构建：`node scripts/build-d-panda.mjs`。

本轮停在这一段样片，后续内容等待用户审看后确定。
