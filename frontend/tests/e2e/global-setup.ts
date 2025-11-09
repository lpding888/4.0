/**
 * Playwright全局测试设置
 * 艹！这个文件负责测试环境的全局初始化！
 *
 * @author 老王
 */

import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🚀 开始Admin整链IT测试全局设置...');

  const testEnv = process.env.TEST_ENV || 'development';
  console.log(`📝 测试环境: ${testEnv}`);
  console.log(`🌐 基础URL: ${config.projects?.[0]?.use?.baseURL || 'http://localhost:3007'}`);

  // 创建必要的测试目录
  const testDirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces',
    'test-results/fixtures',
    'tests/e2e/fixtures'
  ];

  for (const dir of testDirs) {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 创建测试目录: ${dir}`);
    }
  }

  // 生成测试配置文件
  const testConfig = {
    timestamp: new Date().toISOString(),
    environment: testEnv,
    baseUrl: config.projects?.[0]?.use?.baseURL,
    testSuites: [
      'admin-user-management',
      'admin-pipeline-management',
      'admin-knowledge-base',
      'admin-system-config',
      'admin-integration'
    ],
    credentials: {
      admin: {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123'
      }
    },
    timeouts: {
      default: 30000,
      action: 15000,
      navigation: 30000
    }
  };

  const configPath = path.join(process.cwd(), 'test-results/test-config.json');
  fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
  console.log('⚙️ 测试配置已生成');

  // 如果是开发环境，等待服务器启动
  if (testEnv === 'development') {
    console.log('⏳ 等待开发服务器启动...');
    await waitForDevelopmentServer();
  }

  // 清理之前的测试数据（仅开发环境）
  if (testEnv === 'development' && !process.env.CI) {
    console.log('🧹 清理之前的测试数据...');
    await cleanupTestData();
  }

  // 验证测试环境就绪
  await validateTestEnvironment(config);

  console.log('✅ 全局测试设置完成，准备开始测试...');
}

/**
 * 等待开发服务器启动
 */
async function waitForDevelopmentServer(): Promise<void> {
  const maxWaitTime = 120000; // 2分钟
  const startTime = Date.now();
  const { request } = await import('undici');

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await request('http://localhost:3007/health', {
        method: 'GET',
        headers: { 'User-Agent': 'Playwright-Health-Check' }
      });

      if (response.statusCode === 200) {
        console.log('✅ 开发服务器已就绪');
        return;
      }
    } catch (error) {
      // 服务器还未启动，继续等待
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('❌ 开发服务器启动超时');
}

/**
 * 清理测试数据
 */
async function cleanupTestData(): Promise<void> {
  try {
    // 清理测试截图和视频
    const testResultsDir = path.join(process.cwd(), 'test-results');

    const subdirs = ['screenshots', 'videos', 'traces'];
    for (const subdir of subdirs) {
      const fullPath = path.join(testResultsDir, subdir);
      if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        for (const file of files) {
          if (file.endsWith('.png') || file.endsWith('.webm') || file.endsWith('.zip')) {
            fs.unlinkSync(path.join(fullPath, file));
          }
        }
      }
    }

    console.log('🧹 测试数据清理完成');
  } catch (error) {
    console.warn('⚠️ 清理测试数据时出错:', error);
  }
}

/**
 * 验证测试环境
 */
async function validateTestEnvironment(config: FullConfig): Promise<void> {
  const baseUrl = config.projects?.[0]?.use?.baseURL || 'http://localhost:3007';

  try {
    // 验证基础连接
    const { request } = await import('undici');
    const response = await request(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: { 'User-Agent': 'Playwright-Environment-Check' }
    });

    if (response.statusCode === 200) {
      console.log('✅ API服务连接正常');
    } else {
      console.warn(`⚠️ API服务响应状态: ${response.statusCode}`);
    }
  } catch (error) {
    console.warn('⚠️ 无法连接到API服务，某些测试可能会失败');
  }

  // 验证必要的测试文件
  const requiredFiles = [
    'tests/e2e/admin/admin-e2e-test-suite.ts',
    'tests/e2e/admin/admin-user-management.spec.ts',
    'tests/e2e/admin/admin-pipeline-management.spec.ts',
    'tests/e2e/admin/admin-knowledge-base.spec.ts',
    'tests/e2e/admin/admin-system-config.spec.ts',
    'tests/e2e/admin/admin-integration.spec.ts'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`❌ 缺少必要的测试文件: ${file}`);
    }
  }

  console.log('✅ 测试环境验证通过');
}

export default globalSetup;
