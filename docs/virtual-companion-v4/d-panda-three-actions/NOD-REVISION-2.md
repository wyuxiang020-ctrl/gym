# 点头第二版 · 2026-10-08

[打开点头样片](http://127.0.0.1:4175/?companion-lab=1&review=actions) · [正常速度录像](../../../evals/virtual-companion/d-panda/nod-v2-check-1791450019979/nod-v2-normal-speed.webm)

用户反馈首轮点头动作奇怪，要求补充参考案例并修改。当前只修改点头，仍直接沿用已确认的空手原稿，没有重新绘制角色。

## 排查与修改

旧版同时叠加屏幕平面内 2.7° 侧歪、整头向下 15 像素、胸腹变宽、双爪上抬、闭眼和第二次回弹。根据这些具体运动，判断其主体意图容易偏成耸肩晃头；这是本轮诊断，不是声称用户已逐项确认原因。

新版改为：短暂注意 → 一次轻点头 → 稍停 → 较慢抬回 → 安静停住。下点约 0.52 秒，峰值停留约 0.12 秒，抬回约 0.84 秒；整段仍为 3 秒。取消侧歪、抬爪、强制闭眼及第二次主下点。

头部使用原纹理的浅俯仰投影：鼻尖、前额与下巴产生不同的少量垂直位移，表现下巴轻收；水平坐标保持不变。胸口最多约 0.9 个原图像素的运动，双爪实际变化接近 0，脚底仍固定。该投影是单张原图的小幅动画近似，不是重建完整三维头部，也没有生成新面部或补画隐藏区域。

## 补充参考案例

| 案例 / 官方讲解 | 借鉴内容 | 本次具体采用 |
| --- | --- | --- |
| [Adobe：Head Turns & Parallax，Turner Bros. 示例](https://pages.adobe.com/character/en/tutorials)（[官方页所列视频](https://youtu.be/g1wbw6-7zM4)） | 页面区分多视角原画切换和局部视差，后者通过部位运动差提供立体感 | 沿用单张熊猫原纹理，以浅俯仰视差代替整头侧歪平移；幅度和深度权重由本项目试制 |
| [Adobe：Creating a basic body，Chloe / Zoe 示例](https://www.adobe.com/learn/adobe-character-animator/web/create-animated-body) | 官方教程讲解头身连接，指出完全独立的头部可能显得与身体分离 | 保留连续原图网格，并让胸口少量跟随，检查头身过渡 |
| [Animation Mentor：How to Animate Secondary Motion，Aristotle 示例](https://www.animationmentor.com/blog/tutorial-how-to-animate-secondary-motion/) | 以打喷嚏示例解释先明确头部主运动，再添加跟随、逐渐收稳 | 让点头意图先清楚，去掉抢占意图的抬爪与反复回弹，收稳后停住 |

查阅的是官方页面说明与公开教程文字；没有把这些示例下载、导入或复制成熊猫动作，也没有声称完整观看过视频。案例原理用于本轮实现判断，不能作为本角色自然度已经通过的证明。

## 实际检查

- [点头专项四组检查](../../../evals/virtual-companion/d-panda/nod-v2-check-1791450019979/result.json)：峰值时鼻尖下移约 6.23、前额约 3.95、下巴约 3.18 个原图像素，三者横向位移均为 0；双爪垂直变化小于 0.001 像素。起止截图完全一致。
- 扶帽与伸展各 4 个既有截帧、共 8 帧，与修改前记录逐像素一致。原画素材文件未修改。
- [十二组动作回归](../../../evals/virtual-companion/d-panda/actions-check-1791450021185/result.json)通过：一次主下点、暂停、逐帧、切换、足底、素材一致性、连续性、错误恢复、实际完整播放；最终网格无翻折。
- 因为增加浅俯仰透视，动态面部检查点之间的距离最大变化约 2.34%，因此新版不再宣称二维五官距离严格不变。水平比例保持，结束恢复原图。
- [TypeScript 与独立构建](../../../evals/virtual-companion/d-panda/build-1791450011742/result.json)通过。

[原位](../../../evals/virtual-companion/d-panda/nod-v2-check-1791450019979/nod-0.png) · [点头峰值](../../../evals/virtual-companion/d-panda/nod-v2-check-1791450019979/nod-1030.png) · [抬回](../../../evals/virtual-companion/d-panda/nod-v2-check-1791450019979/nod-1510.png)

浏览器验证为 Windows 桌面 Edge；新版幅度与自然度仍待用户看实际样片。未改其他动作、待机、镜像或训练数据，也未部署。
