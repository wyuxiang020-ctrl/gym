# Gym 保存流程 V3 复核入口

先读 [评分口径](RUBRIC.md) 和 [本轮交付](../../../docs/weekly-save-v3/DELIVERY.md)。本目录是新增版本，不覆盖workout-parser的V1/V2档案。

## 本地运行

在项目目录运行 `npm run dev:full` 启动完整服务，端口3000。前端自动测试另用 `npm run dev -- --host 127.0.0.1 --port 4173`。

- `npm run check:workout-save`：确定性测试，不调模型。
- `npm run check:workout-browser`：隔离浏览器中的固定响应、网络/容量故障注入与实际localStorage比对，不调模型。需要Playwright与其ffmpeg录屏依赖；可使用已安装的playwright，或通过`GYM_PLAYWRIGHT_PATH`指向现有包目录。默认Edge，使用`GYM_BROWSER_CHANNEL`可选已安装通道。
- `GYM_VIEWPORT_WIDTH=390` 可检查窄屏布局（PowerShell用 `$env:GYM_VIEWPORT_WIDTH='390'`），这不等于手机真机。
- `npm run eval:workout:v3 -- --live --suite=regression`：会付费，从旧20条读取原文，结果写新的时间戳目录。需要服务端已有配置和匹配的GYM_DEMO_ACCESS_CODE；不要把访问码/API key放在命令参数或提交到仓库。本轮通过`vercel env run`给子进程注入已授权Development环境，未修改密钥。
- `--suite=holdout` 是冻结后的最后测试，不是反复调优入口。本轮已完成一次；未来重测应先声明新版本/用途，不把多次挑选后的成绩当第一次独立结果。
- `npm run replay:workout:v3 -- <已完成留出运行目录>`：将真实API响应回放到浏览器，按预声明的合成修正规则核验确认/保存/重开，没有新模型费用，也不是用户数据。

录屏可用`GYM_DEMO_SLOW_MS`减慢操作；屏幕始终标明合成资料、固定API响应、自动化演示和版本。测试只创建隔离浏览器数据，不使用真实用户档案。

## 主要结果

首轮回归 `regression-1790777583385` 为19/20；第二轮 `regression-1790777895237` 为20/20；最后留出 `holdout-1790778147007` 为8/8。每个目录有每题原始响应、独立attempt、完整run与检查点。检查点是运行时快照，不是另一次实验，不应重复计数。

`smoke-1790777446110` 的401先于后续成功预检，不能删除或当作模型成功。`verification-1790778358958.json` 保存最终构建、lint、各检查输出以及历史评测未改变和留出后源码未改变的验证。

本轮曾有录屏依赖缺失、网络沙箱拦截以及旧V2合约自重夹具尚未迁移的开发检查失败；这些是工具/夹具问题，不计为模型样本。真实模型与真人测试严格分开，具体限制见交付说明。
