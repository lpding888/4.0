import { withSentryConfig } from '@sentry/nextjs';
import nextIntl from 'next-intl/plugin';

const withNextIntl = nextIntl('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

// 再应用 Sentry 配置
export default withSentryConfig(configWithIntl, {
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
