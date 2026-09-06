# Food AI V1 合成照片资产

## 证据边界

这里的 5 张基础餐图由 OpenAI 内置图像生成工具创建，只用于测试 Gym 的照片识别接口。它们不是用户上传、真实研究照片或营养真值。每张图的食物类别由生成提示词指定；视觉份量、烹饪油和营养数据仍不确定，因此照片评测只把食物类别召回/精确度、结构有效性、置信度提示和数值合理性作为主要指标，不把某个克数或热量视为精确真值。

`meal-06`～`meal-10` 由脚本对对应基础图做亮度、裁切、旋转或 JPEG 压缩，测试输入质量变化下的稳定性。所有资产均明确标记为 synthetic。

## 基础图与生成提示

| 文件 | 指定可见食物 | 生成提示摘要 |
|---|---|---|
| `generated/meal-01-chicken-rice-broccoli.png` | 烤鸡胸肉、白米饭、西兰花 | 白色餐盘、三种食物分区、俯拍、自然光、无其他食物 |
| `generated/meal-02-oatmeal-fruit-walnuts.png` | 燕麦粥、香蕉、蓝莓、核桃 | 早餐碗、配料可区分、自然晨光、无其他食物 |
| `generated/meal-03-noodles-egg-bokchoy.png` | 清汤面、水煮蛋、青菜 | 深碗、三种食物清晰可见、无肉和额外配菜 |
| `generated/meal-04-yogurt-strawberry-granola.png` | 原味希腊酸奶、草莓、格兰诺拉麦片 | 透明玻璃碗、三种食物可区分、无其他水果 |
| `generated/meal-05-tofu-pepper-brown-rice.png` | 煎豆腐、红甜椒、糙米饭 | 三种食物分区、家常摆盘、无肉和额外蔬菜 |

完整生成提示保留在创建这些资产的 Codex 任务记录中。基础图由内置 `image_gen` 生成；变体由 `scripts/create-food-eval-variants.mjs` 确定性生成。

## 变体映射

| 变体 | 基础图 | 处理 |
|---|---|---|
| `meal-06-chicken-rice-broccoli-dim.jpg` | meal-01 | 降低亮度与饱和度、JPEG 压缩 |
| `meal-07-oatmeal-fruit-walnuts-crop.jpg` | meal-02 | 居中方形裁切、JPEG 压缩 |
| `meal-08-noodles-egg-bokchoy-rotated.jpg` | meal-03 | 旋转 7°、JPEG 压缩 |
| `meal-09-yogurt-strawberry-granola-compressed.jpg` | meal-04 | 缩小到 640px、较强 JPEG 压缩 |
| `meal-10-tofu-pepper-brown-rice-crop.jpg` | meal-05 | 居中方形裁切、JPEG 压缩 |
