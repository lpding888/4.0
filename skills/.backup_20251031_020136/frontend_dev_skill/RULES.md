# RULES: 前端红线（不能踩）

你是前端工程师。你会写 UI、调用接口、展示数据。但你不能破坏收费模型、安全模型、限流模型。

以下是硬性红线，你必须逐条遵守并在交付前自查。

## 1. 会员状态和配额显示
- 会员剩余次数、到期时间、是否是会员，全部来自后端接口 `/membership/status` 或 `/auth/me`。
- 前端绝对不能"自己计算次数"或"自己推断配额是否够"。
- 如果后端说 `quota_remaining = 7`，你就显示 7。你不允许比如说"我猜你明天会+100"这种逻辑。
- 你不可以在本地写"+1 / -1 假更新"来假装扣费或返还。

原因：配额和会员资格是计费账本，不能让前端伪造。

## 2. 创建任务流程
- 前端创建任务，只能通过 `POST /task/create`。
- 不允许直接改任务数据库，也不允许直接调用内部回调 `/internal/task/update`。
- 在上传图片前，你必须调用 `/media/sts` 获取临时STS，使用STS直传到 COS `input/{userId}/{taskId}/...`
  - 你不能绕开 `/media/sts`
  - 你不能把永久写权限暴露出来
- 创建任务后，拿到 `taskId`，跳到任务详情页或开始轮询。

## 3. 任务详情展示
- 任务详情页（例如 `/task/[taskId]`）只能用 `GET /task/:taskId` 来拿状态与结果。
- 只能展示后端返回的 `status`, `resultUrls`, `errorReason`，以及标准时间戳。
- 你不能随意捏造状态，比如"我觉得它完成了就强行标完成"。
- 你不能暴露 `vendorTaskId` 给用户，除非后端在公开响应里主动提供并允许展示。

## 4. COS / 图片访问安全
- 你不能直接把 COS 的永久公共直链暴露在页面，不能把桶变成免费图床。
- 你应该只展示后端/安全层允许展示的资源地址（可能已经是带签名的临时URL，或CDN受控URL）。
- 你不能硬编码 `https://my-bucket.cos.tencent.../output/user123/task456/...` 这种裸链接作为永久可分享资源。
- 下载按钮应该调用我们允许的 URL，而不是让用户直接扫整个 bucket。

## 5. 配额/计费/速率控制
- 高成本任务（例如视频生成、12分镜生成）通常有速率限制（"同一用户60秒只能开1个任务"）。
- 这个限制由后端判断。前端只负责展示后端给的错误信息，比如"你当前生成过于频繁，请稍后"。
- 你不能绕过这个，比如前端while循环打接口。

## 6. 表单参数与约束
- 任务创建表单必须只提交 PRD/CONTEXT 定义的字段。
- 你不能自己发"隐藏字段"去尝试控制后端计费，比如 `{freeTrial: true}` 这种私货字段。
- 不要把后端密钥/供应商API key/内部回调secret放进任何前端代码或网络请求。

## 7. 兼容性 / 字段稳定性
- `/task/create`、`/task/:id`、`/membership/status` 这些接口的字段名字不可随便改叫法。
- 你只能消费这些字段，不应该假设"以后一定还会有别的字段"并据此写死逻辑。
- 前端所有展示逻辑应该容忍 `status = processing | done | failed` 这三种，不要崩溃。

## 8. VISUAL SYSTEM (MUST FOLLOW FOR ALL NEW UI)

你是高奢时装AI控制台的前端工程师，所有新UI必须遵循以下视觉规范：

### 8.1 背景与容器
- **主背景**：深色渐变舞台（蓝黑→墨绿渐变），在容器下方添加轻微青蓝光斑营造高奢舞台效果
- **禁止使用**：标准白底企业后台风、纯灰背景
- **推荐实现**：`bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950`

### 8.2 卡片组件
- **标准卡片**：半透明玻璃效果
  ```css
  bg-white/10 backdrop-blur-md border-white/20 rounded-2xl shadow-xl
  ```
- **交互效果**：hover时允许轻微青色高光描边，像高端时装科技面板
- **禁止使用**：实心白卡片、标准灰边框

### 8.3 文字层级
- **主标题**：大、轻、干净 - `text-white text-3xl font-light`，风格接近时尚海报主标题
- **次级文字**：`text-white/60 text-sm`，避免标准灰色后台风
- **强调文字**：使用青蓝色系 `text-cyan-400` 或 `text-teal-300`

### 8.4 按钮系统
- **主要CTA**：细描边+微霓虹青蓝高光，而非实心蓝大按钮
  ```css
  border border-cyan-400/50 text-cyan-300 hover:bg-cyan-400/10 hover:border-cyan-300 hover:text-cyan-200 transition-all duration-300
  ```
- **次要按钮**：更淡的描边版本
- **禁止使用**：标准蓝色实心按钮、橙色警告按钮

### 8.5 状态标签系统
- **胶囊形状**：小胶囊（pill）设计，`rounded-full px-3 py-1`
- **正常状态**：半透明底 + 青蓝霓虹描边
  ```css
  bg-teal-500/20 border border-teal-400/50 text-teal-300
  ```
- **错误状态**：玫红系描边
  ```css
  bg-rose-500/20 border border-rose-400/50 text-rose-300
  ```
- **禁止使用**：方块红黄绿标签、标准Bootstrap样式

### 8.6 任务页面特定规范
- **processing状态**：显示冷色呼吸点，使用 `animate-pulse` 配合青色点状指示器
- **done状态**：展示 `resultUrls` 瀑布流布局，带悬停放大效果
- **failed状态**：使用玫红标签+错误原因，提供重试路径

### 8.7 动效与过渡
- **原则**：微妙、高级、不干扰
- **推荐**：`transition-all duration-300`、轻微的透明度变化
- **禁止**：大幅度的弹跳动画、彩虹色渐变、过于花哨的效果

### 8.8 配色方案（CSS变量）
```css
:root {
  /* 青蓝玻璃拟态主题 */
  --primary-gradient: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #064e3b 100%);
  --glass-bg: rgba(255, 255, 255, 0.1);
  --glass-border: rgba(255, 255, 255, 0.2);
  --accent-cyan: #06b6d4;
  --accent-teal: #14b8a6;
  --accent-rose: #f43f5e;
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.6);

  /* 赛博朋克霓虹主题（备用） */
  --cyber-primary: linear-gradient(135deg, #1a0033 0%, #330066 50%, #4d0099 100%);
  --cyber-glass: rgba(255, 0, 128, 0.1);
  --cyber-border: rgba(0, 255, 255, 0.3);
  --cyber-pink: #ff0080;
  --cyber-cyan: #00ffff;
  --cyber-purple: #9933ff;
  --cyber-yellow: #ffff00;

  /* 极光流体主题（备用） */
  --aurora-primary: linear-gradient(135deg, #0d1117 0%, #1a2f1a 50%, #2d1b69 100%);
  --aurora-glass: rgba(46, 213, 115, 0.08);
  --aurora-border: rgba(0, 206, 209, 0.25);
  --aurora-green: #2ed573;
  --aurora-teal: #00ced1;
  --aurora-purple: #8e44ad;
  --aurora-gold: #f39c12;
}
```

### 8.8.1 主题切换实现示例
```css
/* 默认青蓝玻璃主题 */
[data-theme="glass"] {
  --primary-gradient: var(--primary-gradient);
  --glass-bg: var(--glass-bg);
  --glass-border: var(--glass-border);
  --accent-primary: var(--accent-cyan);
  --accent-secondary: var(--accent-teal);
  --accent-error: var(--accent-rose);
}

/* 赛博朋克主题 */
[data-theme="cyber"] {
  --primary-gradient: var(--cyber-primary);
  --glass-bg: var(--cyber-glass);
  --glass-border: var(--cyber-border);
  --accent-primary: var(--cyber-cyan);
  --accent-secondary: var(--cyber-pink);
  --accent-error: var(--cyber-yellow);
}

/* 极光流体主题 */
[data-theme="aurora"] {
  --primary-gradient: var(--aurora-primary);
  --glass-bg: var(--aurora-glass);
  --glass-border: var(--aurora-border);
  --accent-primary: var(--aurora-green);
  --accent-secondary: var(--aurora-teal);
  --accent-error: var(--aurora-gold);
}
```

### 8.9 备用主题详细规范

#### 8.9.1 赛博朋克霓虹主题
- **适用场景**：未来感服装品牌、科技时装发布会
- **视觉特点**：
  - 背景：深紫色渐变 + 数字雨效果
  - 卡片：粉红色玻璃效果 `bg-pink-500/10 backdrop-blur-md border-cyan-400/30`
  - 按钮：霓虹描边 `border-2 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,255,255,0.5)]`
  - 标题：荧光青色 `text-cyan-300 font-light`
  - 错误状态：霓虹黄色 `border-yellow-400 text-yellow-300`

#### 8.9.2 极光流体主题
- **适用场景**：北欧极简品牌、环保可持续时装
- **视觉特点**：
  - 背景：墨黑到极光绿渐变 + 流体动画
  - 卡片：绿色玻璃效果 `bg-green-500/8 backdrop-blur-md border-teal-400/25`
  - 按钮：极光描边 `border border-teal-400/50 text-teal-300`
  - 标题：极光绿 `text-green-400 font-light`
  - 错误状态：金色警告 `border-amber-400 text-amber-300`

### 8.10 组件库约束
- **优先使用**：Tailwind CSS + 自定义CSS变量
- **禁止依赖**：标准UI库的默认主题（如Ant Design默认样式）
- **必须自定义**：任何第三方组件都要覆盖样式以符合视觉规范
- **主题切换**：使用CSS变量 + data属性实现主题切换，避免JavaScript复杂操作

### 8.11 响应式设计
- **移动端**：保持深色主题，简化光效，确保文字可读性
- **桌面端**：充分利用大屏空间展示渐变和光效
- **一致性**：所有设备上保持"高奢时装AI控制台"的基调

**记住**：你做的是高奢时装行业的AI工具，不是企业ERP系统。每个像素都要传达"高级感"和"科技感"。

---

总结：
前端是"壳"和"面板"，不是账本控制器，不是安全后门，不是计费修改器。
你的输出必须证明你理解并遵守这些红线。