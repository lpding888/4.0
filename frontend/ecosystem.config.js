// 老王我给你写的PM2配置文件，宝塔部署用这个

module.exports = {
  apps: [{
    name: 'ai-photo-frontend',
    script: 'npm',
    args: 'start',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/ai-photo-frontend-error.log',
    out_file: './logs/ai-photo-frontend-out.log',
    log_file: './logs/ai-photo-frontend.log',
    time: true,
    // 老王我加上这些优化配置
    node_args: '--max-old-space-size=1024',
    kill_timeout: 5000,
    listen_timeout: 3000,
    restart_delay: 4000
  }]
};