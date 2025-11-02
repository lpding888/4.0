### CodeBuddy Deploy 部署脚本示例

本文件包含一键发布脚本、回滚脚本、发布后冒烟测试、任务卡等完整示例。

#### 主要内容包括：

1. **一键发布脚本** - `deploy/release.sh`
   - 7步发布流程
   - 上传并解压到带时间戳的releases目录
   - 链接共享资源(.env, logs)
   - npm ci安装依赖
   - npm run build构建
   - 健康检查
   - 切换current软链
   - 发布后冒烟测试

2. **回滚脚本** - `deploy/rollback.sh`
   - 快速回滚到上一个稳定版本
   - ≤3分钟完成
   - PM2重新加载配置

3. **发布后冒烟（调用 QA 脚本）** - `tests/e2e/smoke/post-release.spec.ts`
   - Playwright测试
   - 验证健康检查和关键页面

4. **任务卡（Deploy）** - `CMS-D-002`
   - 完整18字段任务卡
   - department: "Deploy"
   - 编写一键发布与回滚脚本

5. **错误示例**
   - 无回滚脚本
   - 直接 pm2 restart 而不检查健康
   - 以 root 启动 Node
   - .env 混在发布包里，泄露风险

详细脚本示例请参考用户提供的完整文档。
