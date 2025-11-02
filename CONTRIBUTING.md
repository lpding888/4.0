# 🤝 贡献指南

感谢你对 **AI Dev Skills** 项目的关注！我们欢迎所有形式的贡献。

---

## 📋 贡献方式

### 1. 报告 Bug

如果你发现了 Bug，请[创建 Issue](https://github.com/你的用户名/ai-dev-skills/issues/new)并包含以下信息：

- **Bug 描述**：清晰描述问题
- **重现步骤**：如何触发这个 Bug
- **预期行为**：应该发生什么
- **实际行为**：实际发生了什么
- **环境信息**：
  - AI 工具（Claude/GPT/Gemini）
  - AI 版本（如 Claude Sonnet 4）
  - 操作系统（Windows/macOS/Linux）
  - 使用方式（手动复制/插件模式/任务卡）

**示例**：
```markdown
### Bug 描述
Backend Dev Skill 的 CHECKLIST 中缺少 Docker 部署检查项

### 重现步骤
1. 打开 `skills/backend_dev_skill/SKILL.md`
2. 查看 CHECKLIST 部分
3. 没有找到 Docker 相关检查项

### 预期行为
应该有 Docker 镜像构建、容器启动检查项

### 实际行为
CHECKLIST 只包含 PM2 部署检查

### 环境信息
- AI: Claude Sonnet 4
- OS: Windows 11
- 使用方式: 手动复制
```

---

### 2. 提出新功能建议

如果你有新功能想法，请[创建 Issue](https://github.com/你的用户名/ai-dev-skills/issues/new)并包含：

- **功能描述**：清晰描述新功能
- **使用场景**：什么情况下需要这个功能
- **预期收益**：这个功能能解决什么问题
- **实现建议**（可选）：你认为应该怎么实现

**示例**：
```markdown
### 功能描述
增加"移动端开发 Skill"（React Native）

### 使用场景
开发跨平台移动应用时，需要 AI 遵循 React Native 开发规范

### 预期收益
- 统一移动端代码风格
- 避免常见 React Native 陷阱（性能优化、平台差异）
- 支持 iOS/Android 双平台开发

### 实现建议
参考 Frontend Dev Skill，增加：
- CONTEXT：React Native + Expo 技术栈
- RULES：平台特定代码隔离、性能优化规则
- EXAMPLES：导航、状态管理、原生模块调用示例
```

---

### 3. 提交 Pull Request

#### 开发流程

```bash
# 1. Fork 仓库到你的 GitHub 账号
# 点击页面右上角的 "Fork" 按钮

# 2. 克隆你的 Fork
git clone https://github.com/你的用户名/ai-dev-skills.git
cd ai-dev-skills

# 3. 添加上游仓库（用于同步最新代码）
git remote add upstream https://github.com/原作者/ai-dev-skills.git

# 4. 创建新分支
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix

# 5. 进行修改
# 编辑 SKILL.md 文件或添加新 Skill

# 6. 测试你的修改
# 用 Claude/GPT 测试 Skill 是否能正常工作

# 7. 提交代码
git add .
git commit -m "feat: 添加移动端开发 Skill"
# 或
git commit -m "fix: 修复 Backend Dev CHECKLIST 缺少 Docker 检查项"

# 8. 推送到你的 Fork
git push origin feature/your-feature-name

# 9. 在 GitHub 上创建 Pull Request
# 访问你的 Fork，点击 "New pull request"
```

#### Commit Message 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档修改
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构（不新增功能、不修复 Bug）
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**：
```bash
# 新增功能
git commit -m "feat(skills): 添加移动端开发 Skill"

# 修复 Bug
git commit -m "fix(backend-dev): 修复 CHECKLIST 缺少 Docker 检查项"

# 文档更新
git commit -m "docs(readme): 更新快速开始章节"

# 代码格式
git commit -m "style(frontend-dev): 统一 Markdown 缩进为 2 空格"
```

---

## 🎯 贡献类型

### A. 修复现有 Skill

**适合**：发现某个 Skill 有错误、遗漏或可以改进

**步骤**：
1. 找到对应的 `skills/<skill_name>/SKILL.md`
2. 修改 SKILL.md 文件
3. 确保包含完整的 6 大模块（README/RULES/CONTEXT/FLOW/CHECKLIST/EXAMPLES）
4. 用 AI 测试修改后的 Skill
5. 提交 PR

**示例 PR 标题**：
- `fix(backend-dev): 添加 Docker 部署检查项到 CHECKLIST`
- `feat(frontend-dev): 增加 Tailwind CSS 配置示例`
- `docs(qa-acceptance): 补充 k6 性能测试示例`

---

### B. 添加新 Skill

**适合**：为新的开发角色创建 Skill（如移动端开发、AI 训练）

**步骤**：
1. 创建新目录 `skills/<new_skill_name>/`
2. 创建 `SKILL.md` 文件
3. 按照以下模板编写：

```markdown
---
name: your-skill-name
description: 清晰描述该 Skill 做什么、何时使用、技术栈
---

# Your Skill Name - 中文名称

## 我是谁
[职责描述]

## 我的职责
[核心职责列表]

## 我何时被调用
[触发条件]

## 我交付什么
[交付物清单]

## 与其他 Skills 的协作
[协作关系]

## 目标与门槛
[质量门禁]

---

# 行为准则（RULES）
[红线约束]

---

# 项目背景（CONTEXT）
[技术栈、配置、约定]

---

# 工作流程（FLOW）
[标准工作流程]

---

# 自检清单（CHECKLIST）
[提交前检查项]

---

# 完整示例（EXAMPLES）
[真实代码模板]
```

4. 在 `README-GITHUB.md` 中添加新 Skill 到表格
5. 用 AI 测试新 Skill
6. 提交 PR

**示例 PR 标题**：
- `feat(skills): 添加移动端开发 Skill (React Native)`
- `feat(skills): 添加 AI 训练 Skill (Fine-tuning)`

---

### C. 改进文档

**适合**：改进 README、使用指南、MCP 配置等文档

**步骤**：
1. 修改对应的 Markdown 文件
2. 确保语言清晰、示例准确
3. 提交 PR

**示例 PR 标题**：
- `docs(readme): 添加 GPT-4 使用示例`
- `docs(guide): 补充插件模式故障排查`
- `docs(mcp): 更新 PostgreSQL MCP 配置`

---

### D. 添加示例代码

**适合**：为某个 Skill 添加真实可用的代码示例

**步骤**：
1. 在对应 Skill 的 EXAMPLES 部分添加代码
2. 确保代码可运行、有注释
3. 提交 PR

**示例 PR 标题**：
- `feat(backend-dev): 添加 Redis 缓存失效策略示例`
- `feat(frontend-dev): 添加 Zustand 状态管理示例`

---

## ✅ Pull Request 检查清单

在提交 PR 前，请确保：

### 通用检查
- [ ] 代码符合项目风格（Markdown 格式、缩进一致）
- [ ] 没有拼写错误
- [ ] 没有死链接
- [ ] Commit Message 符合规范
- [ ] PR 标题清晰（如 `feat(backend-dev): 添加 Docker 部署检查项`）
- [ ] PR 描述详细（说明修改了什么、为什么、如何测试）

### Skill 相关检查
- [ ] SKILL.md 包含完整的 6 大模块
- [ ] YAML frontmatter 包含 `name` 和 `description`
- [ ] `description` 清晰描述职责、技术栈、使用场景
- [ ] RULES 定义了明确的红线约束
- [ ] CONTEXT 包含具体技术栈和配置
- [ ] FLOW 描述了清晰的工作流程
- [ ] CHECKLIST 包含实用的检查项（≥ 10 项）
- [ ] EXAMPLES 提供了真实可用的代码模板
- [ ] 用 AI（Claude/GPT）测试过，确认能正常工作

### 文档相关检查
- [ ] README 更新（如果添加了新 Skill）
- [ ] 使用指南更新（如果改变了使用方式）
- [ ] 链接正确（相对路径、锚点）

---

## 🎓 贡献建议

### 1. 保持简洁

❌ **不好的示例**：
```markdown
## 我的职责

我负责很多很多事情，包括但不限于后端开发、数据库设计、API 设计、
性能优化、安全加固、代码审查、文档编写、测试编写、部署上线、
运维监控、故障排查、用户支持、产品设计、项目管理...
```

✅ **好的示例**：
```markdown
## 我的职责

- 根据任务卡 **理解 → 设计 → 实现 → 测试 → 汇报**
- 产出 **OpenAPI 契约、数据库迁移、服务代码、测试**
- 与 Frontend/SCF 协作：以 **OpenAPI 契约** 为唯一事实来源
```

### 2. 提供真实示例

❌ **不好的示例**：
```markdown
## 示例

参考官方文档学习如何使用 Express.js
```

✅ **好的示例**：
```markdown
## 示例

### Express.js 路由示例
\`\`\`javascript
const express = require('express');
const router = express.Router();

router.get('/users', async (req, res) => {
  const users = await userService.list();
  res.json({ code: 0, data: users });
});

module.exports = router;
\`\`\`
```

### 3. 明确质量门禁

❌ **不好的示例**：
```markdown
## 目标与门槛

代码质量要高，性能要好，安全要到位。
```

✅ **好的示例**：
```markdown
## 目标与门禁

- **质量门槛**：UT 覆盖率 ≥ 80%，E2E 路径可通
- **性能门槛**：核心接口 P95 ≤ 200ms（4核4G，PM2 3 进程）
- **安全门槛**：鉴权/授权/输入校验/速率限制/审计日志到位
```

### 4. 定义清晰的红线

❌ **不好的示例**：
```markdown
## RULES

尽量不要犯错。
```

✅ **好的示例**：
```markdown
## RULES

❌ **禁止跳过 OpenAPI 直接实现接口**
❌ **禁止在仓库提交明文密钥/证书**
❌ **禁止在日志中打印密码、Token、身份证/手机号**
```

---

## 🏆 贡献者

感谢所有贡献者！

<!-- ALL-CONTRIBUTORS-LIST:START -->
<!-- 这里会自动生成贡献者列表 -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

---

## 📞 需要帮助？

如果你在贡献过程中遇到问题：

- 💬 [GitHub Discussions](https://github.com/你的用户名/ai-dev-skills/discussions) - 提问讨论
- 📧 Email: your-email@example.com
- 🐦 Twitter: [@your_twitter](https://twitter.com/your_twitter)

---

再次感谢你的贡献！ 🙏
