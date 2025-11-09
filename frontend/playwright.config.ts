/**
 * Playwright配置文件
 * 艹！这个配置必须支持所有Admin端到端测试场景！
 *
 * @author 老王
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * 测试环境配置
 */
const testEnvironments = {
  development: {
    baseURL: 'http://localhost:3007',
    timeout: 30000,
    retries: 1
  },
  staging: {
    baseURL: 'https://staging.aidrobe.com',
    timeout: 45000,
    retries: 2
  },
  production: {
    baseURL: 'https://app.aidrobe.com',
    timeout: 60000,
    retries: 0
  }
};

// 获取当前测试环境
const testEnv = process.env.TEST_ENV || 'development';
const envConfig = testEnvironments[testEnv as keyof typeof testEnvironments];

export default defineConfig({
  // 测试目录
  testDir: './tests/e2e',

  // 全局超时设置
  timeout: envConfig.timeout,
  expect: {
    timeout: 10000
  },

  // 测试重试配置
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: envConfig.retries,
  workers: process.env.CI ? 1 : undefined,

  // 测试报告配置
  reporter: [
    ['html', {
      outputFolder: 'test-results/html-report',
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    ['json', {
      outputFile: 'test-results/test-results.json'
    }],
    ['junit', {
      outputFile: 'test-results/junit-results.xml'
    }],
    ['line'], // 控制台输出
    ['list'] // 测试列表
  ],

  // 全局设置
  use: {
    // 基础URL
    baseURL: envConfig.baseURL,

    // 浏览器配置
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // 用户代理
    userAgent: 'Admin-E2E-Test-Playwright/1.0.0',

    // 忽略HTTPS错误（仅用于开发环境）
    ignoreHTTPSErrors: testEnv === 'development',

    // 视口配置
    viewport: { width: 1280, height: 720 },

    // 行为配置
    actionTimeout: 15000,
    navigationTimeout: 30000
  },

  // 项目配置 - 支持多浏览器测试
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/admin/**/*.spec.ts'
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: '**/admin/**/*.spec.ts'
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/admin/**/*.spec.ts'
    },

    // 移动端测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/admin/mobile-*.spec.ts'
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/admin/mobile-*.spec.ts'
    },

    // 平板端测试
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
      testMatch: '**/admin/tablet-*.spec.ts'
    }
  ],

  // 测试文件匹配模式
  testMatch: [
    '**/admin/**/*.spec.ts',
    '**/integration/**/*.spec.ts'
  ],

  // 忽略的测试文件
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**'
  ],

  // 输出目录
  outputDir: 'test-results/',

  // 全局设置文件
  globalSetup: path.join(__dirname, 'tests/e2e/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'tests/e2e/global-teardown.ts'),

  // Web服务器配置（用于开发环境）
  webServer: testEnv === 'development' ? {
    command: 'npm run dev',
    url: 'http://localhost:3007',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2分钟启动超时
    stdout: 'pipe',
    stderr: 'pipe'
  } : undefined
});
