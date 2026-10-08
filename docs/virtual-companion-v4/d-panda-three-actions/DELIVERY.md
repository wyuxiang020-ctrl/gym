# 三个原画动作 · 2026-10-08

> 后续状态：用户认可这一基线后，已整合进[原画动作与表情展示](../d-panda-library/DELIVERY.md)。这三个样片及第二版点头保持不变，旧审看入口继续可用。

**当前更新：**点头已按用户反馈改为单次小幅俯仰，取消侧歪、抬爪、强制闭眼及二次回弹。[新版点头说明与录像](NOD-REVISION-2.md)。下文保留三段首轮交付记录，其中点头的节奏和“动态五官距离不变”检查由新版说明替代。

[打开三个动作](http://127.0.0.1:4175/?companion-lab=1&review=actions) · [原待机](http://127.0.0.1:4175/?companion-lab=1&review=idle) · [原图核对](http://127.0.0.1:4175/?companion-lab=1&review=originals)

本轮按用户授权增加三个动作：点头鼓励、扶帽致意、轻轻伸展。均直接使用所提供的 D2 原稿，保留原 PNG，没有新绘制角色。采用准备、不同速度、弧线、头爪跟随与收势，详见[官方资料与具体应用](RESEARCH-AND-MOTION.md)。

## 看实际效果

[三个动作正常速度页面录像](../../../evals/virtual-companion/d-panda/actions-check-1791449103815/three-actions-normal-speed.webm) · [桌面画面](../../../evals/virtual-companion/d-panda/actions-check-1791449103815/desktop.png) · [390 像素宽度画面](../../../evals/virtual-companion/d-panda/actions-check-1791449103815/mobile.png)

| 动作 | 时长 | 可见变化 |
| --- | --- | --- |
| 点头鼓励 | 3 秒 | 头先准备再轻重点头，一次眨眼，胸口和前爪稍晚回应，脚底稳定 |
| 扶帽致意 | 3.6 秒 | 爪保持扶帽，头胸前倾致意、短停并抬起，另一爪与腕结跟随 |
| 轻轻伸展 | 5 秒 | 从原稿抬爪姿势轻蓄势，胸腹与双爪舒展，停留后呼气收回 |

默认静止、点击播放一次；支持暂停、继续、逐帧、关键时刻定位、同位置原图和深浅背景。播放中选择其他动作，会等待当前段结束后切换，下一段不会自动播放；可取消切换。暂停时可以直接选择其他样片。

## 原画与动作边界

- 点头来自 D2 主形象的 `[50, 140, 390, 475]`；扶帽来自同一张图的 `[530, 135, 420, 480]`；伸展来自 `D2-key-poses.png` 的 `[405, 540, 355, 345]`。
- 新增透明 SVG 内嵌源 PNG 的完整字节，仅以遮罩选择原画；地面阴影也来自原稿，没有补画遮挡区。[素材来源清单](../../../public/companion-assets/d-panda/actions/manifest.json)。
- 原图网格分区驱动头、胸腹、前爪与腕结。头部核心使用刚性变换；扶帽接触处共享变换；足底固定。初稿伸展耳部的网格折叠已在本轮修正，最终检查两种三角形方向均通过。
- 三段分别从对应原稿姿势出发并恢复。扶帽从已经接触帽檐的姿势开始，伸展从已经抬爪的姿势开始；未制作垂手上举、摘戴帽子或三个原姿势之间的连续转换。选择样片不冒充连续角色动作。
- 原稿身份、像素来源与屏幕像素完全不变不能混为一谈。局部变形、遮罩边缘和纹理采样会改变动态帧；深色背景下仍可能看到原纸色细边。原图核对入口继续提供未变的源图。

## 验证结果

- [新动作十一组检查](../../../evals/virtual-companion/d-panda/actions-check-1791449103815/result.json)通过：来源字节、五官距离、起止复位、脚底固定、帽爪接触、网格翻折与连续性、浏览器逐帧/暂停/对照/切换、隐藏暂停、错误恢复、正常速度完整播放。
- 浏览器解码后的不透明角色素材 RGB 与原稿一致：点头 106,208 个像素、扶帽 119,804 个像素、伸展 59,888 个像素，差异均为 0。每段起止截图一致，抽查关键帧的脚底与阴影区域像素一致。
- [既有待机九组回归](../../../evals/virtual-companion/d-panda/idle-check-1791449103939/result.json)通过。
- [原图十四组回归](../../../evals/virtual-companion/d-panda/originals-check-1791449103803/result.json)通过：七张运行原图字节不变，九个原尺寸画面与源图区域像素差异为 0。
- [TypeScript 与独立构建](../../../evals/virtual-companion/d-panda/build-1791449097715/result.json)通过，输出 `evals/virtual-companion/d-panda/build-1791449097715/app`。
- 检查使用 Windows 桌面 Edge 的隔离环境；390 像素视口不是物理手机实测。用户对自然度与幅度的审看、其他硬件的性能尚未验证。未部署、未写训练数据或开启相机。

## 源码与维护

- [动作节拍与分区](../../../src/companion/actionMotion.ts)
- [样片页面](../../../src/companion/ActionSamples.tsx)
- [共用原图纹理渲染器](../../../src/companion/OriginalIdleRenderer.ts)
- [原画素材选择脚本](../../../scripts/prepare-d-panda-actions.mjs)
- [动作核验脚本](../../../scripts/check-d-panda-actions.mjs)

启动 `npm run dev:companion`；素材准备 `node scripts/prepare-d-panda-actions.mjs`；动作核验 `node scripts/check-d-panda-actions.mjs`；待机/原图回归分别为 `node scripts/check-d-panda-idle.mjs`、`node scripts/check-d-panda-originals.mjs`；独立构建 `node scripts/build-d-panda.mjs`。

本轮完成三个样片，等待用户实际审看后再决定后续内容。
