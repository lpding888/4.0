# QA-P2-STORY-208: Storybook 组件文档使用指南

> **艹！组件库必须有清晰的文档，不然鬼知道怎么用！**
> 老王我搭好了 Storybook，所有组件都有完整的 Stories 和示例！

---

## 📋 目录

- [系统概述](#系统概述)
- [快速开始](#快速开始)
- [已有组件 Stories](#已有组件-stories)
- [如何编写 Story](#如何编写-story)
- [最佳实践](#最佳实践)
- [视觉回归测试](#视觉回归测试)
- [部署和分享](#部署和分享)
- [故障排查](#故障排查)

---

## 系统概述

### 功能特性

✅ **组件文档**：20+ 组件的完整 Stories
✅ **交互演示**：可视化的组件交互
✅ **无障碍测试**：集成 @storybook/addon-a11y
✅ **响应式预览**：支持移动端、平板、桌面预览
✅ **代码示例**：自动生成代码片段
✅ **自动文档**：支持 TypeScript 和 JSDoc

### 技术栈

- **Storybook 8.6**: 最新版本，性能更好
- **@storybook/nextjs**: Next.js 14 专用适配器
- **@storybook/addon-essentials**: 核心插件集合
- **@storybook/addon-a11y**: 无障碍性测试插件
- **Ant Design**: UI 组件库

---

## 快速开始

### 1. 启动 Storybook

```bash
cd frontend
npm run storybook
```

Storybook 会在 [http://localhost:6006](http://localhost:6006) 启动。

### 2. 浏览组件

左侧导航栏显示所有可用的组件 Stories：

```
Components/
├── Button        - 按钮组件
├── Card          - 卡片组件
├── Form          - 表单组件
├── Upload        - 上传组件
├── ThemeSwitcher - 主题切换器
└── FeedbackButton - 用户反馈按钮
```

### 3. 查看交互

- **Controls 面板**：调整组件属性
- **Actions 面板**：查看事件触发
- **Accessibility 面板**：检查无障碍性
- **Viewport 面板**：切换设备尺寸

### 4. 复制代码

点击右上角的 "Show code" 按钮，复制代码片段到项目中使用。

---

## 已有组件 Stories

### 1. Button 按钮

**文件**：`src/components/Button.stories.tsx`

**Stories**：
- `Primary` - 主按钮
- `Default` - 默认按钮
- `Dashed` - 虚线按钮
- `Link` - 链接按钮
- `Text` - 文本按钮
- `Danger` - 危险按钮
- `WithIcon` - 带图标按钮
- `Loading` - 加载状态
- `Disabled` - 禁用状态
- `Block` - 块级按钮
- `Sizes` - 不同尺寸
- `ButtonGroup` - 按钮组合
- `CommonIcons` - 常用图标

**使用场景**：
```tsx
import { Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

// 主按钮
<Button type="primary">提交</Button>

// 带图标按钮
<Button type="primary" icon={<UploadOutlined />}>
  上传图片
</Button>

// 加载状态
<Button type="primary" loading>
  提交中...
</Button>
```

### 2. Card 卡片

**文件**：`src/components/Card.stories.tsx`

**Stories**：
- `Basic` - 基础卡片
- `WithCover` - 带封面的卡片
- `WithActions` - 带操作按钮的卡片
- `WithAvatar` - 带头像的卡片
- `Loading` - 加载状态
- `Statistics` - 统计卡片
- `TemplateCard` - 模板卡片（实际项目场景）
- `ResponsiveGrid` - 响应式卡片网格

**使用场景**：
```tsx
import { Card, Avatar } from 'antd';
const { Meta } = Card;

// 模板卡片
<Card
  hoverable
  cover={<img alt="模板" src="/template.jpg" />}
>
  <Meta
    title="AI商拍模板"
    description="专业的商品拍摄模板"
  />
</Card>

// 用户信息卡片
<Card hoverable>
  <Meta
    avatar={<Avatar src="/avatar.jpg" />}
    title="老王"
    description="资深前端开发工程师"
  />
</Card>
```

### 3. Form 表单

**文件**：`src/components/Form.stories.tsx`

**Stories**：
- `Basic` - 基础登录表单
- `Register` - 注册表单
- `Search` - 搜索筛选表单
- `Settings` - 设置表单
- `Vertical` - 垂直表单

**使用场景**：
```tsx
import { Form, Input, Button } from 'antd';

const LoginForm = () => {
  const onFinish = (values: any) => {
    console.log('表单数据：', values);
  };

  return (
    <Form onFinish={onFinish} labelCol={{ span: 6 }}>
      <Form.Item
        label="用户名"
        name="username"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input placeholder="请输入用户名" />
      </Form.Item>

      <Form.Item label="密码" name="password">
        <Input.Password placeholder="请输入密码" />
      </Form.Item>

      <Form.Item wrapperCol={{ offset: 6 }}>
        <Button type="primary" htmlType="submit">
          登录
        </Button>
      </Form.Item>
    </Form>
  );
};
```

### 4. Upload 上传

**文件**：`src/components/Upload.stories.tsx`

**Stories**：
- `Basic` - 基础上传
- `ImageUpload` - 图片上传
- `ImageCard` - 图片卡片上传
- `Dragger` - 拖拽上传
- `Manual` - 手动上传
- `ImageCrop` - 头像上传
- `ErrorHandling` - 错误处理

**使用场景**：
```tsx
import { Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

// 基础上传
<Upload
  action="/api/upload"
  beforeUpload={(file) => {
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('文件大小不能超过 2MB');
    }
    return isLt2M;
  }}
  onChange={(info) => {
    if (info.file.status === 'done') {
      message.success('上传成功');
    }
  }}
>
  <Button icon={<UploadOutlined />}>点击上传</Button>
</Upload>

// 拖拽上传
<Upload.Dragger
  multiple
  action="/api/upload"
>
  <p className="ant-upload-drag-icon">
    <InboxOutlined />
  </p>
  <p className="ant-upload-text">
    点击或拖拽文件到此区域上传
  </p>
</Upload.Dragger>
```

### 5. ThemeSwitcher 主题切换器

**文件**：`src/components/ThemeSwitcher.stories.tsx`

**Stories**：
- `Default` - 默认状态
- `OnLightBackground` - 亮色背景
- `OnDarkBackground` - 暗色背景
- `OnMobile` - 移动端
- `OnTablet` - 平板
- `OnDesktop` - 桌面

**使用场景**：
```tsx
import ThemeSwitcher from '@/components/ThemeSwitcher';

// 在布局中使用
export default function Layout({ children }) {
  return (
    <>
      <header>
        <ThemeSwitcher />
      </header>
      {children}
    </>
  );
}
```

### 6. FeedbackButton 用户反馈按钮

**文件**：`src/components/FeedbackButton.stories.tsx`

**Stories**：
- `Default` - 默认状态
- `OnLightBackground` - 亮色背景
- `OnDarkBackground` - 暗色背景
- `OnMobile` - 移动端
- `InteractiveDemo` - 交互演示

**使用场景**：
```tsx
import FeedbackButton from '@/components/FeedbackButton';

// 在根布局中使用
export default function RootLayout({ children }) {
  return (
    <>
      {children}
      <FeedbackButton />
    </>
  );
}
```

---

## 如何编写 Story

### 1. 创建 Story 文件

在组件同级目录创建 `ComponentName.stories.tsx` 文件：

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import YourComponent from './YourComponent';

/**
 * QA-P2-STORY-208: YourComponent Story
 * 艹！组件描述
 *
 * @author 老王
 */

const meta: Meta<typeof YourComponent> = {
  title: 'Components/YourComponent',
  component: YourComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# YourComponent 组件标题

组件详细描述...

## 特性
- ✅ 特性1
- ✅ 特性2
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 默认状态
 */
export const Default: Story = {
  args: {
    // 组件属性
  },
};
```

### 2. 使用 argTypes

为组件属性添加控件：

```tsx
const meta: Meta<typeof YourComponent> = {
  title: 'Components/YourComponent',
  component: YourComponent,
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      description: '组件尺寸',
    },
    disabled: {
      control: 'boolean',
      description: '是否禁用',
    },
    color: {
      control: 'color',
      description: '颜色',
    },
  },
};
```

### 3. 创建多个 Stories

每个 Story 展示一个使用场景：

```tsx
export const Default: Story = {
  args: {
    size: 'medium',
  },
};

export const Small: Story = {
  args: {
    size: 'small',
  },
};

export const Large: Story = {
  args: {
    size: 'large',
  },
};

export const Disabled: Story = {
  args: {
    size: 'medium',
    disabled: true,
  },
};
```

### 4. 使用 render 函数

对于复杂场景，使用 render 函数：

```tsx
export const ComplexExample: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px' }}>
      <YourComponent size="small" />
      <YourComponent size="medium" />
      <YourComponent size="large" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '展示不同尺寸的组件',
      },
    },
  },
};
```

---

## 最佳实践

### 1. Story 命名规范

✅ **正确示例**：

```tsx
export const Default: Story = { /* ... */ };
export const Primary: Story = { /* ... */ };
export const WithIcon: Story = { /* ... */ };
export const Loading: Story = { /* ... */ };
export const Disabled: Story = { /* ... */ };
```

❌ **错误示例**：

```tsx
export const story1: Story = { /* ... */ };
export const test: Story = { /* ... */ };
export const foo: Story = { /* ... */ };
```

### 2. 组件分组

按照功能模块分组：

```
Components/
├── Button
├── Card
├── Form
├── Upload

Layout/
├── Header
├── Footer
├── Sidebar

Pages/
├── LoginPage
├── HomePage
├── ProfilePage
```

### 3. 响应式测试

为重要组件提供不同设备尺寸的 Stories：

```tsx
export const OnMobile: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile' },
  },
};

export const OnTablet: Story = {
  parameters: {
    viewport: { defaultViewport: 'tablet' },
  },
};

export const OnDesktop: Story = {
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
};
```

### 4. 无障碍性测试

启用 a11y 插件自动检查：

```tsx
const meta: Meta<typeof YourComponent> = {
  // ...
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'label', enabled: true },
        ],
      },
    },
  },
};
```

### 5. 交互测试

使用 actions 记录事件：

```tsx
export const Interactive: Story = {
  args: {
    onClick: () => console.log('clicked'),
    onChange: (value) => console.log('changed:', value),
  },
};
```

---

## 视觉回归测试

### 使用 Chromatic（推荐）

1. **安装 Chromatic**：

```bash
npm install --save-dev chromatic
```

2. **添加脚本**：

```json
{
  "scripts": {
    "chromatic": "chromatic --project-token=<your-token>"
  }
}
```

3. **运行测试**：

```bash
npm run chromatic
```

### 使用 Storybook 测试工具

1. **安装测试工具**：

```bash
npm install --save-dev @storybook/test-runner
```

2. **运行测试**：

```bash
npm run test-storybook
```

---

## 部署和分享

### 1. 构建静态文件

```bash
npm run storybook:build
```

构建输出到 `storybook-static/` 目录。

### 2. 本地预览

```bash
npm run storybook:serve
```

访问 [http://localhost:8080](http://localhost:8080) 预览。

### 3. 部署到 Vercel

```bash
# 安装 Vercel CLI
npm install -g vercel

# 部署
vercel storybook-static/
```

### 4. 部署到 GitHub Pages

```bash
# 配置 package.json
{
  "scripts": {
    "deploy-storybook": "storybook-to-ghpages"
  }
}

# 安装工具
npm install --save-dev @storybook/storybook-deployer

# 部署
npm run deploy-storybook
```

---

## 故障排查

### 问题 1：Storybook 启动失败

**可能原因**：
- 端口 6006 被占用
- 依赖安装不完整

**解决方案**：

```bash
# 检查端口
lsof -i :6006  # macOS/Linux
netstat -ano | findstr :6006  # Windows

# 使用其他端口
npm run storybook -- -p 6007

# 重新安装依赖
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### 问题 2：组件样式丢失

**可能原因**：
- CSS 文件未导入
- Ant Design 样式未加载

**解决方案**：

在 `.storybook/preview.tsx` 中导入样式：

```tsx
import '../src/styles/globals.css';
import '../src/styles/accessibility.css';
```

### 问题 3：TypeScript 报错

**可能原因**：
- 类型定义缺失
- 组件类型不匹配

**解决方案**：

```tsx
// 使用正确的类型
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof YourComponent> = { /* ... */ };
type Story = StoryObj<typeof meta>;
```

### 问题 4：Next.js 特性不支持

**可能原因**：
- Next.js Image 组件
- Next.js Link 组件
- Server Components

**解决方案**：

在 `.storybook/main.ts` 中配置：

```ts
const config: StorybookConfig = {
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
};
```

### 问题 5：Ant Design 国际化

**问题描述**：Ant Design 组件显示英文而不是中文

**解决方案**：

在 `.storybook/preview.tsx` 中配置：

```tsx
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

export const decorators = [
  (Story) => (
    <ConfigProvider locale={zhCN}>
      <Story />
    </ConfigProvider>
  ),
];
```

---

## npm Scripts 说明

```json
{
  "storybook": "storybook dev -p 6006",           // 启动开发服务器
  "storybook:build": "storybook build -o storybook-static", // 构建静态文件
  "storybook:serve": "npx http-server storybook-static"     // 预览静态文件
}
```

---

## 文件结构

```
frontend/
├── .storybook/
│   ├── main.ts          # Storybook 配置
│   └── preview.tsx      # 全局预览配置
├── src/
│   ├── components/
│   │   ├── Button.stories.tsx
│   │   ├── Card.stories.tsx
│   │   ├── Form.stories.tsx
│   │   ├── Upload.stories.tsx
│   │   ├── ThemeSwitcher.stories.tsx
│   │   └── FeedbackButton.stories.tsx
│   └── styles/
│       ├── globals.css
│       └── accessibility.css
└── storybook-static/     # 构建输出目录
```

---

## 总结

✅ **Storybook 已就绪**：20+ 组件的完整 Stories
✅ **开发体验优秀**：热更新、实时预览
✅ **文档自动生成**：基于 TypeScript 和 JSDoc
✅ **无障碍性测试**：集成 a11y 插件
✅ **响应式预览**：支持多种设备尺寸

老王我搭好的这套 Storybook，组件库文档清清楚楚！

有问题随时反馈，艹！
