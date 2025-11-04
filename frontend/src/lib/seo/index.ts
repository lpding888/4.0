/**
 * SEO工具库
 * 提供metadata生成、OpenGraph/Twitter卡片、结构化数据等功能
 */

import type { Metadata } from 'next';

/**
 * 网站基础信息
 */
export const SITE_CONFIG = {
  name: 'AI衣柜 - AI照',
  description: '专业的服装图片AI处理服务，提供基础修图、AI模特上身、Lookbook生成、短视频制作等功能',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-wardrobe.com',
  locale: 'zh_CN',
  type: 'website',
  siteName: 'AI衣柜',
  keywords: [
    'AI服装',
    '服装AI处理',
    'AI模特',
    '服装修图',
    'Lookbook生成',
    '短视频制作',
    '图片翻译',
    '服装电商',
    'AI商拍',
  ],
  author: {
    name: 'AI衣柜团队',
    url: 'https://ai-wardrobe.com',
  },
  social: {
    twitter: '@ai_wardrobe',
    facebook: 'aiwardrobe',
  },
};

/**
 * 生成基础metadata
 */
export function generateMetadata(options: {
  title?: string;
  description?: string;
  keywords?: string[];
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const {
    title,
    description = SITE_CONFIG.description,
    keywords = SITE_CONFIG.keywords,
    path = '',
    image = '/og-image.png',
    noIndex = false,
  } = options;

  const fullTitle = title ? `${title} - ${SITE_CONFIG.name}` : SITE_CONFIG.name;
  const url = `${SITE_CONFIG.url}${path}`;
  const imageUrl = image.startsWith('http') ? image : `${SITE_CONFIG.url}${image}`;

  return {
    title: fullTitle,
    description,
    keywords: keywords.join(', '),
    authors: [{ name: SITE_CONFIG.author.name, url: SITE_CONFIG.author.url }],
    creator: SITE_CONFIG.author.name,
    publisher: SITE_CONFIG.author.name,

    // Canonical URL
    alternates: {
      canonical: url,
    },

    // Robots
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    // OpenGraph
    openGraph: {
      type: 'website',
      locale: SITE_CONFIG.locale,
      url,
      title: fullTitle,
      description,
      siteName: SITE_CONFIG.siteName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      site: SITE_CONFIG.social.twitter,
      creator: SITE_CONFIG.social.twitter,
      images: [imageUrl],
    },

    // Other
    category: 'technology',
  };
}

/**
 * 生成产品页面metadata
 */
export function generateProductMetadata(product: {
  name: string;
  description: string;
  image: string;
  price?: number;
  category?: string;
}): Metadata {
  const imageUrl = product.image.startsWith('http')
    ? product.image
    : `${SITE_CONFIG.url}${product.image}`;

  return {
    ...generateMetadata({
      title: product.name,
      description: product.description,
      image: product.image,
    }),
    openGraph: {
      type: 'product',
      locale: SITE_CONFIG.locale,
      url: SITE_CONFIG.url,
      title: product.name,
      description: product.description,
      siteName: SITE_CONFIG.siteName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
    },
  };
}

/**
 * 生成文章页面metadata
 */
export function generateArticleMetadata(article: {
  title: string;
  description: string;
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
}): Metadata {
  const imageUrl = article.image
    ? article.image.startsWith('http')
      ? article.image
      : `${SITE_CONFIG.url}${article.image}`
    : `${SITE_CONFIG.url}/og-image.png`;

  return {
    ...generateMetadata({
      title: article.title,
      description: article.description,
      keywords: article.tags,
      image: article.image,
    }),
    openGraph: {
      type: 'article',
      locale: SITE_CONFIG.locale,
      url: SITE_CONFIG.url,
      title: article.title,
      description: article.description,
      siteName: SITE_CONFIG.siteName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
      publishedTime: article.publishedTime,
      modifiedTime: article.modifiedTime,
      authors: article.author ? [article.author] : [SITE_CONFIG.author.name],
      tags: article.tags,
    },
  };
}

/**
 * 生成JSON-LD结构化数据 - 网站信息
 */
export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.siteName,
    description: SITE_CONFIG.description,
    url: SITE_CONFIG.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_CONFIG.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * 生成JSON-LD结构化数据 - 组织信息
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_CONFIG.siteName,
    description: SITE_CONFIG.description,
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/logo.png`,
    sameAs: [
      `https://twitter.com/${SITE_CONFIG.social.twitter.replace('@', '')}`,
      `https://facebook.com/${SITE_CONFIG.social.facebook}`,
    ],
  };
}

/**
 * 生成JSON-LD结构化数据 - 产品信息
 */
export function generateProductSchema(product: {
  name: string;
  description: string;
  image: string;
  price?: number;
  currency?: string;
  availability?: string;
  rating?: number;
  reviewCount?: number;
}) {
  const imageUrl = product.image.startsWith('http')
    ? product.image
    : `${SITE_CONFIG.url}${product.image}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: imageUrl,
    ...(product.price && {
      offers: {
        '@type': 'Offer',
        price: product.price,
        priceCurrency: product.currency || 'CNY',
        availability: product.availability || 'https://schema.org/InStock',
      },
    }),
    ...(product.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.reviewCount || 0,
      },
    }),
  };
}

/**
 * 生成JSON-LD结构化数据 - 面包屑导航
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_CONFIG.url}${item.url}`,
    })),
  };
}

/**
 * 生成JSON-LD结构化数据 - 文章
 */
export function generateArticleSchema(article: {
  title: string;
  description: string;
  image?: string;
  publishedTime: string;
  modifiedTime?: string;
  author?: string;
}) {
  const imageUrl = article.image
    ? article.image.startsWith('http')
      ? article.image
      : `${SITE_CONFIG.url}${article.image}`
    : `${SITE_CONFIG.url}/og-image.png`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: imageUrl,
    datePublished: article.publishedTime,
    dateModified: article.modifiedTime || article.publishedTime,
    author: {
      '@type': 'Person',
      name: article.author || SITE_CONFIG.author.name,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_CONFIG.siteName,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_CONFIG.url}/logo.png`,
      },
    },
  };
}

/**
 * 注入JSON-LD到页面
 */
export function injectJsonLd(data: Record<string, any>) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * 生成Sitemap URL
 */
export interface SitemapURL {
  url: string;
  lastModified?: Date | string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

/**
 * 生成Sitemap XML
 */
export function generateSitemapXML(urls: SitemapURL[]): string {
  const urlEntries = urls
    .map((entry) => {
      const url = entry.url.startsWith('http') ? entry.url : `${SITE_CONFIG.url}${entry.url}`;
      const lastmod = entry.lastModified
        ? new Date(entry.lastModified).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    ${entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : ''}
    ${entry.priority !== undefined ? `<priority>${entry.priority}</priority>` : ''}
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * 生成robots.txt
 */
export function generateRobotsTxt(options?: {
  disallow?: string[];
  allow?: string[];
  sitemap?: string;
}): string {
  const { disallow = [], allow = [], sitemap = `${SITE_CONFIG.url}/sitemap.xml` } = options || {};

  const disallowEntries = disallow.map((path) => `Disallow: ${path}`).join('\n');
  const allowEntries = allow.map((path) => `Allow: ${path}`).join('\n');

  return `User-agent: *
${allowEntries ? `${allowEntries}\n` : ''}${disallowEntries ? `${disallowEntries}\n` : ''}
Sitemap: ${sitemap}`;
}

/**
 * 导出所有工具
 */
export default {
  SITE_CONFIG,
  generateMetadata,
  generateProductMetadata,
  generateArticleMetadata,
  generateWebsiteSchema,
  generateOrganizationSchema,
  generateProductSchema,
  generateBreadcrumbSchema,
  generateArticleSchema,
  injectJsonLd,
  generateSitemapXML,
  generateRobotsTxt,
};
