### 1) 运行与环境

* **运行时**：Node.js 18
* **触发器**：HTTP API 网关、COS 事件、定时、TDMQ/CMQ 消息
* **依赖**：`tencentcloud-sdk-nodejs`（STS/COS 管理）、`cos-nodejs-sdk-v5`（可选）、`axios`、`pino`
* **环境变量（示例）**：
  ```
  COS_BUCKET=cms-media-125000000
  COS_REGION=ap-guangzhou
  COS_ALLOWED_PREFIX=uploads/${userId}/*
  SIGN_EXPIRE_SEC=600
  CALLBACK_SHARED_SECRET=***    # 用于自签名回调
  DLQ_TOPIC=dlq-scf
  ```

### 2) 事件契约（建议）

```json
// SCF_JOB_SCHEDULED / DONE / FAILED
{
  "event": "SCF_JOB_DONE",
  "jobId": "media:transcode:20251030-00123",
  "type": "media.transcode",
  "status": "done",
  "resource": { "bucket": "cms-media-***", "key": "uploads/u1/abc.mp4", "mime": "video/mp4" },
  "metrics": { "durationMs": 3250, "attempts": 1 },
  "at": "2025-10-30T10:02:31Z"
}
```

### 3) 幂等策略

* 选择**业务幂等键**：`jobId` 或 `objectKey+etag`。
* 采用**存储去重**：在 DB/Redis/表中记录处理状态；重复事件直接 `200`。
* 更新操作需**原子**（如 Redis `SETNX` 或 DB 唯一键）。

### 4) 重试与死信

* 指数退避：`1000ms * (2^attempt)`，上限 5 次；
* 入死信：写入 TDMQ/CMQ `DLQ_TOPIC` 或 DB 表 `scf_dlq`；
* 提供重放脚本：`scripts/replay-dlq.js`。

### 5) 安全

* **签名**：COS 回调/自建回调都需签名校验（HMAC-SHA256）。
* **最小权限**：STS policy 限制 `qcs:cos:ap-*:uid/*:cms-media-*/uploads/${userId}/*`。
* **CORS**：仅允许受信域；上传通过前端表单域名。
