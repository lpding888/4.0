# EXAMPLES: 正确交付一个新的 SCF Worker

我们用一个典型场景来演示：
场景名：`model_pose12_worker`
业务：生成"AI模特12分镜"图片（鞋子/衣服不同角度），不是即时返回，要走外部供应商。

---

## 目标
- 用户上传了一张商品图（比如鞋子），前端直传到 `input/{userId}/{taskId}/original.jpg`
- COS 触发 SCF：`model_pose12_worker`
- 这个 worker：
  1. 下载 original.jpg 到 `/tmp`
  2. 调用供应商（例如 RunningHub 工作流）的API，传入 prompt、参考图
  3. 拿到 vendorTaskId
  4. 把 vendorTaskId 回报给主后端（status=processing）
  5. （后续由定时触发器或二次SCF轮询 vendorTaskId 的状态）
  6. 一旦供应商完成，worker拉12张图，上传到 `output/{userId}/{taskId}/frame_01.jpg ... frame_12.jpg`
  7. 调主后端 `/internal/task/update` status=done 并传回这些 resultUrls
  8. 审核不通过或超时 → status=failed + errorReason="内容违规" 或 "生成超时"

---

## 交付步骤（你必须按这个顺序输出给我）

### 第1步：列出会新增/修改的文件
示例输出应像这样：

1. `scf-workers/model_pose12_worker/index.js`
   - 主handler：处理COS触发事件，解析 userId/taskId，下载原图到 /tmp，调用供应商接口，上传结果图到 output/，回调后端

2. `scf-workers/model_pose12_worker/serverless.yml`
   - 声明触发方式（COS putObject 到 input/... 路径时触发）
   - 配置运行内存、超时时间、环境变量（供应商API Key、后端内部回调URL、签名token等）

3. `scf-workers/shared/cosClient.js`
   - 包含下载和上传函数：`downloadFromCos(objectKey, localPath)` / `uploadToCos(localPath, destKey)`

4. `scf-workers/shared/postUpdate.js`
   - 封装调用主后端 `/internal/task/update` 的逻辑（带签名header）
   - 例如 `reportStatus({ taskId, status, resultUrls, errorReason, vendorTaskId })`

5. （可选）`scf-workers/shared/auditCheck.js`
   - 对生成结果图跑内容审核
   - 返回 pass/fail

你必须先给我这个"文件列表 + 每个文件用途解释"。

### 第2步：解释流程
然后你写出类似下面这种人类可读流程（不能省略）：

- COS触发传入了对象键：`input/{userId}/{taskId}/original.jpg`
- 我解析出 `userId` 和 `taskId`
- 我从COS下载这张original.jpg到`/tmp/original.jpg`
- 我调用 RunningHub：
  - 传 prompt（例如"同一场景12个分镜、不同角度、商业时尚拍摄"）
  - 传参考图（就是 `/tmp/original.jpg` 的内容）
- RunningHub 返回 `vendorTaskId = "1982694711750213634-xyz"`
- 我先调用 `/internal/task/update`：
  - `status=processing`
  - `vendorTaskId="1982694711750213634-xyz"`
  - 不传 resultUrls（还没生成）
- （后续由轮询型SCF或定时器继续拿 vendorTaskId 的最终结果）
- 当我拿到最终12张成片后：
  - 我把12张图片上传到COS的 `output/{userId}/{taskId}/frame_01.jpg ... frame_12.jpg`
  - 我对这些成片跑审核（auditCheck），如果任何违规 -> 我报"failed"
  - 如果全部合规 -> 我再次调用 `/internal/task/update`：
    - `status=done`
    - `resultUrls` = [
      "cos://output/{userId}/{taskId}/frame_01.jpg",
      ...,
      "cos://output/{userId}/{taskId}/frame_12.jpg"
    ]
    - `vendorTaskId` 同上

- 如果供应商长时间没结果，我调用 `/internal/task/update`：
  - `status=failed`
  - `errorReason="生成超时"`

这一步是确认你理解逻辑闭环（包含合规、回调、上传output）。

### 第3步：红线自查（必须逐条回答）
示例自查应该长这样：

- 我不会直接修改数据库或配额，我只上报状态给后端。
- 我不会把 `/internal/task/update` 的内部签名凭证打印到日志或返回用户。
- 我不会把COS桶当成公开CDN，不会生成永久裸URL。
- 我会在 fail 时上报 `status=failed` 和业务可阅读的 `errorReason`，由后端统一返还配额。
- 我会考虑SCF超时/内存限制，不会死等供应商十几分钟阻塞函数。

### 第4步：给出代码草稿
最后你才给我代码骨架，比如 `index.js`、`serverless.yml`、`cosClient.js`、`postUpdate.js`。

代码里必须有：
- 从 COS 拉原文件的逻辑
- 调供应商的逻辑（POST multipart/form-data 等）
- 上传生成结果回 COS output/... 的逻辑
- 调用 `/internal/task/update` 的逻辑（带签名header）
- 审核分支（通过/违规）
- 超时/异常→failed的分支

---

## 非常重要的结语
作为 SCF Worker Skill，你的交付格式**永远**是：

(1) 文件清单
(2) 流程说明
(3) 红线自查
(4) 代码草稿

绝对不允许直接丢一坨云函数代码，而不给 (2)(3)。如果你跳过 (2)(3)，我会当作违规，因为那代表你可能偷偷破坏了我们的计费/配额安全线。