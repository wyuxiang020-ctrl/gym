# D 熊猫 · 原画动作与表情展示

> 后续增量：当前展示页已支持清晰/像素切换，并新增独立[抬手互动入口](http://127.0.0.1:4175/?companion-lab=1&review=mirror)。原有 23 段与减半时长保留。阶段一功能及实际测试范围见[原画阶段一交付](../d-panda-stage1/DELIVERY.md)；下文保留原展示库交付记录。

2026-10-08。本轮把已认可的原画局部动画方式扩展到一个统一入口，保留原形象，不生成或重新绘制角色。

**当前修订：小跳改用 D3“跃起欢呼”原稿，展示页全部 23 段时长已缩短 50%。下表是新的实际播放时长。**其他 22 段的幅度与相同进度画面保持不变，历史样片入口仍保留原时长供对照。

[打开本地展示](http://127.0.0.1:4175/?companion-lab=1) · [原图核对](http://127.0.0.1:4175/?companion-lab=1&review=originals) · [已认可的三个样片](http://127.0.0.1:4175/?companion-lab=1&review=actions)

## 当前可体验内容

| 内容 | 时长 | 动态及来源边界 |
| --- | --- | --- |
| 呼吸与眨眼 | 3 秒 | 沿用已认可的 D2 空手站姿待机 |
| 点头鼓励 | 1.5 秒 | 沿用第二版小幅俯仰，无侧歪或耸肩 |
| 扶帽致意 | 1.8 秒 | 沿用已认可样片，保持手帽接触 |
| 轻轻伸展 | 2.5 秒 | 沿用 D2 伸展原稿与已认可运动 |
| 持帽致意 | 2.1 秒 | D2 已摘帽姿势，轻俯身后回正，不含摘帽过程 |
| 挥爪招呼 | 2.15 秒 | D3 高举爪姿势，两次弧线挥动，支撑脚固定 |
| 持竹同行 | 2.25 秒 | D3 迈步姿势，重心、另一爪及后脚跟随；不是连续换脚行走 |
| 回望邀请 | 2 秒 | D3 已回望姿势，头胸轻微回应，不含完整转身 |
| 小小庆祝 | 1.9 秒 | D2 单脚支撑，举爪、胸腹和自由脚少量配合 |
| 坐着歇歇 | 3.25 秒 | D2 坐姿呼吸，地上道具固定；不含坐下起身 |
| 小跳欢呼 | 1.65 秒 | 同一张 D3 欢呼稿蓄力、举爪腾空、落地缓冲，保留抬脚笑脸；不是三关键态拼接 |

12 种表情分别是平静、好奇、专注、鼓励、小得意、放松、开怀大笑、哇惊喜、认真蓄势、调皮眨眼、得意一下、呼气放松。它们使用完整的原画半身肖像，配合不同方向、节拍的轻微头胸动态；没有把各张头部替换到同一全身角色上，也没有宣称完成连续面部变形系统。

通常表情由 3.6 秒变为 1.8 秒；“放松”和“呼——放松”由 5.2 秒变为 2.6 秒。动作组净时长由 48.2 秒变为 24.1 秒，表情组由 46.4 秒变为 23.2 秒，不包括素材加载耗时。

小跳新节拍：0–0.35 秒轻蓄力，0.35–0.51 秒蹬地，0.51–0.99 秒单次飞行，0.75 秒到最高点；接地后胸腹先缓冲，头部约晚 0.03 秒跟随，约 1.51 秒恢复原位。源坐标离地高度由 76 改为 44 像素，避免时长减半后仍快速大幅抬起。两爪与自由脚做局部跟随，脸部整体保护。仍是单张原稿的轻蹦表演，不声称补齐了完整自然站立到大跳的过渡资产。

每段支持播放一次、循环或按组顺序播放。默认静止，系统减少动态偏好作为初始设置；减少动态时缩小运动，小跳不离地。暂停冻结进度，继续从当前帧恢复；页面隐藏暂停。播放中选下一段会等当前段收稳，可以取消。最后一段播完后结束本组，不无限自动重播。

原图对照、逐帧、关键时刻与背景检查保留。加载失败或 WebGL 中断显示恢复入口，素材失败仍能查看来源原图。片段可通过 `clip` 参数直接访问，例如 `?companion-lab=1&clip=wave`。

## 保留原画的方法

七张交付 PNG 逐字节保留。透明素材以 SVG 遮罩选择原画像素，内部嵌入原 PNG 完整字节；胸腹、头爪等通过同一纹理网格做小幅变形。没有新增毛发、脸型、手掌或隐藏区域绘画，动态纹理采样并不等于每个屏幕像素不变。

新增素材的几处处理均为选择范围修正：坐姿和庆祝排除邻格残片；表情下缘开放的奶白腹部按两侧已有轮廓选择原像素；D3 下排毛簇增加上方查看范围。小跳阴影取自 D3 腾空稿下方无遮挡的原阴影，作为独立地面层，未补画阴影。

原画中的各个独立绘图本身有姿势、透视差异。本次按用户“不重画”的要求保留这些差异，没有以“统一模型”为由重新改脸。展示片段之间的切换不是角色实际摘戴道具或改变姿势的连续过程。

## 参考与应用

- [Spine 官方 Mesh attachments](https://esotericsoftware.com/spine-meshes)：原图贴在网格上，以顶点和权重控制局部变化。当前使用项目已有的轻量 WebGL 网格，没有安装 Spine 运行时。
- [Spine 官方 Timing and Spacing](https://esotericsoftware.com/blog/Timing-and-Spacing-Animating-with-Spine-3)：不同阶段使用不同时间和运动间距。挥爪采用两次递减幅度，休息采用慢呼吸，小跳采用无顶点悬停的单次抛物线。
- [Adobe 动画原则](https://www.adobe.com/creativecloud/animation/discover/principles-of-animation.html)：借鉴准备、弧线、缓入缓出与附随运动。保护面部完整区域和支撑点，避免通用全身摆动覆盖所有动作。

这些资料支持制作方法，不证明当前新增动作已经通过用户审美验收。

## 验证与实际产物

- 本次正常速度录像：[减半后的 11 段动作](../../../evals/virtual-companion/d-panda/library-recording-1791453562698/actions-normal-speed.webm)、[减半后的 12 种表情](../../../evals/virtual-companion/d-panda/library-recording-1791453562698/expressions-normal-speed.webm)。两组均实际播完，无脚本错误；新小跳位于动作组末尾。
- [本次小跳与时间专项](../../../evals/virtual-companion/d-panda/jump-timing-check-1791453498776/result.json)：4 组通过。23 段严格减半，22 段运动与峰值截图和修改前相同；小跳只有一次离地，面部距离保持，实际播放约 1.67 秒（含自动化操作开销）。同目录保存蓄力、起跳、腾空、落地与深色背景截帧。
- [本次展示回归](../../../evals/virtual-companion/d-panda/library-check-1791453814906/result.json)：13 组通过，覆盖更新后的网格、原图素材、减半进度、暂停、循环、顺序播放、异常恢复和移动布局。
- [本次 TypeScript/独立构建](../../../evals/virtual-companion/d-panda/build-1791453767587/result.json)：通过。

以下记录保留首次展示版的原图与历史基线，时长以本页当前修订为准：

- 正常速度完整播放录像：[11 段动作](../../../evals/virtual-companion/d-panda/library-recording-1791452416209/actions-normal-speed.webm)、[12 种表情](../../../evals/virtual-companion/d-panda/library-recording-1791452416209/expressions-normal-speed.webm)。[录制结果](../../../evals/virtual-companion/d-panda/library-recording-1791452416209/result.json)通过，两组均实际播放至最后一段并结束，无脚本错误。
- [新版检查结果](../../../evals/virtual-companion/d-panda/library-check-1791452348445/result.json)：13 组通过，覆盖 23 段正常/减少动态、原色与透明区、起止截帧、网格翻折、接地、播放控制、隐藏暂停、异常重试、系统偏好、桌面/移动布局与资源边界。
- [原图检查结果](../../../evals/virtual-companion/d-panda/originals-check-1791452134162/result.json)：14 组通过。七张原图逐字节一致，九个原尺寸视图像素差异为 0。
- [已认可动作检查](../../../evals/virtual-companion/d-panda/nod-v2-check-1791452134408/result.json)：4 组通过；点头保持第二版，扶帽与伸展的 8 个对照截帧未变。
- [TypeScript 和独立构建](../../../evals/virtual-companion/d-panda/build-1791452342677/result.json)：通过；产物为该目录下 `app`，没有覆盖旧 `dist`。角色素材与实验块保持排除在 PWA 预缓存之外。
- [桌面实际页面](../../../evals/virtual-companion/d-panda/library-check-1791452348445/desktop.png)、[移动宽度页面](../../../evals/virtual-companion/d-panda/library-check-1791452348445/mobile.png)、[深色背景表情](../../../evals/virtual-companion/d-panda/library-check-1791452348445/expression-11-dark.png)。同目录保存全部 23 段原位与峰值截图。

真实相机、物理手机性能、离线完整加载、上线部署没有测试。软件检查不替代用户对新动作自然度的确认。

## 可编辑源与复现

`src/companion/OriginalCompanion.tsx` 为新入口和播放器；`companionCatalog.ts` 管理原稿与节拍；`libraryMotion.ts` 管理新运动；`library.css` 为展示样式。已认可的 `idleMotion.ts`、`actionMotion.ts` 与共享 `OriginalIdleRenderer.ts` 未改写。

```powershell
npm run dev:companion
node --import ./scripts/ts-test-loader.mjs scripts/prepare-d-panda-library.mjs
node --import ./scripts/ts-test-loader.mjs scripts/check-d-panda-library.mjs
node --import ./scripts/ts-test-loader.mjs scripts/check-d-panda-jump-timing.mjs
node scripts/record-d-panda-library.mjs
node scripts/build-d-panda.mjs
```

素材准备只生成 `public/companion-assets/d-panda/library/`，不改交付包。`manifest.json` 记录每项来源、裁切、源文件哈希和小跳阴影的独立来源范围。

## 仍未完成的旧交接范围

连续左右抬爪与摄像头镜像、像素显示、走路完整步态、站坐转换、摘戴道具、正反面连续转身、D3 三关键态的大幅跳跃和可叠加到全身的连续表情都不在当前已完成清单。继续这些内容需要明确解决过渡/隐藏原画的来源，不能默认为获得了重画授权。
