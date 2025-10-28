# 🎯 Backend Dev Skill - 任务卡

> Source file: 任务卡-BackendDev.md (moved/refactored)

## 📋 任务名称
服装视频生成功能 - 后端核心接口与轮询逻辑

## 🎨 任务价值
实现视频生成功能的后端核心逻辑，包括配额管理、AI调用、任务轮询和COS集成

## 📥 输入依赖
- PRD文档：服装视频生成功能-任务分派.md
- KUAI API文档
- 混元大模型API文档
- 数据库表结构设计

## 📤 输出要求
- 实现完整的后端API接口
- 实现定时轮询逻辑
- 实现配额扣减与返还
- 完成数据库迁移

## 🎯 具体任务

### 1. 接口开发
- [ ] 实现 POST /task/create 支持 type='video_generate'
- [ ] 实现 GET /task/:taskId 返回视频相关字段
- [ ] 实现配额预扣5次的原子性操作（使用forUpdate行锁）

### 2. AI服务集成
- [ ] 实现混元大模型同步调用（生成8秒拍摄脚本）
- [ ] 实现KUAI API同步调用（创建视频任务）
- [ ] 保存vendor_task_id到数据库

### 3. 定时轮询
- [ ] 使用node-cron实现定时任务（每5分钟执行一次）
- [ ] 查询processing状态的video_generate任务
- [ ] 调用KUAI /v1/video/query查询任务状态
- [ ] status=success时下载视频到COS
- [ ] status=failed时返还5次配额
- [ ] 超时2小时自动失败并返还配额

### 4. 数据库迁移
- [ ] 创建tasks表扩展字段迁移脚本
- [ ] 新增字段：vendorTaskId, resultUrls, coverUrl, thumbnailUrl, errorReason

## ✅ 验收标准
- [ ] POST /task/create 能成功扣减5次配额
- [ ] GET /task/:taskId 能正确返回任务状态
- [ ] 后端能正确轮询KUAI API并处理各种状态
- [ ] 失败场景能正确返还配额
- [ ] 超时场景能自动处理并返还配额
- [ ] 数据库迁移脚本能正确执行

## ⏰ 工期估计
3-4天

## 📚 参考资料
- PRD文档完整内容（接口需求、KUAI API配置、轮询策略等）
- 项目技术栈：Node.js + Express + Knex.js
- 数据库：MySQL 8.0
- 对象存储：腾讯云COS