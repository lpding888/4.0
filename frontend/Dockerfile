# ================================
# AI照前端 - 生产环境Dockerfile
# ================================
# 艹！Next.js 14多阶段构建，极致优化

# ========== 依赖安装阶段 ==========
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 艹！只复制package文件，利用缓存层
COPY package*.json ./
RUN npm ci --only=production

# ========== 构建阶段 ==========
FROM node:18-alpine AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 艹！Next.js构建
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# ========== 生产运行阶段 ==========
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 艹！创建非root用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 艹！只复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

ENV PORT 3001
ENV HOSTNAME "0.0.0.0"

# 艹！启动Next.js
CMD ["node", "server.js"]
