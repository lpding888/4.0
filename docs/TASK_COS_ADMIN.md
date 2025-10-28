# 🎯 COS Admin Skill - 任务卡

## 📋 任务名称
服装视频生成功能 - COS工作流配置

## 🎨 任务价值
配置腾讯云COS工作流，实现视频自动转码、生成封面和预览，提升用户体验

## 📥 输入依赖
- PRD文档：服装视频生成功能-任务分派.md
- 腾讯云COS控制台访问权限
- 存储桶信息：ai-photo-prod-1379020062

## 📤 输出要求
- 完成COS工作流配置
- 确保各处理步骤正确执行

## 🎯 具体任务

### 1. 工作流配置
- [ ] 在腾讯云COS控制台创建视频处理工作流
- [ ] 配置触发条件：input/{userId}/{taskId}/original.mp4

### 2. 处理步骤配置
- [ ] 配置视频转码（720p）：
  - 输入：input/{userId}/{taskId}/original.mp4
  - 输出：output/{userId}/{taskId}/720p.mp4
  - 参数：分辨率1280x720, 码率2000kbps, H.264 MP4

- [ ] 配置视频转码（480p）：
  - 输入：input/{userId}/{taskId}/original.mp4
  - 输出：output/{userId}/{taskId}/480p.mp4
  - 参数：分辨率854x480, 码率800kbps, H.264 MP4

- [ ] 配置HLS-ABR生成：
  - 输入：output/{userId}/{taskId}/720p.mp4 + 480p.mp4
  - 输出：output/{userId}/{taskId}/playlist.m3u8 + 分片文件
  - 参数：片段时长6秒, 自动切换清晰度

- [ ] 配置智能截帧生成封面：
  - 输入：input/{userId}/{taskId}/original.mp4
  - 输出：output/{userId}/{taskId}/cover.jpg
  - 参数：使用AI选择最优帧, 分辨率1280x720, 质量90

- [ ] 配置GIF预览生成：
  - 输入：input/{userId}/{taskId}/original.mp4
  - 输出：output/{userId}/{taskId}/preview.gif
  - 参数：时间范围0-3秒, 分辨率640x360, 帧率10fps

### 3. CDN配置
- [ ] 配置CDN加速
- [ ] 确保输出文件可通过CDN访问

## ✅ 验收标准
- [ ] 工作流能自动触发
- [ ] 所有处理步骤能正确执行
- [ ] 输出文件路径符合预期
- [ ] 转码质量和参数符合要求
- [ ] CDN加速配置正确

## ⏰ 工期估计
1天

## 📚 参考资料
- PRD文档中的COS工作流配置要求
- 腾讯云COS数据万象文档
- 项目存储桶信息：ai-photo-prod-1379020062