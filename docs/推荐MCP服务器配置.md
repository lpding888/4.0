# 推荐 MCP 服务器配置指南

> 老王精选！专门为 AI 智能衣柜/CMS 系统开发优化的 MCP 服务器配置。

---

## 📦 你已经安装的 MCP（保留）

| MCP 名称 | 用途 | 推荐保留 |
|---------|------|---------|
| **context7** | 获取最新库文档（React/Next.js/Express） | ✅ 必须保留 |
| **open-websearch** | 网页搜索（DuckDuckGo/Bing/Brave） | ✅ 必须保留 |
| **Playwright** | 浏览器自动化测试 | ✅ 保留（QA 测试用） |
| **serena** | 代码符号搜索、重命名、分析 | ✅ 必须保留 |
| **spec-workflow** | 规格说明工作流 | ⚠️ 可选（项目用不到） |
| **deepwiki** | 文档抓取 | ⚠️ 可选（context7 更强） |

---

## 🔥 老王推荐的新 MCP（必装）

### 1. **@modelcontextprotocol/server-filesystem**
**用途**：文件系统操作（读写文件、创建目录、搜索文件）

**为什么需要**：
- Skills 手册需要频繁读写文件
- 任务卡需要批量处理 JSON 文件
- CMS 系统需要生成大量代码文件

**安装**：
```bash
npx @modelcontextprotocol/create-server filesystem
```

**配置**（添加到 `claude_desktop_config.json`）：
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "c:\\Users\\qq100\\Desktop\\迭代目录\\新建文件夹 (4)"
      ]
    }
  }
}
```

---

### 2. **@modelcontextprotocol/server-git**
**用途**：Git 操作（提交、分支、diff、log）

**为什么需要**：
- Backend Dev/Frontend Dev 需要提交代码
- Reviewer 需要查看 diff 和历史
- Deploy 需要管理分支和标签

**安装**：
```bash
npx @modelcontextprotocol/create-server git
```

**配置**：
```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "c:\\Users\\qq100\\Desktop\\迭代目录\\新建文件夹 (4)"
      ]
    }
  }
}
```

---

### 3. **@modelcontextprotocol/server-postgres**
**用途**：PostgreSQL/MySQL 数据库操作（查询、迁移、Schema 管理）

**为什么需要**：
- Backend Dev 需要设计数据库 Schema
- 需要执行 Knex 迁移脚本
- QA 需要验证数据库状态

**安装**：
```bash
npx @modelcontextprotocol/create-server postgres
```

**配置**：
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "mysql://cms:secure@127.0.0.1:3306/cms"
      ]
    }
  }
}
```

⚠️ **注意**：将 `mysql://cms:secure@127.0.0.1:3306/cms` 替换为你的实际数据库连接字符串。

---

### 4. **@modelcontextprotocol/server-memory**
**用途**：AI 记忆存储（保存项目上下文、设计决策）

**为什么需要**：
- 记住项目的技术栈和架构决策
- 记住 Skills 手册的关键规则
- 跨会话保持上下文

**安装**：
```bash
npx @modelcontextprotocol/create-server memory
```

**配置**：
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ]
    }
  }
}
```

---

### 5. **mcp-server-fetch**（社区）
**用途**：HTTP 请求（测试 API、抓取网页内容）

**为什么需要**：
- Backend Dev 测试 API 端点
- 抓取 Provider 的官方文档
- QA 测试 HTTP 接口

**安装**：
```bash
npm install -g @executeautomation/mcp-server-fetch
```

**配置**：
```json
{
  "mcpServers": {
    "fetch": {
      "command": "mcp-server-fetch"
    }
  }
}
```

---

### 6. **mcp-server-docker**（社区）
**用途**：Docker 容器管理（启动/停止容器、查看日志）

**为什么需要**：
- 本地启动 MySQL/Redis 容器
- Deploy 管理容器化部署
- QA 测试容器环境

**安装**：
```bash
npm install -g @modelcontextprotocol/server-docker
```

**配置**：
```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-docker"
      ]
    }
  }
}
```

---

## 📋 完整 MCP 配置文件

### Claude Desktop Config 路径
**Windows**：`%APPDATA%\Claude\claude_desktop_config.json`
**macOS**：`~/Library/Application Support/Claude/claude_desktop_config.json`

### 完整配置（复制粘贴）

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    },
    "open-websearch": {
      "command": "npx",
      "args": ["-y", "mcp-open-websearch"]
    },
    "serena": {
      "command": "npx",
      "args": ["-y", "@serenaai/mcp-serena"]
    },
    "Playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "c:\\Users\\qq100\\Desktop\\迭代目录\\新建文件夹 (4)"
      ]
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "c:\\Users\\qq100\\Desktop\\迭代目录\\新建文件夹 (4)"
      ]
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "mysql://cms:secure@127.0.0.1:3306/cms"
      ]
    },
    "memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-memory"
      ]
    },
    "fetch": {
      "command": "npx",
      "args": [
        "-y",
        "@executeautomation/mcp-server-fetch"
      ]
    },
    "docker": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-docker"
      ]
    }
  }
}
```

⚠️ **注意事项**：
1. 将路径 `c:\\Users\\qq100\\Desktop\\迭代目录\\新建文件夹 (4)` 替换为你的实际项目路径
2. 将数据库连接字符串 `mysql://cms:secure@127.0.0.1:3306/cms` 替换为实际值
3. 如果不需要某些 MCP，可以直接删除对应配置块

---

## 🎯 各 Skills 推荐使用的 MCP

### Backend Dev 推荐 MCP

| MCP | 用途 |
|-----|------|
| **filesystem** | 读写 OpenAPI 契约、迁移脚本、测试文件 |
| **git** | 提交代码、查看 diff、管理分支 |
| **postgres** | 执行 SQL、验证 Schema、查看数据 |
| **serena** | 符号搜索、重命名、代码分析 |
| **context7** | 查看 Express.js/Knex.js 文档 |
| **fetch** | 测试 API 端点 |

### Frontend Dev 推荐 MCP

| MCP | 用途 |
|-----|------|
| **filesystem** | 读写组件、样式、配置文件 |
| **git** | 提交代码、查看 diff |
| **serena** | 符号搜索、重命名 |
| **context7** | 查看 Next.js/React/AntD 文档 |
| **Playwright** | E2E 测试表单编辑器 |

### SCF Worker 推荐 MCP

| MCP | 用途 |
|-----|------|
| **filesystem** | 读写云函数代码 |
| **git** | 提交代码 |
| **context7** | 查看腾讯云 SCF 文档 |
| **fetch** | 测试云函数 HTTP 端点 |

### QA Acceptance 推荐 MCP

| MCP | 用途 |
|-----|------|
| **Playwright** | E2E 测试 |
| **fetch** | API 测试 |
| **postgres** | 数据库状态验证 |
| **docker** | 容器环境管理 |

### Reviewer 推荐 MCP

| MCP | 用途 |
|-----|------|
| **git** | 查看 diff、历史、分支 |
| **serena** | 代码符号分析 |
| **filesystem** | 读取代码文件 |

### Product Planner 推荐 MCP

| MCP | 用途 |
|-----|------|
| **filesystem** | 读写任务卡 JSON |
| **memory** | 记住项目上下文和设计决策 |
| **context7** | 查看技术文档 |

### Billing Guard 推荐 MCP

| MCP | 用途 |
|-----|------|
| **postgres** | 查询配额/账单数据 |
| **serena** | 查找计费打点代码 |

### CodeBuddy Deploy 推荐 MCP

| MCP | 用途 |
|-----|------|
| **git** | 管理分支、标签、发布 |
| **docker** | 容器部署管理 |
| **filesystem** | 读写部署脚本 |

---

## 🚀 快速配置步骤

### Step 1：备份现有配置

```bash
# Windows
copy %APPDATA%\Claude\claude_desktop_config.json %APPDATA%\Claude\claude_desktop_config.json.backup

# macOS
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup
```

### Step 2：替换配置文件

1. 打开 `%APPDATA%\Claude\claude_desktop_config.json`（Windows）
2. 复制上面的 **完整配置** 粘贴进去
3. 修改路径和数据库连接字符串
4. 保存文件

### Step 3：重启 Claude Desktop

关闭并重新打开 Claude Desktop 应用。

### Step 4：验证 MCP 安装

在 Claude Code 中执行：

```
请列出所有可用的 MCP 服务器
```

你应该看到：
- context7
- open-websearch
- serena
- Playwright
- filesystem
- git
- postgres
- memory
- fetch
- docker

### Step 5：测试 MCP 功能

```
# 测试 filesystem
请读取文件：skills/backend_dev_skill/SKILL.md 的前 10 行

# 测试 git
请查看最近 5 次 git 提交

# 测试 postgres
请列出数据库中的所有表

# 测试 memory
请记住：本项目使用 Express.js + Knex.js + MySQL 8 技术栈

# 测试 fetch
请测试 API：GET http://localhost:8080/health
```

---

## 🎓 MCP 使用技巧

### 1. 链式调用 MCP

```markdown
# 场景：Backend Dev 开发完 API 后提交代码

1. [filesystem] 读取 OpenAPI 契约
2. [git] 查看文件变更
3. [git] 提交代码：git commit -m "feat: 添加 Provider 管理 API"
4. [fetch] 测试 API 端点
5. [postgres] 验证数据库 Schema
```

### 2. Skills + MCP 协同

```markdown
# 角色：Backend Dev
# Skills 手册：[粘贴 backend_dev_skill/SKILL.md]
# 任务卡：CMS-002

# 开发流程：
1. [filesystem] 读取任务卡 JSON
2. [context7] 查看 Express.js 文档
3. [filesystem] 创建 OpenAPI 契约
4. [filesystem] 创建迁移脚本
5. [filesystem] 创建服务/控制器代码
6. [serena] 符号搜索检查依赖
7. [git] 提交代码
8. [fetch] 测试 API
9. [postgres] 验证数据库
```

### 3. 批量操作

```markdown
# 场景：批量处理 46 张任务卡

1. [filesystem] 读取 tasks/cms-system/Backend Dev.json
2. [memory] 记住所有 Backend Dev 任务卡
3. 逐个执行任务卡（CMS-002 → CMS-003 → ...）
4. [git] 每完成一张卡提交一次
5. [filesystem] 更新任务卡状态（completed）
```

---

## ⚠️ 注意事项

### 1. MCP 权限管理

某些 MCP 需要敏感权限（如 filesystem、git、postgres），Claude 会在首次使用时请求授权。

**建议**：
- ✅ 授权：filesystem、git、serena、context7
- ⚠️ 谨慎授权：postgres（生产环境数据库）
- ❌ 不授权：未知来源的社区 MCP

### 2. 数据库安全

**禁止在配置文件中明文保存生产数据库密码！**

推荐做法：
```json
{
  "postgres": {
    "command": "npx",
    "args": [
      "-y",
      "@modelcontextprotocol/server-postgres",
      "mysql://cms:${DB_PASSWORD}@127.0.0.1:3306/cms"
    ],
    "env": {
      "DB_PASSWORD": "从环境变量读取"
    }
  }
}
```

### 3. MCP 冲突

如果多个 MCP 提供类似功能（如 deepwiki 和 context7 都能抓文档），保留功能更强的：

- **保留 context7**，删除 deepwiki
- **保留 serena**（符号搜索），删除基础的 filesystem 搜索
- **保留 open-websearch**（多引擎），删除单一搜索 MCP

---

## 📊 MCP 性能对比

| MCP | 启动速度 | 资源占用 | 稳定性 | 推荐指数 |
|-----|---------|---------|--------|---------|
| filesystem | ⭐⭐⭐⭐⭐ | 低 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ 必装 |
| git | ⭐⭐⭐⭐ | 低 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ 必装 |
| serena | ⭐⭐⭐ | 中 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ 必装 |
| context7 | ⭐⭐⭐⭐ | 低 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ 必装 |
| postgres | ⭐⭐⭐ | 中 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ 推荐 |
| Playwright | ⭐⭐ | 高 | ⭐⭐⭐ | ⭐⭐⭐ 可选 |
| memory | ⭐⭐⭐⭐⭐ | 低 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ 推荐 |
| fetch | ⭐⭐⭐⭐⭐ | 低 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ 推荐 |
| docker | ⭐⭐⭐ | 中 | ⭐⭐⭐ | ⭐⭐⭐ 可选 |

---

## 🎉 总结

### 必装 MCP（5 个）
1. ✅ **filesystem** - 文件操作（读写代码）
2. ✅ **git** - 版本控制（提交代码）
3. ✅ **serena** - 代码分析（符号搜索）
4. ✅ **context7** - 文档查询（技术文档）
5. ✅ **memory** - AI 记忆（项目上下文）

### 推荐 MCP（3 个）
6. ⭐ **postgres** - 数据库操作（Backend Dev 必备）
7. ⭐ **fetch** - HTTP 请求（API 测试）
8. ⭐ **open-websearch** - 网页搜索（已安装）

### 可选 MCP（2 个）
9. ⚙️ **Playwright** - 浏览器测试（QA 用）
10. ⚙️ **docker** - 容器管理（Deploy 用）

### 建议删除
11. ❌ **spec-workflow** - 项目用不到
12. ❌ **deepwiki** - context7 更强

---

## 📞 遇到问题？

### Q1：MCP 安装失败

**解决方案**：
```bash
# 清除 npm 缓存
npm cache clean --force

# 重新安装
npx -y @modelcontextprotocol/server-filesystem
```

### Q2：Claude 无法识别 MCP

**解决方案**：
1. 检查配置文件路径是否正确
2. 检查 JSON 格式是否正确（逗号、引号）
3. 重启 Claude Desktop

### Q3：MCP 调用报错

**解决方案**：
1. 检查路径是否正确（Windows 双反斜杠）
2. 检查权限（文件夹访问权限）
3. 查看 Claude 日志（Help → View Logs）

---

艹，MCP 配置完成！有问题随时问老王！🚀
