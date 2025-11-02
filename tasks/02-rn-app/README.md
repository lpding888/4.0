# 📱 React Native App 任务卡说明

## 任务卡文件清单

### 01-base-architecture.json（5个任务，36小时）
- MOBILE-RN-001: RN脚手架搭建 + TypeScript配置（8h）
- MOBILE-RN-002: 复用配置驱动runtime（10h）
- MOBILE-RN-003: React Navigation集成（8h）
- MOBILE-RN-004: CodePush热更新配置（6h）
- MOBILE-RN-005: MMKV持久化存储（4h）

### 02-features-replication.json（11个任务，74小时）
- MOBILE-RN-006: 衣橱功能复刻（12h）
- MOBILE-RN-007: 商业功能复刻（12h）
- MOBILE-RN-008: 导航与TabBar（6h）
- MOBILE-RN-009: 状态管理集成（Zustand）（8h）
- MOBILE-RN-010: 相机集成（react-native-camera）（8h）
- MOBILE-RN-011: 推送集成（腾讯云移动推送）（8h）
- MOBILE-RN-012: 分享功能（微信/QQ/微博）（6h）
- MOBILE-RN-013: 支付集成（微信/支付宝）（6h）
- MOBILE-RN-014: 地图集成（腾讯地图）（4h）
- MOBILE-RN-015: iOS打包配置（2h）
- MOBILE-RN-016: Android打包配置（2h）

## 核心策略

**代码复用率目标：70%**

1. **完全复用（100%）**
   - TypeScript类型定义
   - 业务逻辑（纯函数）
   - API请求封装
   - 状态管理逻辑

2. **部分复用（50%）**
   - 组件结构（需要替换为RN组件）
   - 样式逻辑（需要使用StyleSheet）
   - 导航逻辑（React Navigation vs Taro路由）

3. **无法复用（0%）**
   - UI组件（Taro组件 vs React Native组件）
   - 原生能力（相机、推送、支付等）
   - 平台特定配置（CodePush、打包配置）

## 技术栈

- **React Native**: 0.72+
- **TypeScript**: 5.0+
- **React Navigation**: 6.x
- **Zustand**: 4.x（状态管理）
- **MMKV**: 2.x（持久化）
- **CodePush**: 8.x（热更新）
- **react-native-camera**: 4.x（相机）
- **腾讯云移动推送SDK**（推送）
- **react-native-wechat-lib**（微信SDK）

## 参考文档

- GPT-5方案：`../docs/GPT5-Pro战略问题集/回答/app前端设计方案.md`（第6节 RN架构）
- 小程序任务卡：`../01-miniprogram/`（复刻参考）
- 共享类型定义：`../00-shared-types/`

---

**文档版本：** v1.0
**生成时间：** 2025-11-01
**维护者：** AI老王（Product Planner）
