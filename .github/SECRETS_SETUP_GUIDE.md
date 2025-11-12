# GitHub Secrets 配置指南

本文档详细说明如何配置GitHub仓库的Secrets，以支持完整的CI/CD流程。

---

## 📋 Secrets清单

### 🟢 自动配置（无需操作）

| Secret名称 | 用途 | 状态 |
|-----------|------|------|
| `GITHUB_TOKEN` | 推送Docker镜像到GitHub Container Registry | ✅ GitHub自动提供 |

### 🟡 可选配置（按需启用）

| Secret名称 | 用途 | 优先级 | 配置难度 |
|-----------|------|--------|---------|
| `KUBECONFIG_DATA` | Kubernetes集群部署 | P1 | ⭐⭐⭐ |
| `CODECOV_TOKEN` | 代码覆盖率可视化 | P2 | ⭐ |
| `SLACK_WEBHOOK` | Slack部署通知 | P3 | ⭐ |

---

## 🔐 详细配置步骤

### 1. KUBECONFIG_DATA (K8s部署凭证)

#### 用途
允许GitHub Actions自动部署到Kubernetes集群。

#### 前置条件
- 已有Kubernetes集群（阿里云ACK、腾讯云TKE等）
- 本地可以用kubectl访问集群

#### 配置步骤

**步骤1: 获取kubeconfig**

```bash
# 方法A: 使用现有kubeconfig
cat ~/.kube/config | base64 -w 0 > kubeconfig.base64

# 方法B: 创建专用ServiceAccount (推荐)
kubectl create serviceaccount github-actions -n default
kubectl create clusterrolebinding github-actions \
  --clusterrole=cluster-admin \
  --serviceaccount=default:github-actions

# 获取Token
kubectl create token github-actions --duration=87600h | base64 -w 0
```

**步骤2: 创建Secret**

1. 进入GitHub仓库页面
2. 点击 `Settings` > `Secrets and variables` > `Actions`
3. 点击 `New repository secret`
4. 填写:
   - **Name**: `KUBECONFIG_DATA`
   - **Value**: 粘贴base64编码的内容
5. 点击 `Add secret`

**步骤3: 验证配置**

```bash
# 本地测试解码
echo "$KUBECONFIG_DATA" | base64 --decode > test.kubeconfig
kubectl --kubeconfig=test.kubeconfig get nodes

# 如果能正常输出节点列表，说明配置正确
```

#### 安全建议

⚠️ **不要**:
- 使用admin权限的kubeconfig（推荐创建专用ServiceAccount）
- 将kubeconfig提交到Git仓库
- 在公共日志中打印kubeconfig

✅ **建议**:
- 使用专用ServiceAccount，限制权限范围
- 定期轮换Secret
- 使用Namespace隔离

---

### 2. CODECOV_TOKEN (代码覆盖率)

#### 用途
将测试覆盖率数据上传到Codecov，生成可视化报告和徽章。

#### 前置条件
- 注册Codecov账号: https://codecov.io
- 添加GitHub仓库到Codecov

#### 配置步骤

**步骤1: 获取Token**

1. 登录 https://codecov.io
2. 选择你的仓库
3. 进入 `Settings` > `General`
4. 复制 `Repository Upload Token`

**步骤2: 添加到GitHub**

1. GitHub仓库 > `Settings` > `Secrets and variables` > `Actions`
2. `New repository secret`
3. 填写:
   - **Name**: `CODECOV_TOKEN`
   - **Value**: 粘贴Codecov Token
4. `Add secret`

**步骤3: 更新workflow**

在 `.github/workflows/ci.yml` 中添加:

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./backend/coverage/lcov.info
    flags: backend
    token: ${{ secrets.CODECOV_TOKEN }}
```

---

### 3. SLACK_WEBHOOK (Slack通知)

#### 用途
部署成功/失败时发送Slack通知。

#### 前置条件
- 有Slack工作区管理权限

#### 配置步骤

**步骤1: 创建Slack App**

1. 访问 https://api.slack.com/apps
2. 点击 `Create New App` > `From scratch`
3. 填写App名称（如"GitHub CI/CD"）
4. 选择工作区

**步骤2: 启用Incoming Webhooks**

1. 进入App设置页面
2. 点击 `Incoming Webhooks`
3. 开启 `Activate Incoming Webhooks`
4. 点击 `Add New Webhook to Workspace`
5. 选择要发送通知的频道
6. 复制生成的Webhook URL

**步骤3: 添加到GitHub**

1. GitHub仓库 > `Settings` > `Secrets and variables` > `Actions`
2. `New repository secret`
3. 填写:
   - **Name**: `SLACK_WEBHOOK`
   - **Value**: 粘贴Webhook URL
4. `Add secret`

**步骤4: 更新workflow**

```yaml
- name: Notify Slack on success
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "✅ 部署成功: ${{ github.repository }} - ${{ github.sha }}"
      }
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}

- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "❌ 部署失败: ${{ github.repository }} - ${{ github.sha }}"
      }
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🧪 测试Secrets配置

### 方法1: 触发workflow

```bash
# 提交一个小改动触发CI
git commit --allow-empty -m "test: 触发CI测试"
git push origin main
```

然后在GitHub仓库的 `Actions` 标签页查看运行状态。

### 方法2: 手动触发

1. 进入 `Actions` 标签页
2. 选择workflow
3. 点击 `Run workflow` 按钮
4. 选择分支
5. 点击 `Run workflow`

---

## ⚠️ 常见问题

### Q1: KUBECONFIG_DATA配置后部署仍然跳过

**可能原因**:
- Secret名称拼写错误
- base64编码包含换行符

**解决方案**:
```bash
# 确保使用 -w 0 参数（无换行符）
cat ~/.kube/config | base64 -w 0

# 验证Secret是否存在
# GitHub仓库 > Settings > Secrets > Actions
# 应该能看到 KUBECONFIG_DATA
```

---

### Q2: Docker镜像推送失败 "denied: permission_denied"

**可能原因**:
- `permissions` 配置缺失

**解决方案**:
```yaml
jobs:
  build:
    permissions:
      contents: read
      packages: write  # ← 必须添加
```

---

### Q3: Trivy扫描超时

**可能原因**:
- 镜像过大
- 网络问题

**解决方案**:
```yaml
- name: Scan backend image
  uses: aquasecurity/trivy-action@0.20.0
  with:
    image-ref: backend:${{ github.sha }}
    timeout: 10m  # ← 增加超时时间
```

---

## 🔄 Secret轮换计划

### KUBECONFIG_DATA

**建议轮换频率**: 每3个月

**轮换步骤**:
1. 创建新的ServiceAccount
2. 生成新的Token
3. 更新GitHub Secret
4. 测试部署
5. 删除旧的ServiceAccount

### CODECOV_TOKEN

**建议轮换频率**: 每6个月

**轮换步骤**:
1. Codecov > Settings > Regenerate Token
2. 更新GitHub Secret

### SLACK_WEBHOOK

**建议轮换频率**: 泄露时立即轮换

**轮换步骤**:
1. Slack App > Incoming Webhooks > Revoke
2. 创建新的Webhook
3. 更新GitHub Secret

---

## 📊 Secret使用统计

### 当前配置状态

运行以下命令检查:

```bash
# 检查workflow是否引用了Secret
grep -r "secrets\." .github/workflows/

# 输出示例:
# .github/workflows/ci.yml:password: ${{ secrets.GITHUB_TOKEN }}
# .github/workflows/ci.yml:KUBECONFIG_DATA: ${{ secrets.KUBECONFIG_DATA }}
```

---

## 🛡️ 安全最佳实践

### 1. 最小权限原则

为每个Secret配置最小必要权限:

```yaml
# ❌ 不要给过高权限
permissions:
  contents: write
  packages: write
  actions: write

# ✅ 只给必需权限
permissions:
  contents: read
  packages: write
```

### 2. 环境隔离

为不同环境使用不同的Secrets:

```yaml
deploy-staging:
  environment: staging  # 使用staging环境的Secrets

deploy-production:
  environment: production  # 使用production环境的Secrets
```

### 3. Secret审计

定期检查:
- 哪些Secrets被使用
- 上次更新时间
- 是否有未使用的Secret

---

## 📚 参考资料

- [GitHub Secrets官方文档](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Kubernetes ServiceAccount](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/)
- [Codecov文档](https://docs.codecov.com/docs)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)

---

**最后更新**: 2025-01-12
**维护者**: Fashion AI SaaS Team
