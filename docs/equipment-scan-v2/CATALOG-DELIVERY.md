# 常见器械教学扩展 · 2026-10-12

> 后续已扩展为 14 类器械、34 个动作，含 15 个哑铃动作。见 [自由重量与器械教学](./FREEWEIGHT-DELIVERY.md)。

此文记录本次交付。既有推胸教学保留，新增 7 类，共 8 类器械、9 个动作。当前版本标识：**常见器械教学 · 2026-10-12**。

## 体验入口

[正式器械扫描页](https://gym-iota-self.vercel.app/?equipment-scan=1)。网页与已安装的 PWA 使用同一版本；旧窗口可在页脚检查更新后刷新。

拍照识别或手动选择 → 确认器械与动作 → 看短示范和 4 条使用说明 → 带入训练记录。每个动作有约 100 字说明，易错点用橙色加粗并标注“易错”。

## 新增内容与视频来源

| 器械 | 对应动作 | 片段时长 | 教学视频 |
| --- | --- | --- | --- |
| 高位下拉机 | 高位下拉 | 60 秒（原片约 68 秒，取前 60 秒） | [Planet Fitness](https://www.youtube.com/watch?v=grz-WsiBbrw) |
| 坐姿划船机 | 器械坐姿划船 | 60 秒 | [PureGym](https://www.youtube.com/watch?v=TeFo51Q_Nsc) |
| 坐姿腿举机 | 坐姿腿举 | 60 秒 | [PureGym](https://www.youtube.com/watch?v=p5dCqF7wWUw) |
| 腿屈伸机 | 坐姿腿屈伸 | 49 秒 | [DOP Strength](https://www.youtube.com/watch?v=Bch9qTirsVE) |
| 俯卧腿弯举机 | 俯卧腿弯举 | 60 秒 | [PureGym](https://www.youtube.com/watch?v=QjNFk4F5dAs) |
| 坐姿肩推机 | 器械坐姿肩推 | 55 秒 | [PureGym](https://www.youtube.com/watch?v=TnhIyp4kmO8) |
| 蝴蝶机夹胸 | 器械夹胸 | 56 秒 | [Danny Matranga](https://www.youtube.com/watch?v=AZFC0IjGhtQ) |

视频是外部原站嵌入、英文讲解；页面另配中文步骤与易错点。时长按秒取整。高位下拉保留原站完整来源链接。实测时长及播放证据在本目录 `catalog-verification.json`。没有下载、重剪或重新配音视频。

## 说明参考

- [PureGym 背部与高位下拉](https://www.puregym.com/exercises/back/lat-exercises/)
- [PureGym 器械设置、坐姿划船与俯卧腿弯举](https://www.puregym.com/blog/how-to-use-gym-equipment/)
- [PureGym 坐姿腿举](https://www.puregym.com/exercises/legs/quad-exercises/leg-presses/seated-leg-press/)
- [PureGym 腿屈伸](https://www.puregym.com/exercises/legs/quad-exercises/leg-extensions/)
- [PureGym 肩推与入门器械](https://www.puregym.com/blog/5-resistance-machines-gym-beginners-need-to-try/)
- [PureGym 器械夹胸](https://www.puregym.com/exercises/chest/chest-fly/machine-fly/)

仅归纳操作要点；现场调节以具体器械标牌为准。没有虚构每类器械的其他训练变式。

## 类别边界

坐姿划船为有胸垫的固定力量器械；腿举为水平坐姿配重式；腿弯举为俯卧式；夹胸为握把式。本轮不含有氧划船机、45° 倒蹬、坐姿腿弯举、组合站或反向飞鸟。无法判定时保留 unknown，由用户重新拍摄或手动选择。

前后端使用同一类别表。教程不由 AI 生成。用户必须确认后才能进入示范和记录；临时交接核对器械与动作是否匹配，30 分钟过期。选择新器械会清除上次确认，但保留已保存的训练记录。旧推胸交接格式兼容。

## 验证与边界

- 构建及本次修改范围静态检查通过。
- 新增 7 条视频均在隔离 Edge 的页面播放器内点击播放，读取真实视频时间持续前进；返回记录后播放器释放。
- 8 类器械在手机与桌面布局分别检查手选/固定识别响应、对应动作/视频/指南、带入记录及更换器械。
- 原有拍照流程 11 项、导航 2 种宽度、HTTP 保护和交接 7 项回归通过。
- 浏览器检查使用隔离的合成训练档案，不读取用户真实记录。AI 路由检查使用固定响应，不产生付费模型调用；新增类别的真实照片识别准确率尚待实拍评估。
- 第三方视频在本机网络可播放；不同地区/网络及发布者权限变化仍可能影响播放，界面保留失败提示与打开来源入口。

详细测试输出、视频时长及发布记录见 `catalog-verification.json`、`catalog-release-check.json`。
