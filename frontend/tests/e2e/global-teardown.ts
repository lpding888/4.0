/**
 * Playwright全局测试清理
 * 艹！这个文件负责测试完成后的清理工作！
 *
 * @author 老王
 */

import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 开始清理测试环境...');

  const testEnv = process.env.TEST_ENV || 'development';
  console.log(`📝 测试环境: ${testEnv}`);

  // 生成测试总结报告
  await generateTestSummary(config);

  // 清理临时测试文件
  if (testEnv === 'development') {
    await cleanupTempFiles();
  }

  // 压缩测试结果（可选）
  if (process.env.COMPRESS_RESULTS === 'true') {
    await compressTestResults();
  }

  console.log('✅ 测试环境清理完成');
}

/**
 * 生成测试总结报告
 */
async function generateTestSummary(config: FullConfig): Promise<void> {
  try {
    const testResultsDir = path.join(process.cwd(), 'test-results');

    // 读取测试结果文件
    const resultsFile = path.join(testResultsDir, 'test-results.json');
    let testData = {};

    if (fs.existsSync(resultsFile)) {
      const resultsContent = fs.readFileSync(resultsFile, 'utf8');
      testData = JSON.parse(resultsContent);
    }

    const summary = {
      timestamp: new Date().toISOString(),
      environment: process.env.TEST_ENV || 'development',
      config: {
        baseUrl: config.projects?.[0]?.use?.baseURL,
        timeout: 30000,
        retries: 0
      },
      results: testData,
      summary: {
        totalSuites: 5, // Admin测试套件数量
        completedAt: new Date().toISOString(),
        status: 'COMPLETED'
      },
      files: {
        screenshots: countFiles(testResultsDir, 'screenshots', ['.png']),
        videos: countFiles(testResultsDir, 'videos', ['.webm']),
        traces: countFiles(testResultsDir, 'traces', ['.zip'])
      }
    };

    const summaryPath = path.join(testResultsDir, 'test-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log('📊 测试总结报告已生成');
    console.log(`📁 测试结果保存在: ${testResultsDir}`);
  } catch (error) {
    console.warn('⚠️ 生成测试总结时出错:', error);
  }
}

/**
 * 统计文件数量
 */
function countFiles(baseDir: string, subDir: string, extensions: string[]): number {
  const fullPath = path.join(baseDir, subDir);
  if (!fs.existsSync(fullPath)) {
    return 0;
  }

  let count = 0;
  const files = fs.readdirSync(fullPath);

  for (const file of files) {
    const filePath = path.join(fullPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile()) {
      const ext = path.extname(file).toLowerCase();
      if (extensions.includes(ext)) {
        count++;
      }
    }
  }

  return count;
}

/**
 * 清理临时测试文件
 */
async function cleanupTempFiles(): Promise<void> {
  try {
    const testResultsDir = path.join(process.cwd(), 'test-results');
    const tempPatterns = [
      /\.tmp$/,
      /\.temp$/,
      /^test-.*-\d+\.png$/,
      /^trace-.*\.zip$/
    ];

    const cleanupDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isFile()) {
          const shouldDelete = tempPatterns.some(pattern => pattern.test(file));
          if (shouldDelete) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ 删除临时文件: ${file}`);
          }
        } else if (stat.isDirectory()) {
          cleanupDir(filePath);
        }
      }
    };

    // 清理各种子目录
    ['screenshots', 'videos', 'traces'].forEach(subDir => {
      const fullPath = path.join(testResultsDir, subDir);
      cleanupDir(fullPath);
    });

    console.log('🧹 临时文件清理完成');
  } catch (error) {
    console.warn('⚠️ 清理临时文件时出错:', error);
  }
}

/**
 * 压缩测试结果
 */
async function compressTestResults(): Promise<void> {
  try {
    const { execSync } = require('child_process');
    const testResultsDir = path.join(process.cwd(), 'test-results');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `admin-test-results-${timestamp}.tar.gz`;

    // 创建压缩包
    execSync(`tar -czf "${archiveName}" -C "test-results" .`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    console.log(`📦 测试结果已压缩为: ${archiveName}`);
  } catch (error) {
    console.warn('⚠️ 压缩测试结果时出错:', error);
  }
}

export default globalTeardown;
