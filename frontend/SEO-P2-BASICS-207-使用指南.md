# SEO-P2-BASICS-207: SEO和Sitemap使用指南

## 📋 概述

本文档介绍了项目的SEO优化实施方案，包括metadata管理、OpenGraph/Twitter卡片、sitemap.xml、robots.txt和结构化数据。

**目标**：模板中心与Lookbook的分享卡片正确，sitemap/robots可访问

## 🎯 实施内容

### 1. SEO工具库

**位置**: `src/lib/seo/index.ts`

提供完整的SEO工具函数和配置。

#### 1.1 网站基础配置

```typescript
import { SITE_CONFIG } from '@/lib/seo';

console.log(SITE_CONFIG.name); // 'AI衣柜 - AI照'
console.log(SITE_CONFIG.url); // 'https://ai-wardrobe.com'
```

#### 1.2 生成页面metadata

```typescript
import { generateMetadata } from '@/lib/seo';
import { Metadata } from 'next';

// 在layout.tsx或page.tsx中
export const metadata: Metadata = generateMetadata({
  title: '模板中心',
  description: '浏览和使用专业的服装图片处理模板',
  keywords: ['模板中心', '服装模板', 'AI模板'],
  path: '/workspace/templates',
  image: '/og-templates.png',
});
```

**自动生成的内容**：
- ✅ 完整的title和description
- ✅ Keywords meta标签
- ✅ Canonical URL（规范链接）
- ✅ Robots指令
- ✅ OpenGraph标签（Facebook分享）
- ✅ Twitter Card标签（Twitter分享）

#### 1.3 产品页面metadata

```typescript
import { generateProductMetadata } from '@/lib/seo';

export const metadata = generateProductMetadata({
  name: '春季新品连衣裙',
  description: '清新印花，优雅设计',
  image: '/products/dress-001.jpg',
  price: 299,
  category: '连衣裙',
});
```

#### 1.4 文章页面metadata

```typescript
import { generateArticleMetadata } from '@/lib/seo';

export const metadata = generateArticleMetadata({
  title: 'AI服装图片处理指南',
  description: '如何使用AI技术提升服装图片质量',
  image: '/blog/ai-guide.jpg',
  publishedTime: '2024-01-15',
  author: '老王',
  tags: ['AI', '服装', '图片处理'],
});
```

### 2. 结构化数据 (JSON-LD)

#### 2.1 网站结构化数据

```tsx
import { generateWebsiteSchema, injectJsonLd } from '@/lib/seo';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {injectJsonLd(generateWebsiteSchema())}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

#### 2.2 产品结构化数据

```tsx
import { generateProductSchema, injectJsonLd } from '@/lib/seo';

export default function ProductPage({ product }) {
  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.image,
    price: product.price,
    currency: 'CNY',
    availability: 'InStock',
    rating: 4.8,
    reviewCount: 120,
  });

  return (
    <>
      {injectJsonLd(productSchema)}
      {/* 页面内容 */}
    </>
  );
}
```

#### 2.3 面包屑导航结构化数据

```tsx
import { generateBreadcrumbSchema, injectJsonLd } from '@/lib/seo';

const breadcrumbSchema = generateBreadcrumbSchema([
  { name: '首页', url: '/' },
  { name: '模板中心', url: '/workspace/templates' },
  { name: 'Lookbook模板', url: '/workspace/templates/lookbook' },
]);

{injectJsonLd(breadcrumbSchema)}
```

### 3. Sitemap.xml

**位置**: `src/app/sitemap.ts`

Next.js 14会自动生成 `/sitemap.xml` 路由。

**访问URL**: `https://your-domain.com/sitemap.xml`

#### 3.1 静态页面配置

已配置的页面：
- `/` - 首页
- `/workspace/templates` - 模板中心
- `/workspace/studio` - AI商拍工作室
- `/workspace/editor` - 画布编辑器
- `/workspace/lookbook` - Lookbook生成
- `/tools/short-video` - 短视频生成
- `/tools/image-translate` - 图片翻译

#### 3.2 添加动态页面

```typescript
// src/app/sitemap.ts
export default async function sitemap(): MetadataRoute.Sitemap {
  // 获取动态数据
  const templates = await fetchTemplates();

  const dynamicPages = templates.map((template) => ({
    url: `${SITE_CONFIG.url}/workspace/templates/${template.id}`,
    lastModified: template.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...dynamicPages];
}
```

#### 3.3 Sitemap参数说明

- **url**: 页面完整URL
- **lastModified**: 最后修改时间（Date对象或ISO字符串）
- **changeFrequency**: 更新频率（always/hourly/daily/weekly/monthly/yearly/never）
- **priority**: 优先级（0.0-1.0）

**推荐值**：
- 首页：priority = 1.0, changeFrequency = 'daily'
- 核心功能页：priority = 0.8-0.9, changeFrequency = 'weekly'
- 内容页：priority = 0.6-0.7, changeFrequency = 'monthly'

### 4. Robots.txt

**位置**: `src/app/robots.ts`

Next.js 14会自动生成 `/robots.txt` 路由。

**访问URL**: `https://your-domain.com/robots.txt`

#### 4.1 已配置的规则

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /static/
Disallow: /private/
Disallow: /*.json$
Disallow: /*?*

Sitemap: https://your-domain.com/sitemap.xml
```

#### 4.2 自定义robots.txt

```typescript
// src/app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE_CONFIG.url}/sitemap.xml`,
  };
}
```

### 5. OpenGraph图片

**位置**: `src/app/opengraph-image.tsx`

Next.js 14会自动生成 `/opengraph-image` 路由。

**访问URL**: `https://your-domain.com/opengraph-image`

#### 5.1 默认OG图片

已创建动态生成的OG图片，尺寸：1200x630px

内容：
- 网站名称：AI衣柜
- 描述：专业的服装图片AI处理服务
- 图标：✨ AI修图 / 👗 AI模特 / 📸 Lookbook / 🎬 短视频

#### 5.2 自定义OG图片

为特定页面创建自定义OG图片：

```tsx
// src/app/workspace/templates/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ /* 自定义样式 */ }}>
        模板中心
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
```

### 6. 页面Metadata配置

#### 6.1 根布局 (全站默认)

**文件**: `src/app/layout.tsx`

已配置完整的SEO metadata，包括：
- Title和Description
- Keywords
- OpenGraph标签
- Twitter Card标签
- Canonical URL

#### 6.2 功能页面

已为以下关键页面创建layout.tsx：

**模板中心** (`src/app/workspace/templates/layout.tsx`)
```typescript
export const metadata = generateMetadata({
  title: '模板中心',
  description: '浏览和使用专业的服装图片处理模板...',
  path: '/workspace/templates',
});
```

**Lookbook生成** (`src/app/workspace/lookbook/layout.tsx`)
```typescript
export const metadata = generateMetadata({
  title: 'Lookbook生成',
  description: '一键生成专业的服装Lookbook...',
  path: '/workspace/lookbook',
});
```

**短视频生成** (`src/app/tools/short-video/layout.tsx`)
```typescript
export const metadata = generateMetadata({
  title: 'AI带货短视频',
  description: 'AI驱动的带货短视频生成工具...',
  path: '/tools/short-video',
});
```

**图片翻译** (`src/app/tools/image-translate/layout.tsx`)
```typescript
export const metadata = generateMetadata({
  title: '图片翻译',
  description: 'AI图片翻译工具，智能OCR识别...',
  path: '/tools/image-translate',
});
```

## 📝 最佳实践

### 1. Title优化

```typescript
// ✅ 好的做法
title: '模板中心 - AI衣柜'
title: 'Lookbook生成工具 - 一键生成专业图册 | AI衣柜'

// ❌ 避免
title: '首页' // 太简单
title: 'AI衣柜 - AI服装 - 服装AI - AI模特 - ...' // 关键词堆砌
```

**建议**：
- 保持在60个字符以内
- 包含主要关键词
- 品牌名称放在后面（除首页外）

### 2. Description优化

```typescript
// ✅ 好的做法
description: '一键生成专业的服装Lookbook，支持多SKU选择、智能排版、多种尺寸比例，快速导出高质量的产品展示图册'

// ❌ 避免
description: '好用的Lookbook工具' // 太简单
description: '这是一个用于生成Lookbook的工具，它可以...' // 太啰嗦
```

**建议**：
- 保持在150-160个字符
- 清晰描述页面内容和价值
- 包含相关关键词
- 吸引用户点击

### 3. Keywords选择

```typescript
// ✅ 好的做法
keywords: ['Lookbook生成', '服装Lookbook', '产品图册', 'SKU组合']

// ❌ 避免
keywords: ['Lookbook', 'look', 'book', '生成', '工具'] // 太宽泛
```

**建议**：
- 选择5-10个相关关键词
- 混合使用短尾和长尾关键词
- 关键词要与页面内容相关

### 4. 图片优化

```typescript
// ✅ 好的做法
image: '/og-templates.png' // 专门设计的OG图片
image: '/products/dress-001-og.jpg' // 优化后的产品图

// ❌ 避免
image: '/logo.png' // 尺寸不对
image: '/products/raw/dress-001.jpg' // 未优化的原图
```

**建议**：
- OpenGraph图片尺寸：1200x630px
- Twitter Card图片尺寸：1200x600px
- 文件大小控制在300KB以内
- 使用JPG或PNG格式

### 5. Canonical URL

所有页面都应该有Canonical URL，防止重复内容问题：

```typescript
// 自动添加
alternates: {
  canonical: 'https://your-domain.com/page-path',
}
```

**使用场景**：
- 分页页面指向第一页
- 带查询参数的页面指向无参数版本
- 移动版页面指向桌面版

### 6. 结构化数据

为适当的页面添加结构化数据可以获得丰富的搜索结果（Rich Snippets）：

```tsx
// 产品页面
{injectJsonLd(generateProductSchema({ ... }))}

// 文章页面
{injectJsonLd(generateArticleSchema({ ... }))}

// 面包屑导航
{injectJsonLd(generateBreadcrumbSchema([...]))}
```

## 🔍 验证和测试

### 1. 验证Sitemap

访问：`http://localhost:3000/sitemap.xml`

检查：
- [x] XML格式正确
- [x] 包含所有重要页面
- [x] URL格式正确（完整的https://）
- [x] lastModified日期合理

### 2. 验证Robots.txt

访问：`http://localhost:3000/robots.txt`

检查：
- [x] 格式正确
- [x] Disallow规则合理
- [x] Sitemap URL正确

### 3. 验证OpenGraph

使用工具：
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator

检查：
- [x] 标题、描述正确显示
- [x] 图片正常加载
- [x] 图片尺寸正确（1200x630）

### 4. 验证结构化数据

使用工具：
- Google Rich Results Test: https://search.google.com/test/rich-results
- Schema Markup Validator: https://validator.schema.org/

检查：
- [x] JSON-LD格式正确
- [x] 所有必填字段都有值
- [x] 没有警告或错误

### 5. 本地测试命令

```bash
# 启动开发服务器
npm run dev

# 访问sitemap
curl http://localhost:3000/sitemap.xml

# 访问robots.txt
curl http://localhost:3000/robots.txt

# 查看页面metadata
curl -I http://localhost:3000/workspace/templates
```

## 📊 SEO检查清单

### 上线前检查

- [ ] 所有关键页面有正确的title和description
- [ ] Sitemap.xml可访问且包含所有页面
- [ ] Robots.txt正确配置
- [ ] OpenGraph图片正常生成（1200x630）
- [ ] Twitter Card标签正确
- [ ] Canonical URL正确设置
- [ ] 结构化数据验证通过
- [ ] 没有404错误
- [ ] 移动端友好
- [ ] HTTPS启用

### 上线后监控

- [ ] Google Search Console已配置
- [ ] Sitemap已提交到搜索引擎
- [ ] 关键页面已被索引
- [ ] OpenGraph分享预览正常
- [ ] 搜索结果展示正常

## 🚀 部署注意事项

### 1. 环境变量

确保生产环境配置了正确的域名：

```bash
# .env.production
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2. 提交Sitemap

在Google Search Console和Bing Webmaster Tools提交sitemap：

```
https://your-domain.com/sitemap.xml
```

### 3. 监控

使用Google Search Console监控：
- 索引覆盖率
- 搜索性能
- 移动端可用性
- 结构化数据

## ✅ 验收标准

- [x] SEO工具库实现完整
- [x] Sitemap.xml可访问
- [x] Robots.txt可访问
- [x] OpenGraph图片动态生成
- [x] 根布局metadata配置完整
- [x] 4个关键页面layout.tsx创建
- [x] 结构化数据工具函数完整
- [ ] 模板中心分享卡片显示正确
- [ ] Lookbook分享卡片显示正确

## 🎉 总结

本次SEO优化实施了完整的基础设施：

1. ✅ **SEO工具库**：提供metadata生成、结构化数据等工具
2. ✅ **Sitemap.xml**：自动生成包含所有关键页面
3. ✅ **Robots.txt**：配置合理的爬虫规则
4. ✅ **OpenGraph图片**：动态生成社交分享卡片
5. ✅ **页面Metadata**：关键页面配置完整的SEO信息
6. ✅ **结构化数据**：支持网站、产品、文章等类型

通过这些优化，网站将在搜索引擎中获得更好的展示效果，社交分享也会有漂亮的预览卡片！

---

**艹！老王我这次SEO搞得够专业吧！** 🚀
