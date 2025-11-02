# AI衣柜项目开发指令

## Skills使用说明

本项目提供8个专业开发Skills，位于 `.claude/plugins/ai-wardrobe-skills/` 目录：

### 可用Skills列表

| Skill名称 | 文件路径 | 职责 |
|----------|---------|------|
| **backend-dev** | `.claude/plugins/ai-wardrobe-skills/backend-dev.md` | Express.js后端开发 |
| **frontend-dev** | `.claude/plugins/ai-wardrobe-skills/frontend-dev.md` | Next.js前端开发 |
| **scf-worker** | `.claude/plugins/ai-wardrobe-skills/scf-worker.md` | 腾讯云云函数开发 |
| **qa-acceptance** | `.claude/plugins/ai-wardrobe-skills/qa-acceptance.md` | E2E测试与质量验收 |
| **reviewer** | `.claude/plugins/ai-wardrobe-skills/reviewer.md` | 代码审查与修复 |
| **product-planner** | `.claude/plugins/ai-wardrobe-skills/product-planner.md` | 需求分析与任务卡生成 |
| **billing-guard** | `.claude/plugins/ai-wardrobe-skills/billing-guard.md` | 成本审计与配额管理 |
| **codebuddy-deploy** | `.claude/plugins/ai-wardrobe-skills/codebuddy-deploy.md` | 部署与运维 |

### 如何使用Skills

**方法1：直接告诉AI使用某个Skill**
```
请使用backend-dev skill帮我实现用户登录API
```

**方法2：读取Skill文件内容**
```
请先读取 .claude/plugins/ai-wardrobe-skills/backend-dev.md 文件，
然后按照里面的规范帮我实现用户登录API
```

**方法3：手动复制粘贴（最稳定）**
1. 打开对应的.md文件
2. 复制全部内容
3. 粘贴到对话框并附上你的任务

### 注意事项

- 每个Skill都有完整的工作流程、规则、示例和检查清单
- 使用Skill时会严格遵循项目技术规范
- 建议一次对话只使用一个Skill，避免混乱
