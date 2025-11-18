# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 安装 netcat 用于健康检查
RUN apk add --no-cache netcat-openbsd

RUN addgroup -S api && adduser -S api -G api

# 只安装生产依赖，不包含 devDependencies（如 tsx/esbuild）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/db/migrations ./src/db/migrations
COPY knexfile.js ./
COPY docker-entrypoint.sh ./

# 创建必要的目录并设置权限
RUN mkdir -p uploads logs cache && \
    chmod +x docker-entrypoint.sh && \
    chown -R api:api /app

USER api
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
