# ================================
# AI照后端 - 生产环境Dockerfile
# ================================
# 艹！多阶段构建，减小镜像体积，提高安全性
#
# 使用方法:
# docker build -t ai-photo-backend:latest .
# docker run -p 3001:3001 --env-file .env ai-photo-backend:latest

# ========== 构建阶段 ==========
FROM node:18-alpine AS builder

# 艹！设置工作目录
WORKDIR /app

# 艹！只复制package文件，利用Docker缓存层
COPY package*.json ./

# 艹！安装生产依赖（跳过devDependencies）
RUN npm ci --only=production && \
    npm cache clean --force

# 艹！复制源代码
COPY . .

# ========== 生产阶段 ==========
FROM node:18-alpine

# 艹！安全加固：创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 艹！设置工作目录
WORKDIR /app

# 艹！从构建阶段复制node_modules和源代码
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# 艹！创建logs目录（运行时需要写入）
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# 艹！切换到非root用户
USER nodejs

# 艹！暴露端口
EXPOSE 3001

# 艹！健康检查（每30秒检查一次）
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# 艹！启动命令
CMD ["node", "src/server.js"]
