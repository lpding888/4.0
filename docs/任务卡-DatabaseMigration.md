# 🎯 Database Migration Skill - 任务卡

## 📋 任务名称
服装视频生成功能 - 数据库迁移脚本

## 🎨 任务价值
为视频生成功能扩展数据库表结构，支持新字段存储任务相关信息

## 📥 输入依赖
- PRD文档：服装视频生成功能-任务分派.md
- 现有tasks表结构
- Knex.js迁移规范

## 📤 输出要求
- 创建数据库迁移脚本
- 确保向后兼容性

## 🎯 具体任务

### 1. 表结构扩展
- [ ] 创建tasks表扩展字段迁移脚本
- [ ] 新增字段：
  - vendorTaskId (VARCHAR) - KUAI返回的task_id
  - resultUrls (JSON) - 处理结果URL数组
  - coverUrl (VARCHAR) - 智能封面URL
  - thumbnailUrl (VARCHAR) - GIF预览URL
  - errorReason (VARCHAR) - 失败原因

### 2. 类型支持
- [ ] 修改type字段支持'video_generate'枚举值

### 3. 兼容性检查
- [ ] 确保迁移脚本向后兼容
- [ ] 测试迁移脚本执行和回滚

## ✅ 验收标准
- [ ] 迁移脚本能成功执行
- [ ] 新字段在tasks表中正确创建
- [ ] type字段支持'video_generate'值
- [ ] 迁移脚本可回滚

## ⏰ 工期估计
1天

## 📚 参考资料
- PRD文档中的数据库表结构设计
- 项目技术栈：Knex.js数据库迁移
- 现有数据库表结构
- MySQL 8.0规范