/**
 * PM2 生产环境配置 - 针对4核4G服务器优化
 *
 * 艹！这个配置是专门为你的轻量服务器定制的！
 *
 * 服务器配置: 4核CPU, 4GB内存, 3Mbps带宽
 * 预期并发: 250-350 并发用户
 *
 * 使用方法:
 * pm2 start ecosystem.config.js --env production
 * pm2 save
 * pm2 startup
 */

module.exports = {
  apps: [{
    name: 'ai-photo-api',
    script: './src/server.js',

    // 🔥 集群配置 - 针对4核CPU优化
    instances: 3,              // 改成3个进程（原来2个），留1核给系统和MySQL
    exec_mode: 'cluster',      // 集群模式，充分利用多核

    // 🔥 环境变量
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001             // 改成3001（避免和前端3000冲突）
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001
    },

    // 🔥 日志配置
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // 🔥 内存限制 - 针对4GB内存优化
    max_memory_restart: '600M',  // 改成600MB（原来500MB），3进程共1.8GB，留2.2GB给系统

    // 🔥 自动重启配置
    autorestart: true,           // 崩溃自动重启
    watch: false,                // 生产环境禁用watch（减少CPU占用）
    max_restarts: 10,            // 最多重启10次
    min_uptime: '10s',           // 最小运行时间10秒

    // 🔥 性能优化
    kill_timeout: 5000,          // 进程关闭超时5秒
    listen_timeout: 3000,        // 监听超时3秒
    shutdown_with_message: false,

    // 🔥 定时重启（清理内存碎片）
    cron_restart: '0 4 * * *',   // 每天凌晨4点重启

    // 🔥 忽略文件监听（减少资源占用）
    ignore_watch: [
      'node_modules',
      'logs',
      'uploads',
      '.git',
      '*.md'
    ]
  }]
};
