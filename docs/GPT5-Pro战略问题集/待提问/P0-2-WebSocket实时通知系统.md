## ✅ P0-2：WebSocket实时通知与消息推送系统（¥100,000）

### 为什么必须问？
- **后端优化回答.md** 只提到了BullMQ异步队列，但队列是后台任务，**用户无法实时感知任务进度**
- 现在用户提交任务后只能刷新页面查看进度，**体验极差**
- 未来支持多租户后，企业管理员需要实时看到成员的任务状态
- **没有WebSocket = 低端产品，有WebSocket = 专业SaaS**

### 完整提问（直接复制粘贴）

```markdown
# GPT-5问题：WebSocket实时通知与消息推送系统设计

## 背景
我的AI服装SaaS平台目前缺少实时通知能力，技术栈：
- 后端：Express.js + Knex.js + MySQL 8 + Redis + BullMQ
- 前端：Next.js 14 + Ant Design 5
- 部署：腾讯云4C4G单机 + PM2集群（4个实例）

## 现状问题
1. **用户体验差**：提交任务后需要不断刷新页面查看进度
2. **无法实时通知**：任务完成、失败、配额不足等事件无法第一时间告知用户
3. **PM2集群问题**：4个Node实例，WebSocket连接会随机落在某个实例上，如何广播消息？
4. **离线消息缺失**：用户断线重连后，无法收到离线期间的通知

## 核心需求

### 1. 技术选型对比
请对比以下三种方案，并推荐适合我的：

**方案A：Socket.io**
- 优势：自动降级（WebSocket → Long Polling）、房间管理、广播
- 劣势：包体积大、Redis适配器需要额外配置

**方案B：原生ws库 + 自建Redis Pub/Sub**
- 优势：轻量、灵活
- 劣势：需要自己实现心跳、重连、房间管理

**方案C：服务器推送事件（SSE）**
- 优势：HTTP协议、实现简单
- 劣势：单向推送、HTTP/1.1下连接数限制

对比维度：
- 4C4G单机能支持多少并发连接？
- PM2集群下的消息广播复杂度？
- 离线消息持久化难度？
- 浏览器兼容性（需要支持Chrome/Safari/Edge/微信浏览器）

### 2. PM2集群下的消息广播方案
当前部署：PM2启动4个Node实例（端口3000-3003），Nginx反向代理

问题：
- 用户A连接到实例1，但任务完成事件在实例2触发，如何通知？

请设计：
- **Redis Pub/Sub广播架构**：
  - 每个实例订阅`tasks:events`频道
  - 任务完成时发布消息到Redis
  - 所有实例收到消息后，检查是否有对应的WebSocket连接，有则推送
- **Socket.io Redis Adapter**（如果选用Socket.io）：
  - 配置示例（TypeScript）
  - 房间管理策略（用户级房间 `user:${userId}`、租户级房间 `tenant:${tenantId}`）

### 3. 离线消息持久化与重连机制
需求：
- 用户断线后，系统继续记录待推送消息
- 用户重连后，自动推送离线期间的消息
- 消息保留时长：24小时（超过24小时自动清理）

请设计：
- **Redis数据结构**：
  - 用户离线消息队列：`offline_messages:${userId}`（List）
  - 消息结构：`{ type, title, content, timestamp, read }`
- **推送逻辑**：
  - 连接建立时，检查`offline_messages:${userId}`，推送所有未读消息
  - 推送后标记为已读或删除
- **消息去重**：避免重连时重复推送同一条消息

### 4. 消息类型与数据结构
请设计完整的消息类型体系：

**任务相关：**
- `task:created`：任务创建成功
- `task:processing`：任务处理中（带进度百分比）
- `task:completed`：任务完成（附结果URL）
- `task:failed`：任务失败（附错误信息）

**配额相关：**
- `quota:low`：配额余额<10%时预警
- `quota:exhausted`：配额耗尽
- `quota:recharged`：配额充值成功

**账户相关：**
- `account:login`：异地登录提醒
- `account:payment_success`：支付成功
- `account:subscription_expiring`：会员即将过期（提前7天通知）

**系统通知：**
- `system:maintenance`：系统维护通知
- `system:feature_update`：新功能上线

消息结构示例：
```typescript
interface WebSocketMessage {
  type: 'task:completed' | 'quota:low' | ...;
  title: string;
  content: string;
  data?: any; // 额外数据（如任务ID、结果URL）
  timestamp: number;
  priority: 'low' | 'medium' | 'high'; // 高优先级消息弹窗提示
}
```

### 5. 前端接入方案
请提供Next.js + React的完整接入代码：

**功能要求：**
- 全局WebSocket连接管理（`useWebSocket` Hook）
- 自动重连机制（断线后每5秒重试，最多10次）
- 消息通知组件（Ant Design `notification.open`）
- 消息中心（查看历史通知）
- 未读消息计数（红点提示）

**代码结构：**
```typescript
// src/hooks/useWebSocket.ts
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);

  useEffect(() => {
    // 连接逻辑
    // 心跳逻辑
    // 重连逻辑
  }, []);

  return { connected, messages, send };
}

// src/components/NotificationCenter.tsx
// 消息中心UI组件
```

### 6. 安全与性能
**安全要求：**
- 如何防止未授权连接？（JWT Token验证）
- 如何防止消息伪造？（服务端签名）
- 如何防止DDoS攻击？（连接频率限制）

**性能要求：**
- 单机4C4G能支持多少并发WebSocket连接？
- 如何优化内存占用？（连接空闲超时断开）
- 如何监控连接数与消息吞吐量？（Prometheus指标）

### 7. 监控与告警
请设计：
- **Prometheus指标**：
  - `websocket_connections_total`（当前连接数）
  - `websocket_messages_sent_total`（已发送消息数）
  - `websocket_reconnects_total`（重连次数）
- **Grafana Dashboard**：
  - 实时连接数曲线
  - 消息发送速率（msg/s）
  - 各消息类型占比饼图
- **告警规则**：
  - 连接数>2000时触发告警（单机上限）
  - 重连率>30%时触发告警（网络质量问题）

## 技术要求
- 提供Socket.io或ws的完整TypeScript代码
- 提供Redis Pub/Sub广播机制代码
- 提供Next.js前端接入完整示例
- 提供Prometheus监控配置
- 提供性能压测方案（如何模拟1000并发连接）

## 预期交付物
1. 技术选型对比报告（Socket.io vs ws vs SSE）
2. WebSocket服务架构设计（含PM2集群方案）
3. 离线消息持久化方案（Redis数据结构 + 代码）
4. 消息类型定义与数据结构（TypeScript接口）
5. Next.js前端接入完整代码
6. 安全方案（JWT验证 + 限流）
7. 监控与告警方案（Prometheus + Grafana）
8. 性能测试报告（压测结果 + 优化建议）

**请以"高级后端工程师给团队的实施手册"的深度输出，确保可以直接开发！**
```

---

## 🚀 P0-3：ComfyUI工作流设计 + 开源大模型替代商业API方案（¥500,000+）

### 为什么这个问题价值暴增到¥50万+？

**传统方案（商业API）的致命缺陷：**
- ❌ 成本高昂：抠图¥0.15/次、换装¥0.20/次、AI生成¥0.80/次
