### 1) 服务器与栈

* **主机**：4c4g（Ubuntu/CentOS），开放 80/443/22
* **运行**：Node 18、PM2（cluster 3 进程）
* **反代**：Nginx（宝塔面板管理）
* **目录建议**：
  ```
  /srv/apps/cms/
    releases/
      2025-10-30-1500/      # 当前发布
      2025-10-28-1100/      # 上一个稳定版本
    shared/
      .env                   # 环境变量（生产）
      logs/
      uploads/
    current -> releases/2025-10-30-1500/
  ```

### 2) PM2 配置（示例）

`deploy/pm2.config.cjs`

```js
module.exports = {
  apps: [
    {
      name: 'cms-api',
      script: 'dist/src/app.js',
      instances: 3,
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production', PORT: 8080 },
      out_file: '../shared/logs/api.out.log',
      error_file: '../shared/logs/api.err.log',
      merge_logs: true,
      max_memory_restart: '500M'
    },
    {
      name: 'cms-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      env: { NODE_ENV: 'production' },
      out_file: '../shared/logs/web.out.log',
      error_file: '../shared/logs/web.err.log'
    }
  ]
};
```

### 3) Nginx 反代（示例）

`deploy/nginx.conf`

```nginx
server {
  listen 80;
  server_name cms.example.com;
  client_max_body_size 50m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 60s;
  }

  location /health {
    proxy_pass http://127.0.0.1:8080/health;
  }
}
```
