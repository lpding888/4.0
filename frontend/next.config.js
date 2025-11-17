const fs = require('fs');
const path = require('path');

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');
const isTestEnv = process.env.NODE_ENV === 'test';

/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

function buildAntdModularizeMap() {
  try {
    const componentsDir = path.join(__dirname, 'node_modules/antd/es');
    const entries = fs.readdirSync(componentsDir, { withFileTypes: true });
    return entries.reduce((acc, entry) => {
      if (!entry.isDirectory()) {
        return acc;
      }
      const segments = entry.name.split('-').filter(Boolean);
      if (segments.length === 0) {
        return acc;
      }
      const pascalName = segments
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join('');
      if (!pascalName) {
        return acc;
      }
      const camelName = pascalName.charAt(0).toLowerCase() + pascalName.slice(1);
      const target = `antd/es/${entry.name}`;
      acc[pascalName] = target;
      acc[camelName] = target;
      return acc;
    }, {});
  } catch (error) {
    console.warn('[NextConfig] 构建AntD modularize映射失败:', error);
    return {};
  }
}

const antdModularizeMap = isTestEnv ? {} : buildAntdModularizeMap();

const nextConfig = {
  reactStrictMode: true,
  // 艹!生产环境移除console.log,但保留error和warn(安全日志必须留着)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // 保留console.error和console.warn
    } : false,
  },
  // 艹!Ant Design按需加载,tree-shaking优化
  modularizeImports: {
    ...(isTestEnv
      ? {}
      : {
          antd: {
            transform: antdModularizeMap,
            skipDefaultConversion: true,
          },
        }),
    '@ant-design/icons': {
      transform: '@ant-design/icons/{{member}}',
    },
  },
  // 艹!P2-SSR-204任务:输出模式优化(静态导出&SSG)
  output: 'standalone', // Docker部署和无服务器环境必备
  // 艹!静态页面生成配置(模板中心等高访问页启用ISR)
  images: {
    domains: [
      'ai-photo-prod-1379020062.picgz.myqcloud.com',
      'ai-photo-prod-1379020062.cos.ap-guangzhou.myqcloud.com',
      // 艹!支持外部占位图服务(开发环境用)
      'via.placeholder.com',
      'api.dicebear.com',
    ],
    // 艹!P2-SSR-204:图片优化配置
    formats: ['image/avif', 'image/webp'], // 现代格式优先
    minimumCacheTTL: 60, // 最小缓存1分钟
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840], // 设备尺寸
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // 图标尺寸
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BASE}/:path*`
      }
    ];
  },
  // 老王我平衡配置 - 兼容本地Windows开发和服务器部署
  webpack: (config, { isServer, dev }) => {
    // 修复 antd 的 SSR 问题(跨平台兼容)
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

    // 生产环境优化(服务器和本地通用)
    if (!dev && !isServer) {
      // 启用更好的tree shaking
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;

      // 艹!P2-SSR-204:分包策略优化
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          // 艹!重型依赖单独打包(Monaco/Formio/XYFlow)
          monaco: {
            test: /[\\/]node_modules[\\/](@monaco-editor)[\\/]/,
            name: 'monaco-editor',
            priority: 30,
            reuseExistingChunk: true,
          },
          formio: {
            test: /[\\/]node_modules[\\/](formiojs)[\\/]/,
            name: 'formio',
            priority: 30,
            reuseExistingChunk: true,
          },
          xyflow: {
            test: /[\\/]node_modules[\\/](@xyflow)[\\/]/,
            name: 'xyflow',
            priority: 30,
            reuseExistingChunk: true,
          },
          // 艹!Ant Design组件单独打包
          antd: {
            test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
            name: 'antd',
            priority: 20,
            reuseExistingChunk: true,
          },
          // 艹!其他vendor库合并
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };
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
    swcMinify: true,
    // 艹!P2-SSR-204:优化并发渲染
    optimizeCss: true,
  },
  // 生产环境优化
  poweredByHeader: false,
  compress: true,
  // 艹!P2-SSR-204:优化产物体积
  productionBrowserSourceMaps: false, // 生产环境不生成source map节省体积
};

module.exports = withBundleAnalyzer(nextConfig);
