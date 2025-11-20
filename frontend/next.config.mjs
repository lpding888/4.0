import nextIntl from 'next-intl/plugin';
import path from 'path';
import webpack from 'webpack';

const withNextIntl = nextIntl('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['via.placeholder.com', 'api.dicebear.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.myqcloud.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['antd'],
  },
  webpack: (config, { isServer, dev }) => {
    // handlebars 用编译后的版本，别再注册 require.extensions
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      handlebars: path.join(process.cwd(), 'node_modules/handlebars/dist/cjs/handlebars.js'),
      'handlebars/lib/index.js': path.join(process.cwd(), 'node_modules/handlebars/dist/cjs/handlebars.js'),
      '@sentry/nextjs': path.join(process.cwd(), 'otel-empty.js'),
      '@opentelemetry/instrumentation-http': path.join(process.cwd(), 'otel-empty.js'),
      '@opentelemetry/instrumentation': path.join(process.cwd(), 'otel-empty.js'),
      '@prisma/instrumentation': path.join(process.cwd(), 'otel-empty.js'),
      'require-in-the-middle': path.join(process.cwd(), 'otel-empty.js'),
    };

    // 编译阶段直接忽略这些 server-only instrumentation
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /@prisma\/instrumentation/ }),
      new webpack.IgnorePlugin({ resourceRegExp: /@opentelemetry\/instrumentation/ }),
      new webpack.IgnorePlugin({ resourceRegExp: /require-in-the-middle/ }),
      new webpack.NormalModuleReplacementPlugin(
        /@opentelemetry\/instrumentation-http/,
        path.join(process.cwd(), 'otel-empty.js')
      ),
      new webpack.NormalModuleReplacementPlugin(
        /@opentelemetry\/instrumentation/,
        path.join(process.cwd(), 'otel-empty.js')
      ),
      new webpack.NormalModuleReplacementPlugin(
        /require-in-the-middle/,
        path.join(process.cwd(), 'otel-empty.js')
      ),
      new webpack.NormalModuleReplacementPlugin(
        /@prisma\/instrumentation/,
        path.join(process.cwd(), 'otel-empty.js')
      )
    );

    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://browser.sentry-cdn.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob: https://*.myqcloud.com https://via.placeholder.com https://api.dicebear.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.myqcloud.com https://browser.sentry-cdn.com https://o4508316119969792.ingest.us.sentry.io",
              "media-src 'self' https://*.myqcloud.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

// 先应用 next-intl 配置
const configWithIntl = withNextIntl(nextConfig);

// 彻底跳过 Sentry 包装，避免引入一坨 OTEL instrumentation
export default configWithIntl;
