# CONTEXT: 我们平台对 SCF Worker 的定位

## 1. 为什么要云函数 (SCF)
主后端不能直接承载大文件/长时任务的原因：
- 用户上传的可能是高分辨率商品图、甚至视频（>10MB，几十MB，甚至上百MB）
- 我们有些供应商（例如 RunningHub、多分镜模特生成、视频合成）要求把二进制直接POST过去
- 这些处理可能要几十秒甚至几分钟
- 如果主后端直接代理这些数据，会：
  - 撑爆带宽
  - 让主进程卡死
  - 暴露我们的密钥
  - 增加 DDoS 风险

SCF 的角色：
把这些高成本活隔离在无服务器函数里，自动弹性，用完即走。

## 2. 典型目录结构（建议）
我们会把每个独立的处理类型放成一个 worker 目录，例如：
- `scf-workers/model_pose12_worker/`
- `scf-workers/promo_poster_worker/`
- `scf-workers/video_tryon_worker/`

每个 worker 目录里通常包含：
- `index.js` / `handler.js`：主入口（SCF的函数体）
- `serverless.yml` 或 `scf.config.json`：部署/触发配置（声明这是由COS触发、或定时触发）
- `vendorClient.js`：和外部供应商交互的逻辑（RunningHub API调用、构造 multipart/form-data 等）
- `cosClient.js`：和腾讯COS交互（下载原图到 /tmp，上传结果到 output/）
- `postUpdate.js`：把 status/resultUrls/vendorTaskId 回调到主后端的 `/internal/task/update`

可能还会有：
- `auditCheck.js`：对生成结果跑合规检测（涉黄、违禁）。不通过则标 failed。

## 3. 触发方式（两种常见模式）
A) **COS Put 触发**
- 用户/前端上传了 input/{userId}/{taskId}/original.jpg
- COS 触发器通知 SCF
- SCF：下载 → 调AI供应商 → 产出 → 上传output → 回调后端 done/failed

B) **定时轮询触发**
- 有些供应商是异步：我们第一次请求时只拿到 vendorTaskId，结果要过一阵才准备好
- 我们可以配置一个定时 SCF（例如每1分钟跑一次），它会：
  - 扫描 DB 或缓存里的未完成任务（注意：这一步可以是通过主后端提供的一个安全的内部列表接口，而不是直接查数据库）
  - 对每个 vendorTaskId 去供应商问进度
  - 生成完就拉取结果→上传COS→回调后端 /internal/task/update status=done
  - 超时就 status=failed

在 MVP 阶段，我们可以先实现模式 A（COS触发→即刻跑到底），再按需求补模式 B。

## 4. 回调后端（/internal/task/update）
主后端暴露了一个内部回调接口 `/internal/task/update`，这不是公开API。

它期望收到的payload大概像：
```json
{
  "taskId": "1234567890",
  "status": "done",
  "resultUrls": [
    "cos://output/user123/task123/frame_01.jpg",
    "cos://output/user123/task123/frame_02.jpg"
  ],
  "vendorTaskId": "vendor-abc-789"
}
```

或失败时：
```json
{
  "taskId": "1234567890",
  "status": "failed",
  "errorReason": "生成超时",
  "vendorTaskId": "vendor-abc-789"
}
```

主后端会：
- 更新 tasks 表
- 对成功任务：保持已扣配额
- 对失败任务：返还配额1次，并写 errorReason
- 触发内容审核记录等

**你（SCF Worker）绝对不直接写数据库。**

## 5. 供应商调用（例：RunningHub）

RunningHub 的工作流接口大致是：
- 你POST一个请求，带上：
  - appId
  - apiKey
  - nodeInfoList（prompt文字、参考图片ID等）
- 它返回一个任务ID（我们叫它 vendorTaskId）
- 你每隔一段时间去查询 vendorTaskId 的状态
- 成功时会给你每张生成图的资源地址（有时是临时路径或文件key）

你的职责是：
- 拿这些生成结果（图），下载或转存
- 统一上传到我们自己的 COS output/{userId}/{taskId}/frame_01.jpg ... frame_12.jpg
- 调主后端回调，报告完成。

你不应该把 RunningHub 的原始URL直接交给最终用户，更不要把apiKey/内部任务ID暴露到前端页面。

## 6. 合规/审核

审核要点：
- 对最终生成图/视频跑审核
- 审核不过：不要把图留在 output/ 下，也不要上报 done
- 你要上报 failed + "内容违规"
- 主后端收到后会返还配额并在任务详情里告诉用户"内容违规，无法展示"

## 7. 超时策略

如果外部供应商长时间没返回可用结果：
- 你要把任务认定为 failed（"生成超时"）
- 回调主后端 status=failed
- 让主后端返还配额

你绝对不能让这个卡住无限等，或者死循环占用资源。SCF是按执行时间计费的。

## 8. 总结一句

你的整个存在意义：
**把"上传的素材"→"AI供应商处理"→"结果进COS"→"任务状态更新到后端"**

把主后端从大流量/长时任务里解放出来，遵守所有安全/计费红线。