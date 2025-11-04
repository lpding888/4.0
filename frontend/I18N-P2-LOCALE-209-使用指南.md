# I18N-P2-LOCALE-209: 国际化 i18n 使用指南

> **艹！多语言支持是必须的，国际化项目必备！**
> 老王我集成了 next-intl，支持中英文切换，翻译文件结构清晰！

---

## 📋 目录

- [系统概述](#系统概述)
- [快速开始](#快速开始)
- [翻译文件结构](#翻译文件结构)
- [在组件中使用](#在组件中使用)
- [语言切换器](#语言切换器)
- [路由国际化](#路由国际化)
- [添加新语言](#添加新语言)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)

---

## 系统概述

### 功能特性

✅ **双语支持**：中文（简体）和英文
✅ **自动检测**：根据浏览器语言自动选择
✅ **路由国际化**：URL 包含语言代码（/zh、/en）
✅ **持久化**：语言选择保存到 localStorage
✅ **类型安全**：TypeScript 支持
✅ **SSR 支持**：服务端渲染友好

### 技术栈

- **next-intl**: Next.js 国际化库
- **JSON**: 翻译文件格式
- **TypeScript**: 类型安全

---

## 快速开始

### 1. 安装依赖

```bash
npm install next-intl
```

### 2. 配置文件结构

```
frontend/
├── src/
│   ├── i18n/
│   │   ├── request.ts          # next-intl 配置
│   │   └── messages/
│   │       ├── zh.json          # 中文翻译
│   │       └── en.json          # 英文翻译
│   ├── middleware.ts            # 路由中间件（集成i18n）
│   └── components/
│       └── LanguageSwitcher.tsx # 语言切换器
└── next.config.mjs              # Next.js 配置（集成i18n）
```

### 3. 在组件中使用翻译

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('common');

  return (
    <div>
      <h1>{t('appName')}</h1>
      <p>{t('appDescription')}</p>
    </div>
  );
}
```

---

## 翻译文件结构

### 中文翻译 (src/i18n/messages/zh.json)

```json
{
  "common": {
    "appName": "AI衣柜",
    "appDescription": "专业的服装图片AI处理服务",
    "submit": "提交",
    "cancel": "取消"
  },
  "nav": {
    "home": "首页",
    "workspace": "工作台",
    "templates": "模板中心"
  },
  "auth": {
    "login": "登录",
    "register": "注册",
    "username": "用户名",
    "password": "密码"
  }
}
```

### 英文翻译 (src/i18n/messages/en.json)

```json
{
  "common": {
    "appName": "AI Wardrobe",
    "appDescription": "Professional AI Image Processing for Fashion",
    "submit": "Submit",
    "cancel": "Cancel"
  },
  "nav": {
    "home": "Home",
    "workspace": "Workspace",
    "templates": "Templates"
  },
  "auth": {
    "login": "Login",
    "register": "Register",
    "username": "Username",
    "password": "Password"
  }
}
```

### 翻译键分类

**common**: 通用文本
- appName, appDescription
- submit, cancel, confirm, delete, edit, save
- loading, success, error, warning

**nav**: 导航菜单
- home, workspace, templates, studio
- settings, help, logout

**auth**: 认证相关
- login, register, username, password
- loginSuccess, loginFailed

**templates**: 模板中心
- title, description, search
- category, featured, popular

**studio**: AI商拍工作室
- title, description
- uploadTip, generateNow

**lookbook**: Lookbook生成
**shortVideo**: 短视频生成
**imageTranslate**: 图片翻译
**upload**: 上传相关
**theme**: 主题设置
**feedback**: 用户反馈
**errors**: 错误提示
**settings**: 设置页面

---

## 在组件中使用

### 1. 客户端组件

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function LoginForm() {
  const t = useTranslations('auth');

  return (
    <form>
      <label>{t('username')}</label>
      <input placeholder={t('username')} />

      <label>{t('password')}</label>
      <input type="password" placeholder={t('password')} />

      <button>{t('login')}</button>
    </form>
  );
}
```

### 2. 服务端组件

```tsx
import { getTranslations } from 'next-intl/server';

export default async function HomePage() {
  const t = await getTranslations('common');

  return (
    <div>
      <h1>{t('appName')}</h1>
      <p>{t('appDescription')}</p>
    </div>
  );
}
```

### 3. 使用多个命名空间

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function Dashboard() {
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');
  const tSettings = useTranslations('settings');

  return (
    <>
      <header>
        <h1>{tNav('workspace')}</h1>
      </header>
      <main>
        <p>{tCommon('loading')}</p>
      </main>
      <footer>
        <a href="/settings">{tNav('settings')}</a>
      </footer>
    </>
  );
}
```

### 4. 动态插值

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function Welcome({ username }: { username: string }) {
  const t = useTranslations('common');

  // 在翻译文件中：
  // "welcome": "欢迎回来，{username}！"

  return <h1>{t('welcome', { username })}</h1>;
}
```

### 5. 复数形式

```tsx
// 在翻译文件中：
// "itemCount": "{count, plural, =0 {没有项目} one {# 个项目} other {# 个项目}}"

const t = useTranslations('common');

<p>{t('itemCount', { count: 0 })}</p>  // 输出：没有项目
<p>{t('itemCount', { count: 1 })}</p>  // 输出：1 个项目
<p>{t('itemCount', { count: 5 })}</p>  // 输出：5 个项目
```

---

## 语言切换器

### LanguageSwitcher 组件

```tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Select } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';

const languages = [
  { value: 'zh', label: '简体中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    // 保存到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale);
    }

    // 替换 URL 中的语言代码
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPathname);
  };

  return (
    <Select
      value={locale}
      onChange={handleChange}
      style={{ width: 150 }}
      suffixIcon={<GlobalOutlined />}
      options={languages.map((lang) => ({
        value: lang.value,
        label: (
          <span>
            {lang.flag} {lang.label}
          </span>
        ),
      }))}
    />
  );
}
```

### 在布局中使用

```tsx
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function RootLayout({ children }) {
  return (
    <>
      <header>
        <nav>
          {/* 导航菜单 */}
          <LanguageSwitcher />
        </nav>
      </header>
      <main>{children}</main>
    </>
  );
}
```

---

## 路由国际化

### URL 结构

```
/zh/                       # 中文首页
/zh/workspace              # 中文工作台
/zh/templates              # 中文模板中心

/en/                       # 英文首页
/en/workspace              # 英文工作台
/en/templates              # 英文模板中心
```

### 自动重定向

访问 `/` 会自动重定向到：
- `/zh`（如果浏览器语言是中文）
- `/en`（如果浏览器语言是英文）

### Link 组件

```tsx
import { Link } from 'next-intl';

// 自动包含当前语言前缀
<Link href="/workspace">工作台</Link>

// 输出：/zh/workspace（如果当前语言是中文）
// 输出：/en/workspace（如果当前语言是英文）
```

---

## 添加新语言

### 1. 添加翻译文件

创建 `src/i18n/messages/ja.json`（日语示例）：

```json
{
  "common": {
    "appName": "AIワードローブ",
    "appDescription": "プロフェッショナルなファッション画像AI処理サービス",
    "submit": "送信",
    "cancel": "キャンセル"
  }
}
```

### 2. 更新配置

**src/i18n/request.ts**：

```ts
export const locales = ['zh', 'en', 'ja'] as const;
```

**src/middleware.ts**：

```ts
const intlMiddleware = createIntlMiddleware({
  locales: ['zh', 'en', 'ja'],
  defaultLocale: 'zh',
});
```

### 3. 更新语言切换器

```tsx
const languages = [
  { value: 'zh', label: '简体中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
];
```

---

## 最佳实践

### 1. 翻译键命名规范

✅ **正确示例**：

```json
{
  "auth": {
    "loginButton": "登录",
    "registerButton": "注册",
    "usernameLabel": "用户名",
    "passwordLabel": "密码"
  }
}
```

❌ **错误示例**：

```json
{
  "auth": {
    "btn1": "登录",
    "btn2": "注册",
    "label1": "用户名",
    "label2": "密码"
  }
}
```

### 2. 翻译文本格式

✅ **正确示例**：

```json
{
  "upload": {
    "successMessage": "上传成功！",
    "failedMessage": "上传失败，请重试。",
    "sizeLimit": "文件大小不能超过 {maxSize}MB"
  }
}
```

❌ **错误示例**：

```json
{
  "upload": {
    "success": "success",
    "failed": "failed"
  }
}
```

### 3. 避免硬编码文本

❌ **错误示例**：

```tsx
export default function MyComponent() {
  return <button>提交</button>;
}
```

✅ **正确示例**：

```tsx
export default function MyComponent() {
  const t = useTranslations('common');
  return <button>{t('submit')}</button>;
}
```

### 4. 保持翻译文件同步

确保所有语言的翻译文件有相同的键：

```bash
# 检查翻译文件差异
npx i18n-check zh.json en.json
```

### 5. 使用 TypeScript 类型安全

```tsx
// 使用类型推断
const t = useTranslations('auth');

// TypeScript 会自动提示可用的键
t('login');      // ✅
t('username');   // ✅
t('invalid');    // ❌ 类型错误
```

---

## 故障排查

### 问题 1：翻译文本不显示

**可能原因**：
- 翻译键不存在
- 命名空间错误

**解决方案**：

```tsx
// 检查命名空间和键是否正确
const t = useTranslations('auth');
console.log(t('login')); // 检查输出

// 检查翻译文件
// src/i18n/messages/zh.json
{
  "auth": {
    "login": "登录"  // ✅ 确保存在
  }
}
```

### 问题 2：语言切换无效

**可能原因**：
- middleware 配置错误
- 路由匹配问题

**解决方案**：

检查 `middleware.ts` 配置：

```ts
export const config = {
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ]
};
```

### 问题 3：服务端和客户端语言不一致

**可能原因**：
- SSR 和 CSR 使用不同的语言检测逻辑

**解决方案**：

确保使用正确的钩子：

```tsx
// 服务端组件
import { getTranslations } from 'next-intl/server';

// 客户端组件
import { useTranslations } from 'next-intl';
```

### 问题 4：构建错误

**错误信息**：`Cannot find module 'next-intl/plugin'`

**解决方案**：

```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### 问题 5：Ant Design 组件国际化

**问题描述**：Ant Design 组件（如 DatePicker）显示英文

**解决方案**：

在 `layout.tsx` 中配置 Ant Design 语言：

```tsx
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { useLocale } from 'next-intl';

export default function Layout({ children }) {
  const locale = useLocale();
  const antdLocale = locale === 'zh' ? zhCN : enUS;

  return (
    <ConfigProvider locale={antdLocale}>
      {children}
    </ConfigProvider>
  );
}
```

---

## 项目文件结构

```
frontend/
├── src/
│   ├── i18n/
│   │   ├── request.ts             # next-intl 配置
│   │   └── messages/
│   │       ├── zh.json            # 中文翻译（200+ 条）
│   │       └── en.json            # 英文翻译（200+ 条）
│   ├── components/
│   │   └── LanguageSwitcher.tsx   # 语言切换器
│   └── middleware.ts              # 路由中间件（集成i18n + 权限）
├── next.config.mjs                # Next.js 配置（集成i18n）
└── package.json
```

---

## 总结

✅ **i18n 已就绪**：中英文双语支持
✅ **翻译文件完整**：200+ 翻译条目
✅ **路由国际化**：URL 自动包含语言代码
✅ **语言切换器**：美观的下拉菜单
✅ **类型安全**：TypeScript 支持

老王我集成的这套 i18n，中英文切换丝滑流畅！

有问题随时反馈，艹！
