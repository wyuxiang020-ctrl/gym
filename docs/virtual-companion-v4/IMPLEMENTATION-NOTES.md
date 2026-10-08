# V4 阶段 1 实现与资产说明

本文件描述实际代码。参考图仍是设计意向，不作为三维资产或运行证据。验收状态以 [STAGE-1-DELIVERY.md](STAGE-1-DELIVERY.md) 为准。

## 可复现角色与坐标

生成器：[pandaRig.ts](../../src/companion/pandaRig.ts)。角色由真实三维椭球网格和关节枢轴组成，是原创程序化分段模型，不是蒙皮模型；本轮没有输出 GLB，也没有需要重新导入验收的 GLB 文件。

世界采用右手坐标系：Y 向上、Z 朝角色正面、X 正方向是角色解剖左侧。正面观看时角色左臂在画面右边。单位为任意场景单位，根节点位置为 0，缩放为 1。层级为 `panda-root → torso → left/right-shoulder → elbow → hand`，头部在 torso 下。腿部不驱动。

| 参数 | 当前配置 |
| --- | --- |
| 肩枢轴 | X=±0.64，Y=1.79 |
| 上臂 / 前臂 | 0.48 / 0.43 单位 |
| 肩角 | 垂直向下为 0，向外抬升；范围 0–2.60 rad |
| 肘角 | 在肩的局部坐标继续弯曲，0–1.25 rad |
| 肩肘组合 | 和不超过 2.95 rad |
| 静止姿势 | 左右肩 0.10 rad，肘 0 |
| 预设顶点 | 肩 2.55 rad，肘 0.30 rad |
| 头部椭球半径 | X=0.62，Y=0.55，Z=0.44 |

左肩与左肘绕 Z 正方向旋转，右侧绕 Z 负方向。旋转上臂会带动整个下级，肘部旋转不改变肩和肘的世界位置。渲染端有最后一道有限值/角度保护；镜像端在范围检查失败时直接暂停可信驱动，不把被限幅的姿态宣称为精确复制。

预设是 8 秒空手抬起、短暂停留、放下的关节曲线；用户可选择画面左手、右手或双手，暂停、回到起点及拖动进度检查。根节点不以弹跳冒充动作。预设不是审校过的健身教学。

## 渲染配置

`PandaStage.tsx` 使用 Three.js `WebGLRenderer`、正交相机、MeshToonMaterial 和三级明暗纹理，材质以奶白、炭黑和低饱和绿为主，无毛发或写实反射。清晰模式 DPR 上限 2；像素模式每帧绘制同一场景，缓冲尺寸为画布 CSS 尺寸分别除以 2、4、6，再用 `image-rendering: pixelated` 显示。没有截图缩放或预渲染序列替代真实动画。

切换显示不改变 getPose、关节、镜头、光照或 CSS 画布尺寸。正面、36° 斜侧和 90° 侧面用于结构检查；相机稍俯视固定注视角色中央。像素显示不受支持或缓冲太小时回退清晰并提示。WebGL 失败后停止相机，用户可重新加载角色。

指标中的 FPS 和 p50/p95 帧间隔来自成功 `renderer.render` 周围的调度，不是 GPU 单帧执行时间。像素化不自动等于省电；设备表现以实际记录为准。

## 本机镜像与生命周期

`MirrorSession` 是唯一相机生命周期入口，默认使用真实浏览器接口；依赖注入只供独立软件测试使用。正式入口没有假相机、回放选择或测试控制全局变量。

1. 用户点击开启；请求 `video`，明确 `audio: false`。拒绝/无设备/占用/非安全地址有错误出口。
2. 许可成功后启动 classic worker，加载同源 bundle、WASM 和模型。使用 classic 形式是为了兼容官方 WASM loader 的 `importScripts`。
3. 最大输入框 640×480，保持实际宽高比。一次最多一个 ImageBitmap 在途，最多约 20 次/秒，避免排队处理旧帧。
4. 同步 `detectForVideo` 在 worker 中执行，返回姿态后在主线程进行可信度、鲜度及可表达范围检查，映射二维方向并平滑更新角色。
5. 低可信、关键点出画/遮挡、多人、侧身、大幅倾斜、向前伸手、交叉或超出范围时暂停。保持最后可信姿势；连续两个可信结果后平滑恢复。
6. 权限等待 30 秒、模型准备 45 秒、视频启动 10 秒、单帧取帧/推理 5 秒均有上限。超过 350ms 的结果不驱动，500ms 没有更新时暂停。
7. 模式切换、隐藏、退出、错误和卸载会终止轨道与 worker、清理计时器和监听器。异步权限或位图晚到时直接释放；重新可见不会自动开启摄像头。

镜像关系：人体左侧关键点 11/13/15 驱动熊猫右臂，人体右侧 12/14/16 驱动熊猫左臂；相机预览仅水平翻转一次。因此在正面视角中，你抬左手对应画面左侧。归一化坐标按实际宽高换算后计算肩/肘方向。单目深度只作保守拒绝信号，不用于任意三维动作捕捉。

运行中画面和原始关键点仅存在内存，不上传、不写文件、不写 local/session storage，不导出可回放轨迹。汇总指标与自动化测试的固定输入不等于真实身体数据。实验不导入 store，也不写重量、热量或完成记录。

### SDK 的出站限制

首次取消测试网络拦截后，发现 MediaPipe 1.1.0 在初始化时尝试向 Google 的 `odml.pa.googleapis.com/v1/log` 发送日志 POST。测试只输入灰色合成画面，未启用真实摄像头。官方 SDK 没有已核实的公开关闭选项，因此不能只依据「模型在本地运行」推断它没有遥测。

现在实际 `pose-worker.js` 在任何第三方代码执行前锁定网络接口：fetch/importScripts 仅允许列出的八个同源静态资源 URL，fetch 仅 GET/HEAD，禁止重定向并省略凭据；其他不需要的网络通道禁用。没有改写第三方 bundle。Vite 开发和本地 preview 服务还对 worker 响应设置 `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`，限制执行及连接来源。该策略只作用于姿态 worker；未来若更换托管方式，需配置等效响应头并重新验证，不能假定构建文件自动携带 HTTP 头。

日志只记录阻断次数和性能汇总，不记录请求正文、人体帧或关键点轨迹。网络边界软件检查与无测试路由拦截的真实模型复核分开保存，首次失败证据保留。最终复核结果见交付报告。

### SDK 的出站限制

首次取消测试网络拦截后，发现 MediaPipe 1.1.0 在初始化时尝试向 Google 的 `odml.pa.googleapis.com/v1/log` 发送日志 POST。测试只输入灰色合成画面，未启用真实摄像头。官方 SDK 没有已核实的公开关闭选项，因此不能只依据「模型在本地运行」推断它没有遥测。

现在实际 `pose-worker.js` 在任何第三方代码执行前锁定网络接口：fetch/importScripts 仅允许列出的八个同源静态资源 URL，fetch 仅 GET/HEAD，禁止重定向并省略凭据；其他不需要的网络通道禁用。没有改写第三方 bundle。Vite 开发和本地 preview 服务还对 worker 响应设置 `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'`，限制执行及连接来源。该策略只作用于姿态 worker；未来若更换托管方式，需配置等效响应头并重新验证，不能假定构建文件自动携带 HTTP 头。

日志只记录阻断次数和性能汇总，不记录请求正文、人体帧或关键点轨迹。网络边界软件检查与无测试路由拦截的真实模型复核分开保存，首次失败证据保留。最终复核结果见交付报告。

## 包、模型、许可与来源

| 内容 | 固定版本 / 来源 | 许可 |
| --- | --- | --- |
| Three.js | 0.186.1，[官方项目](https://github.com/mrdoob/three.js) | MIT |
| Three 类型声明 | @types/three 0.186.0，开发依赖 | MIT |
| MediaPipe Tasks Vision | 1.1.0，[官方项目](https://github.com/google-ai-edge/mediapipe) | Apache-2.0 |
| Pose Landmarker Lite | float16 第 1 版，[官方固定模型](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) | 模型卡第 2 页标明 Apache-2.0 |
| 熊猫模型 | 本仓库程序化原创网格与配置 | 无购买或外部角色素材 |

模型 SHA256 为 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`，大小 5,777,746 字节。模型包含 224×224 检测器和 256×256 关键点模型；CPU delegate，VIDEO 模式，置信度阈值 0.65，关闭分割输出。`numPoses=2` 仅用于拒绝多人画面，不提供多人镜像。

来源及边界依据：[Google 网页姿态指南](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)、[模型卡](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf)、[Three.js 卡通材质](https://threejs.org/docs/pages/MeshToonMaterial.html)。本地许可副本位于 `public/companion-assets/MEDIAPIPE-LICENSE.txt` 与 `THREE-LICENSE.txt`。安装使用固定版本，禁用安装脚本，未安装大型建模软件。

[资产准备脚本](../../scripts/prepare-companion-assets-v4.mjs)复制固定 npm 包内的同源 JS/WASM、下载固定模型并验证文件哈希，已有文件内容不符会停止。首份[资产清单](../../evals/virtual-companion/v4-poc/assets-1791374308264.json)记录来源、许可和字节哈希；最终新增许可与 worker 的哈希纳入交付索引。

磁盘保留官方包的 SIMD、非 SIMD、module 变体，合计资源约 45 MB；一次运行仅加载所需变体。普通页面不会因为 PWA 安装而预缓存这些资源。模型/WASM 同源读取、既有 Google Fonts 外联与人体上传是不同事项；本轮不宣称全站零外联或已经验证完整断网体验。

## 本地使用

在 `E:\gym` 执行 `npm run dev:companion`，打开 [本地实验](http://127.0.0.1:4175/?companion-lab=1)。服务仅监听回环地址，前端不运行既有云端 API；端口已被占用会报错，不终止其他进程。Ctrl+C 停止该前端服务；关闭实验或点击停止相机释放浏览器设备。

`npm run build:companion` 先运行 `tsc -b`，再禁用 env 文件加载并构建到 `evals/virtual-companion/v4-poc/build`，不覆盖原 `dist`。阶段 1 交付后不自动部署或进入下一阶段。
