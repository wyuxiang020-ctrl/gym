# 原画呼吸与眨眼样片 · 2026-10-08

[打开 6 秒样片](http://127.0.0.1:4175/?companion-lab=1&review=idle) · [返回原图核对](http://127.0.0.1:4175/?companion-lab=1&review=originals)

本轮完成用户确认的局部待机方案：轻轻吸气，头与前爪稍晚跟随，眨一次眼，再缓慢呼气回到原画站姿。只交付这一段供审看；自然度与幅度尚待用户确认。

## 实际效果

[实际页面正常速度录像](../../../evals/virtual-companion/d-panda/idle-check-1791445424126/idle-normal-speed.webm) · [桌面画面](../../../evals/virtual-companion/d-panda/idle-check-1791445424126/desktop.png) · [手机宽度画面](../../../evals/virtual-companion/d-panda/idle-check-1791445424126/mobile.png)

- 默认静止，点击“播放 6 秒样片”播放一次。可暂停、继续、回到原位、拖进度及每步 1/30 秒查看。
- “吸气顶点”“闭眼瞬间”“呼气跟随”可直接定位检查；“同位置原图”回到静止原稿对照。
- 脚底与阴影保持固定；胸腹轻微起伏，头部、前爪、腕结使用不同的跟随时机，没有全身根节点左右旋转。
- 眨眼约发生在 2.24–2.56 秒，闭合约 100 毫秒、停留约 60 毫秒、打开约 160 毫秒。播放结束恢复原站姿。
- 深浅背景和透明棋盘可检查边缘。隐藏页面自动暂停；素材失败或 WebGL 中断显示提示并停止播放。

## 原画保留方式

站姿来自 `D2-character-accessories.png` 的 `[50, 140, 390, 475]` 区域。继续使用含完整原 PNG 字节的透明遮罩素材，没有重画身体或五官。

闭眼来自 `D2-expressions.png` 右下角“放松”表情：源图中的 `[1187, 657, 77, 65]` 与 `[1315, 672, 62, 64]` 区域，对齐到空手站姿眼部。覆盖范围限制在原黑色眼斑内部，保留其外缘。闭眼素材内嵌完整原表情 PNG，遮罩与映射参数可复查，没有新增绘画。

- [闭眼局部与原图来源参数](../../../public/companion-assets/d-panda/idle/manifest.json)
- [闭眼素材 SVG](../../../public/companion-assets/d-panda/idle/closed-eyes-original.svg)
- [素材准备脚本](../../../scripts/prepare-d-panda-idle.mjs)
- [运动节拍与分区](../../../src/companion/idleMotion.ts)
- [原图纹理渲染](../../../src/companion/OriginalIdleRenderer.ts)

身体在一张连续的二维原图网格上分区运动，避免拆开手臂或头后出现缺少原画像素的空洞；脸部核心区域只随头整体平移与旋转，五官之间的距离保持不变。胸腹与爪子只做小幅变化，脚底完全固定。此实现不是程序化重绘角色、三维模型或完整骨骼动作库。

**保留原画不等于动态帧逐像素不变。** 原 PNG 的字节不变，但局部运动、闭眼对齐、遮罩和纹理采样会改变屏幕像素。完整原图入口保持原样，可用 1:1 模式复核。深色背景下仍可能看到原稿纸色造成的细浅边；没有改色或新绘画掩盖它。

## 验证

- [样片九组核验](../../../evals/virtual-companion/d-panda/idle-check-1791445424126/result.json)：原文件与嵌入字节、仅一次眨眼、头部五官距离、脚底固定、起止复位、网格无翻折、实际播放暂停、逐帧、对照、隐藏暂停、手机宽度、错误提示和正常速度录像通过。
- 浏览器实际截帧中，0 秒和 6 秒整个角色区域像素一致；0、1.8、2.28、2.37、2.48、3.6、6 秒的脚底与阴影区域像素一致。[闭眼浅底](../../../evals/virtual-companion/d-panda/idle-check-1791445424126/frame-2370.png) · [闭眼深底](../../../evals/virtual-companion/d-panda/idle-check-1791445424126/closed-dark.png)。
- [原图十四组回归](../../../evals/virtual-companion/d-panda/originals-check-1791445423842/result.json)：交付包文件完整；七张运行原图字节一致；九个原尺寸站姿、道具和抬手画面与源区域像素差异为 0。
- [TypeScript 与独立生产构建](../../../evals/virtual-companion/d-panda/build-1791445418928/result.json)通过。输出 `evals/virtual-companion/d-panda/build-1791445418928/app`，没有覆盖历史构建或部署。
- 运行检查使用 Windows 桌面 Edge 的隔离浏览器环境。390 像素宽度检查不等同于物理手机性能测试；用户审美验收、不同硬件的帧率尚未完成。

## 维护与范围

启动 `npm run dev:companion`；准备素材 `node scripts/prepare-d-panda-idle.mjs`；样片检查 `node scripts/check-d-panda-idle.mjs`；原图检查 `node scripts/check-d-panda-originals.mjs`；独立构建 `node scripts/build-d-panda.mjs`。

`review=idle` 与 `review=gentle` 都进入新版。旧整体旋转版仅保留于 `review=gentle-v1`，原核对入口不变。本轮没有新增抬手中间帧、其他表情、摄像头、镜像、训练数据写入或外部服务调用。
