# syntax=docker/dockerfile:1

FROM node:20.11-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20.11-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20.11-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S api && adduser -S api -G api
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm ci --omit dev && npm cache clean --force
USER api
EXPOSE 3000
CMD ["node", "dist/server.js"]
