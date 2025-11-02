/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 艹！生产环境移除console.log，但保留error和warn（安全日志必须留着）
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // 保留console.error和console.warn
    } : false,
  },
  images: {
    domains: [
      'ai-photo-prod-1379020062.picgz.myqcloud.com',
      'ai-photo-prod-1379020062.cos.ap-guangzhou.myqcloud.com'
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL + '/:path*'
      }
    ];
  },
  // 老王我平衡配置 - 兼容本地Windows开发和服务器部署
  webpack: (config, { isServer, dev }) => {
    // 修复 antd 的 SSR 问题（跨平台兼容）
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        // 修复 Windows/Linux 依赖兼容性
        'copy-to-clipboard': require.resolve('copy-to-clipboard'),
        'resize-observer-polyfill': require.resolve('resize-observer-polyfill'),
      };
    }

    // 生产环境优化（服务器和本地通用）
    if (!dev && !isServer) {
      // 启用更好的tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    // Windows平台优化
    if (process.platform === 'win32') {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: /node_modules/,
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    return config;
  },
  // 跨平台部署优化配置
  experimental: {
    esmExternals: 'loose',
    serverComponentsExternalPackages: ['antd', '@ant-design/icons'],
    swcMinify: true,
  },
  // 生产环境优化
  poweredByHeader: false,
  compress: true,
};

module.exports = nextConfig;
