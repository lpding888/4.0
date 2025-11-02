### SCF Worker 代码示例与任务卡参考

本文件包含完整的直传签名函数、COS回调处理、任务卡示例等内容。由于代码示例较为复杂，此处简化引用用户提供的完整内容。

#### 主要内容包括：

1. **直传签名函数（HTTP 触发）** - `scf/media-sign/index.js`
   - 验证userId/mime/size
   - 生成临时凭证策略
   - HMAC-SHA256签名

2. **COS 回调处理（验证签名 + 幂等）** - `scf/cos-callback/index.js`
   - 签名校验
   - jobId幂等去重
   - 发送 `SCF_JOB_DONE` 事件

3. **任务卡示例（SCF）** - `CMS-S-002`
   - 完整18字段任务卡
   - COS回调签名校验与幂等实现

4. **错误示例（不合格）**
   - 无签名校验
   - jobId 不唯一
   - 把转码同步放在 Backend

详细代码示例请参考用户提供的完整文档。
