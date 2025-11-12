# GitHub Actions CI/CD 工作流说明

## 📋 工作流概览

本项目使用GitHub Actions实现完整的CI/CD流程，包含测试、构建、安全扫描和自动部署。

### 🔄 工作流文件

- **`ci.yml`** - 主CI/CD流程
  - 后端测试（覆盖率≥80%）
  - 前端测试（覆盖率≥70%）
  - Docker镜像构建和推送
  - 安全扫描（Trivy）
  - Kubernetes部署（可选）

---

## 🚀 工作流程图

```
┌─────────────┐
│  代码推送    │
│  (main/PR)  │
└──────┬──────┘
       │
       ├──────────────────┬──────────────────┐
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐
│ 后端测试     │    │ 前端测试     │   │             │
│ • Lint      │    │ • Lint      │   │             │
│ • 单元测试   │    │ • 单元测试   │   │             │
│ • 覆盖率80%  │    │ • 覆盖率70%  │   │             │
└──────┬──────┘    └──────┬──────┘   │             │
       │                  │           │             │
       └─────────┬────────┘           │             │
                 ▼                     │             │
         ┌─────────────┐               │             │
         │ Docker构建   │               │             │
         │ • 后端镜像   │               │             │
         │ • 前端镜像   │               │             │
         │ • 推送GHCR  │               │             │
         └──────┬──────┘               │             │
                │                      │             │
                ▼                      │             │
         ┌─────────────┐               │             │
         │ 安全扫描     │               │             │
         │ • Trivy     │               │             │
         │ • 高危漏洞   │               │             │
         └──────┬──────┘               │             │
                │                      │             │
                ▼ (仅main分支)          │             │
         ┌─────────────┐               │             │
         │ K8s部署      │               │             │
         │ • 滚动更新   │               │             │
         │ • 健康检查   │               │             │
         └─────────────┘               │             │
```

---

## ⚙️ Job 详细说明

### 1. test-backend (后端测试)

**触发条件**: 所有push和PR

**步骤**:
1. 安装依赖 (`npm ci`)
2. 代码检查 (`npm run lint`)
3. 运行测试 (`npm run test:coverage`)
4. **强制覆盖率门禁**: 语句覆盖率必须≥80%

**失败条件**:
- Lint错误
- 测试失败
- 覆盖率<80%

---

### 2. test-frontend (前端测试)

**触发条件**: 所有push和PR

**步骤**:
1. 安装依赖 (`npm ci --legacy-peer-deps`)
2. 代码检查 (`npm run lint`)
3. 运行测试 (`npm run test:coverage`)
4. **强制覆盖率门禁**: 语句覆盖率必须≥70%

**失败条件**:
- Lint错误
- 测试失败
- 覆盖率<70%

---

### 3. build (构建和扫描)

**触发条件**: 后端和前端测试都通过后

**步骤**:
1. 设置Docker Buildx
2. 登录GitHub Container Registry (仅main分支)
3. 构建后端Docker镜像
   - 使用GitHub Actions缓存加速
   - 仅main分支推送到GHCR
4. 构建前端Docker镜像
   - Standalone模式优化
   - 仅main分支推送到GHCR
5. Trivy安全扫描
   - 检测HIGH和CRITICAL级别漏洞
   - 发现高危漏洞则失败

**镜像标签策略**:
```
ghcr.io/USER/REPO/backend:main-abc123def  (SHA标签)
ghcr.io/USER/REPO/backend:latest          (仅main分支)
ghcr.io/USER/REPO/frontend:main-abc123def
ghcr.io/USER/REPO/frontend:latest
```

---

### 4. deploy (部署)

**触发条件**:
- 构建成功
- 仅main分支
- 配置了`KUBECONFIG_DATA` secret

**步骤**:
1. 安装kubectl
2. 配置kubeconfig（从base64解码）
3. 滚动更新后端deployment
   - 等待最多120秒
4. 滚动更新前端deployment
   - 等待最多120秒

**跳过条件**:
- 未配置`KUBECONFIG_DATA` secret时自动跳过

---

## 🔐 必需的GitHub Secrets

在仓库设置中添加以下secrets（Settings > Secrets and variables > Actions）：

### 必需配置

| Secret名称 | 用途 | 如何获取 |
|-----------|------|---------|
| `GITHUB_TOKEN` | 推送Docker镜像到GHCR | **自动提供**，无需手动配置 |

### 可选配置（用于K8s部署）

| Secret名称 | 用途 | 如何获取 |
|-----------|------|---------|
| `KUBECONFIG_DATA` | Kubernetes集群凭证 | `cat ~/.kube/config \| base64 -w 0` |

---

## 📝 配置示例

### 添加KUBECONFIG_DATA Secret

```bash
# 1. 获取kubeconfig的base64编码
cat ~/.kube/config | base64 -w 0

# 2. 复制输出内容

# 3. 在GitHub仓库中:
#    Settings > Secrets and variables > Actions > New repository secret
#    Name: KUBECONFIG_DATA
#    Value: [粘贴base64编码的内容]
```

---

## 🧪 本地测试

### 测试后端覆盖率

```bash
cd backend
npm run test:coverage

# 检查覆盖率
node -e "
  const summary = require('./coverage/coverage-summary.json');
  const pct = summary.total.statements.pct || 0;
  console.log('后端覆盖率:', pct, '%');
  console.log('是否通过80%门禁:', pct >= 80 ? '✅' : '❌');
"
```

### 测试前端覆盖率

```bash
cd frontend
npm run test:coverage

# 检查覆盖率
node -e "
  const summary = require('./coverage/coverage-summary.json');
  const pct = summary.total.statements.pct || 0;
  console.log('前端覆盖率:', pct, '%');
  console.log('是否通过70%门禁:', pct >= 70 ? '✅' : '❌');
"
```

### 本地Docker构建测试

```bash
# 后端
docker build -t backend:local ./backend

# 前端
docker build -t frontend:local ./frontend

# 检查镜像大小
docker images | grep -E "backend|frontend"
```

---

## 🐛 故障排查

### 问题1: 覆盖率门禁失败

**错误信息**: `后端语句覆盖率仅 XX%，低于阈值80%`

**解决方案**:
1. 本地运行 `npm run test:coverage`
2. 查看 `coverage/lcov-report/index.html` 找出未覆盖代码
3. 补充测试用例
4. 重新提交

---

### 问题2: Docker构建失败

**常见原因**:
- 缺少依赖文件
- Dockerfile语法错误
- 构建上下文过大

**解决方案**:
```bash
# 本地测试构建
docker build -t test:local ./backend

# 检查.dockerignore是否正确
cat backend/.dockerignore
```

---

### 问题3: Trivy扫描发现高危漏洞

**错误信息**: `Trivy found vulnerabilities`

**解决方案**:
1. 查看CI日志中的漏洞详情
2. 更新受影响的依赖
   ```bash
   npm audit fix
   npm update
   ```
3. 重新构建并推送

---

### 问题4: K8s部署失败

**常见原因**:
- `KUBECONFIG_DATA` secret配置错误
- Deployment不存在
- 镜像拉取失败

**解决方案**:
```bash
# 验证kubeconfig
echo "$KUBECONFIG_DATA" | base64 --decode > test.kubeconfig
kubectl --kubeconfig=test.kubeconfig get nodes

# 检查deployment是否存在
kubectl get deployment backend frontend

# 手动测试滚动更新
kubectl set image deployment/backend backend=ghcr.io/USER/REPO/backend:main-SHA
kubectl rollout status deployment/backend
```

---

## 📊 性能优化

### Docker构建缓存

工作流已配置GitHub Actions缓存:
```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

**效果**:
- 首次构建: ~5-10分钟
- 缓存命中: ~1-2分钟

---

### 并行执行

测试job并行运行:
```yaml
jobs:
  test-backend:  # 并行执行
  test-frontend: # 并行执行
  build:         # 等待上述完成
    needs: [test-backend, test-frontend]
```

---

## 🔄 工作流触发规则

### 自动触发

| 事件 | 分支 | 行为 |
|------|------|------|
| Push | main | 完整流程 + 部署 |
| Push | develop | 测试 + 构建 + 扫描（不推送） |
| Pull Request | main, develop | 测试 + 构建 + 扫描（不推送） |

### 手动触发

可以在GitHub仓库的Actions标签页手动触发工作流。

---

## 📈 后续优化建议

### 1. 添加代码覆盖率可视化

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./backend/coverage/lcov.info
    flags: backend
    token: ${{ secrets.CODECOV_TOKEN }}
```

### 2. 添加Slack通知

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
```

### 3. 添加性能测试

```yaml
- name: Run performance tests
  run: npm run test:performance
```

---

## 📚 相关文档

- [GitHub Actions文档](https://docs.github.com/en/actions)
- [Docker构建最佳实践](https://docs.docker.com/develop/dev-best-practices/)
- [Trivy安全扫描](https://aquasecurity.github.io/trivy/)
- [kubectl部署指南](https://kubernetes.io/docs/reference/kubectl/)

---

**最后更新**: 2025-01-12
**维护者**: Fashion AI SaaS Team
