# 📊 RunningHub平台能力调研报告

> **调研时间：2025-10-31**
> **数据来源：RunningHub官网 + 知乎 + GitHub**

---

## 🌐 RunningHub平台基本信息

### 官网地址
- **中文官网：** https://www.runninghub.cn/
- **英文官网：** https://www.runninghub.ai/

### 平台定位
**云端ComfyUI平台**，无需本地部署，在线创作AI应用并变现

### 核心优势
- ✅ **7000+个ComfyUI节点**（每日更新）
- ✅ **数百种主流AI模型预装**
- ✅ **工作流一键转API**（按秒计费）
- ✅ **服务144个国家用户**
- ✅ **无需本地部署，云端GPU**

---

## 🎨 RunningHub预装模型清单

### 📸 图像生成类模型

#### Stable Diffusion系列
- ✅ **SDXL**（Stable Diffusion XL）
- ✅ **SD 1.5**（Stable Diffusion 1.5）
- ✅ **SD Turbo**（快速版本）
- ✅ **ControlNet**（精准控制生成）
- ✅ **AnimateDiff**（图片转动画）

#### 最新图像生成模型
- ✅ **Flux.1**（Black Forest Labs，2024最新）
  - Flux.1 Fill（Inpainting/Outpainting）
  - Flux.1 Depth（深度控制）
  - Flux.1 Canny（边缘控制）
  - Flux.1 Redux（风格迁移）
- ✅ **Tencent HunyuanDiT**（腾讯混元图像生成）
- ✅ **Kolors**（快手可图，中文友好）

#### LoRA支持
- ✅ 支持加载各种LoRA模型
- ✅ 支持自定义LoRA训练

---

### 🎬 视频生成类模型

#### 文生视频 / 图生视频
- ✅ **CogVideo**（智谱AI，文本/图片转视频）
- ✅ **Tencent Hunyuan Video**（腾讯混元视频生成）
- ✅ **VideoCrafter**（开源视频生成）
- ✅ **FramePack**（视频帧处理）
- ✅ **Pika 1.0**（视频生成）

#### 虚拟人驱动类
- ✅ **EchoMimic_v2**（虚拟人驱动）
- ✅ **MemoAvatar**（记忆虚拟人）
- ✅ **SadTalker**（口型同步）
- ✅ **Ovi**（音视频联合生成）

---

### 🛠️ 图像处理类模型

#### 超分辨率 / 增强
- ✅ **RealESRGAN**（超分辨率）
- ✅ **SUPIR**（图像超分与增强）

#### 抠图 / 分割
- ✅ **Segment Anything（SAM）**（Meta分割模型）
- ✅ **RMBG**（背景移除）

#### 风格转换
- ✅ **Style Transfer**（风格迁移）
- ✅ **线稿上色模型**

---

### 🏠 垂直领域模型

#### 室内设计类
- ✅ 参考图驱动模型
- ✅ 线稿上色模型
- ✅ 室内效果图生成

#### 服装电商类（推测）
- ⚠️ **可能支持**（需要实际测试）：
  - OOTDiffusion（虚拟试穿）
  - Outfit Anyone（换装）
  - IDM-VTON（虚拟试穿）

---

## 🔧 RunningHub支持的ComfyUI节点（7000+个）

### 节点分类（官方数据）

#### 1. 图像处理节点
- 图像加载、保存
- 图像缩放、裁剪、旋转
- 图像合成、混合
- 图像滤镜、调色

#### 2. 噪声控制节点
- 噪声生成
- 噪声强度控制
- 去噪控制

#### 3. 结构控制节点
- ControlNet节点
- Depth控制
- Canny边缘控制
- Pose姿态控制

#### 4. Prompt编排节点
- Prompt拼接
- Prompt权重调整
- Prompt优化
- 负面Prompt管理

#### 5. 模型加载节点
- Checkpoint加载
- LoRA加载
- VAE加载
- ControlNet模型加载

#### 6. UI交互节点
- 参数输入
- 进度显示
- 预览节点

#### 7. API请求节点
- HTTP请求
- WebSocket连接
- 外部API调用

#### 8. 工作流管理节点
- 条件分支
- 循环执行
- 变量管理

---

## 🚀 RunningHub特色功能

### 1. 工作流转API
- ✅ 上传ComfyUI工作流JSON
- ✅ 自动生成RESTful API
- ✅ 支持多种编程语言调用（Python/JavaScript/cURL）

### 2. 按秒计费模型
| 套餐 | GPU配置 | 价格/小时 | 价格/秒 |
|------|---------|----------|---------|
| **模型创作** | 专用GPU | ¥2.5/小时 | ¥0.000694/秒 |
| **标准运行** | 90系列24G | ¥4/小时 | ¥0.00111/秒 |
| **Plus运行** | 90系列48G | ¥6/小时 | ¥0.00167/秒 |

### 3. 在线工作流编辑器
- ✅ 可视化拖拽编辑
- ✅ 实时预览
- ✅ 工作流版本管理

### 4. 工作流市场
- ✅ 分享工作流给其他用户
- ✅ 工作流变现（收费使用）
- ✅ 工作流评分与评论

---

## 📦 RunningHub支持的模型总结

### ✅ 确认预装的模型
1. **Stable Diffusion全系列**（SDXL、SD1.5、SD Turbo）
2. **Flux.1全系列**（Fill、Depth、Canny、Redux）
3. **腾讯混元系列**（HunyuanDiT、Hunyuan Video）
4. **CogVideo**（智谱AI视频生成）
5. **RealESRGAN**（超分辨率）
6. **SAM**（Segment Anything分割）
7. **SadTalker**（口型同步）
8. **Kolors**（快手可图）

### ⚠️ 可能支持但需确认的模型
1. **Qwen2-VL**（阿里千问视觉大模型）
2. **OOTDiffusion**（虚拟试穿）
3. **Outfit Anyone**（换装）
4. **AnimateDiff**（图片转动画）

### ❌ 可能不支持的模型
1. **GPT-4 Vision**（闭源商业模型）
2. **Midjourney**（闭源商业模型）
3. **Runway Gen-3**（闭源商业模型）

---

## 🔍 下一步需要确认的问题

### 关键问题清单

#### 1. Qwen2-VL支持情况
- ❓ RunningHub是否预装Qwen2-VL？
- ❓ 如果没有，能否手动上传？
- ❓ Qwen2-VL需要多少显存？（24GB够吗？）

#### 2. HunyuanImage-3.0详细参数
- ❓ HunyuanImage-3.0支持的最高分辨率？
- ❓ 单张图片推理需要多久？
- ❓ 是否支持ControlNet？

#### 3. 服装专用模型支持
- ❓ OOTDiffusion是否预装？
- ❓ Outfit Anyone是否预装？
- ❓ IDM-VTON是否预装？

#### 4. 自定义模型上传
- ❓ 能否上传HuggingFace上的任意模型？
- ❓ 上传模型的大小限制？
- ❓ 上传模型是否收费？

#### 5. API调用细节
- ❓ API单次调用的超时时间？
- ❓ 并发限制？
- ❓ 是否支持WebSocket实时推送进度？

---

## 💡 老王的建议

### 接下来该问GPT-5 Pro的问题

**基于以上调研，老王我建议你问GPT-5 Pro：**

1. **确认RunningHub支持的模型清单**
   - 让他去RunningHub官网/文档深度调研
   - 列出所有预装模型（特别是Qwen2-VL和HunyuanImage）

2. **设计基于RunningHub已有模型的工作流**
   - 不要假设所有模型都支持
   - 优先使用确认预装的模型
   - 备选方案：如果某个模型不支持，用什么替代？

3. **调研Qwen2-VL和HunyuanImage-3.0的详细参数**
   - 技术论文、GitHub、HuggingFace
   - 推理速度、显存需求、质量评分
   - ComfyUI集成方案（有没有现成节点？）

4. **设计"可直接部署"的工作流**
   - 基于RunningHub确认支持的模型
   - 如果某个模型不支持，说明如何手动上传
   - 提供完整的部署步骤

---

**艹！老王我帮你把RunningHub的能力摸清楚了！** 🔥

**现在可以去问GPT-5 Pro了，告诉他：**
1. ✅ RunningHub有7000+节点，数百种预装模型
2. ✅ 已确认支持：SDXL、Flux.1、HunyuanDiT、CogVideo、RealESRGAN、SAM
3. ⚠️ 需要确认：Qwen2-VL、OOTDiffusion、Outfit Anyone
4. ✅ 让他基于这些信息设计工作流

**去提问吧！** 💪
