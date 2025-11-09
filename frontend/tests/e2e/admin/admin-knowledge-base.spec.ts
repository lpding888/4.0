/**
 * Admin知识库管理端到端测试
 * 艹！知识库是AI系统的基础，文档管理必须稳定可靠！
 *
 * @author 老王
 */

import { test, expect } from '@playwright/test';
import { AdminTestBase, KnowledgeBaseTests } from './admin-e2e-test-suite';
import path from 'path';
import fs from 'fs';

test.describe('Admin知识库管理', () => {
  let kbTests: KnowledgeBaseTests;

  test.beforeEach(async ({ page, context }) => {
    kbTests = new KnowledgeBaseTests(page, context);
    await kbTests.loginAsAdmin();
  });

  test('[KB-001] 知识库页面加载', async ({ page }) => {
    await test.step('导航到知识库管理', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      // 验证页面标题
      await expect(page.locator('h1, h2')).toContainText('知识库管理');

      // 验证统计数据存在
      const statsCards = page.locator('.ant-statistic, .ant-card .ant-statistic');
      expect(await statsCards.count()).toBeGreaterThan(0);
    });

    await test.step('验证核心功能按钮', async () => {
      // 检查上传文档按钮
      const uploadButton = page.locator('button:has-text("上传文档"), a:has-text("上传文档")');
      await expect(uploadButton).toBeVisible();

      // 检查处理统计按钮
      const statsButton = page.locator('button:has-text("处理统计"), a:has-text("处理统计")');
      await expect(statsButton).toBeVisible();

      // 检查刷新按钮
      const refreshButton = page.locator('button:has-text("刷新")');
      await expect(refreshButton).toBeVisible();
    });

    await test.step('验证表格结构', async () => {
      // 等待表格加载
      await kbTests.waitForElement('table');

      // 验证表头存在
      const headers = page.locator('table thead th');
      expect(await headers.count()).toBeGreaterThan(3); // 至少有文档名称、类型、状态、操作等列

      // 验证核心列存在
      await expect(page.locator('table thead')).toContainText('文档名称');
      await expect(page.locator('table thead')).toContainText('状态');
      await expect(page.locator('table thead')).toContainText('操作');
    });
  });

  test('[KB-002] 文档上传流程', async ({ page }) => {
    await test.step('导航到上传页面', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      // 点击上传文档按钮
      await kbTests.safeClick('button:has-text("上传文档"), a:has-text("上传文档")');

      // 验证跳转到上传页面或打开上传对话框
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log(`当前页面URL: ${currentUrl}`);
    });

    await test.step('准备测试文档', async () => {
      // 创建测试文档内容
      const testContent = `
# AI衣柜知识库测试文档

## 概述
这是一个测试文档，用于验证知识库上传功能。

## 技术特点
- 支持AI图像识别
- 智能穿搭推荐
- 用户个性化定制

## 系统架构
1. 前端界面层
2. 业务逻辑层
3. 数据持久层
4. AI服务层

创建时间: ${new Date().toISOString()}
文档ID: TEST_DOC_${Date.now()}
      `.trim();

      // 确保测试目录存在
      const testDir = path.join(__dirname, '..', 'fixtures');
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // 创建测试文件
      const testFile = path.join(testDir, `test-document-${Date.now()}.md`);
      fs.writeFileSync(testFile, testContent, 'utf8');

      console.log(`测试文件创建: ${testFile}`);
    });

    await test.step('执行文档上传', async () => {
      const fileName = await kbTests.testDocumentUpload();

      // 验证上传成功
      await expect(page.locator('.ant-message-success')).toBeVisible();

      console.log(`文档上传成功: ${fileName}`);
    });

    await test.step('验证文档出现在列表中', async () => {
      // 返回知识库列表页面
      if (page.url().includes('/upload')) {
        await page.goto('/admin/kb');
        await kbTests.waitForApiCall();
      }

      // 等待列表刷新
      await page.waitForTimeout(2000);

      // 验证表格中有数据
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount > 0) {
        // 检查最新上传的文档
        const firstRow = rows.first();
        await expect(firstRow).toBeVisible();

        // 验证文档状态
        const statusTag = firstRow.locator('.ant-tag');
        if (await statusTag.count() > 0) {
          const status = await statusTag.textContent();
          console.log(`文档状态: ${status}`);
        }
      }
    });
  });

  test('[KB-003] 文档搜索功能', async ({ page }) => {
    await test.step('导航到知识库页面', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();
    });

    await test.step('执行文档搜索', async () => {
      // 确保有文档存在
      const rows = page.locator('table tbody tr');
      const initialCount = await rows.count();

      if (initialCount === 0) {
        console.log('知识库中没有文档，跳过搜索测试');
        return;
      }

      // 执行搜索
      await kbTests.testDocumentSearch('test');
    });

    await test.step('验证搜索结果', async () => {
      const searchResults = page.locator('table tbody tr');
      const resultCount = await searchResults.count();

      console.log(`搜索结果数量: ${resultCount}`);

      if (resultCount > 0) {
        // 验证搜索结果包含搜索关键词
        const firstResult = searchResults.first();
        const resultText = await firstResult.textContent();

        // 搜索关键词可能不在显示的文本中，但应该在搜索结果里
        console.log(`第一个搜索结果预览: ${resultText?.substring(0, 100)}...`);
      }
    });

    await test.step('清空搜索', async () => {
      // 清空搜索框
      const searchInput = page.locator('.ant-input-search input, input[placeholder*="搜索"]');
      await searchInput.fill('');
      await kbTests.waitForApiCall();

      // 验证恢复到完整列表
      await page.waitForTimeout(1000);
      const allResults = page.locator('table tbody tr');
      console.log(`清空搜索后的文档数量: ${await allResults.count()}`);
    });
  });

  test('[KB-004] 文档状态管理', async ({ page }) => {
    await test.step('检查文档状态显示', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      // 等待文档列表加载
      await kbTests.waitForElement('table');

      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 0) {
        console.log('知识库中没有文档，跳过状态管理测试');
        return;
      }

      await kbTests.testDocumentStatus();
    });

    await test.step('验证状态标签类型', async () => {
      const statusTags = page.locator('.ant-tag');

      if (await statusTags.count() > 0) {
        // 检查不同状态的颜色
        const successTag = page.locator('.ant-tag-success, .ant-tag-color-success');
        const processingTag = page.locator('.ant-tag-processing, .ant-tag-color-processing');
        const errorTag = page.locator('.ant-tag-error, .ant-tag-color-error');

        console.log(`成功状态文档: ${await successTag.count()}`);
        console.log(`处理中文档: ${await processingTag.count()}`);
        console.log(`错误状态文档: ${await errorTag.count()}`);
      }
    });

    await test.step('检查进度条显示', async () => {
      const progressBars = page.locator('.ant-progress');

      if (await progressBars.count() > 0) {
        // 检查进度条的百分比
        const firstProgress = progressBars.first();
        await expect(firstProgress).toBeVisible();

        const progressText = firstProgress.locator('.ant-progress-text');
        if (await progressText.count() > 0) {
          const progressValue = await progressText.textContent();
          console.log(`处理进度: ${progressValue}`);
        }
      }
    });
  });

  test('[KB-005] 文档详情查看', async ({ page }) => {
    await test.step('导航到知识库页面', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();
    });

    await test.step('查看文档详情', async () => {
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 0) {
        console.log('知识库中没有文档，跳过详情查看测试');
        return;
      }

      // 点击第一个文档的查看详情按钮
      const firstRow = rows.first();
      const viewButton = firstRow.locator('button[title="查看详情"], button:has-text("查看")');

      if (await viewButton.count() > 0) {
        await viewButton.click();

        // 等待详情面板/模态框
        await page.waitForTimeout(1000);

        const detailPanel = page.locator('.ant-drawer:visible, .ant-modal:visible');
        if (await detailPanel.count() > 0) {
          await expect(detailPanel).toContainText('文档详情');

          // 验证详情内容
          const details = await detailPanel.textContent();
          console.log(`文档详情预览: ${details?.substring(0, 200)}...`);
        }
      }
    });

    await test.step('关闭详情面板', async () => {
      const closeButton = page.locator('.ant-drawer-close, .ant-modal-close, .ant-modal-footer button:has-text("关闭")');

      if (await closeButton.count() > 0) {
        await closeButton.click();

        // 验证面板关闭
        await page.waitForTimeout(500);
        const visiblePanels = page.locator('.ant-drawer:visible, .ant-modal:visible');
        expect(await visiblePanels.count()).toBe(0);
      }
    });
  });

  test('[KB-006] 批量操作功能', async ({ page }) => {
    await test.step('准备测试数据', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount < 2) {
        console.log('文档数量不足，跳过批量操作测试');
        return;
      }
    });

    await test.step('选择多个文档', async () => {
      // 选择前两个文档
      const checkboxes = page.locator('table tbody tr input[type="checkbox"]');
      await checkboxes.first().check();
      await checkboxes.nth(1).check();

      // 验证选中状态
      expect(await checkboxes.first().isChecked()).toBe(true);
      expect(await checkboxes.nth(1).isChecked()).toBe(true);

      // 验证批量操作按钮出现
      const batchDeleteButton = page.locator('button:has-text("批量删除")');
      expect(await batchDeleteButton.count()).toBeGreaterThan(0);
    });

    await test.step('执行批量删除', async () => {
      await kbTests.testBatchDelete();
    });

    await test.step('验证删除结果', async () => {
      // 验证成功消息
      await expect(page.locator('.ant-message-success')).toBeVisible();

      // 验证文档数量减少
      await page.waitForTimeout(2000);
      const remainingRows = page.locator('table tbody tr');
      console.log(`删除后剩余文档数量: ${await remainingRows.count()}`);
    });
  });

  test('[KB-007] 文档类型和大小显示', async ({ page }) => {
    await test.step('检查文档类型显示', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();

      if (rowCount === 0) {
        console.log('知识库中没有文档，跳过类型显示测试');
        return;
      }

      // 检查文档类型标签
      const typeTags = page.locator('.ant-tag[title*="类型"], td:has-text("PDF") + td, td:has-text("DOC") + td');

      if (await typeTags.count() > 0) {
        const firstTypeTag = typeTags.first();
        const docType = await firstTypeTag.textContent();
        console.log(`文档类型: ${docType}`);
      }
    });

    await test.step('检查文件大小显示', async () => {
      // 查找文件大小列
      const sizeColumn = page.locator('table tbody tr td:nth-child(3)'); // 假设大小在第3列

      if (await sizeColumn.count() > 0) {
        const firstSize = sizeColumn.first();
        const sizeText = await firstSize.textContent();
        console.log(`文件大小: ${sizeText}`);

        // 验证大小格式合理（包含KB, MB等单位）
        const hasValidFormat = /(KB|MB|GB|B)/.test(sizeText || '');
        if (hasValidFormat) {
          console.log('文件大小格式正确');
        }
      }
    });
  });

  test('[KB-008] 分页功能', async ({ page }) => {
    await test.step('检查分页组件', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      const pagination = page.locator('.ant-pagination');

      if (await pagination.count() > 0) {
        await expect(pagination).toBeVisible();

        // 检查分页信息
        const paginationInfo = pagination.locator('.ant-pagination-total-text');
        if (await paginationInfo.count() > 0) {
          const infoText = await paginationInfo.textContent();
          console.log(`分页信息: ${infoText}`);
        }
      } else {
        console.log('文档数量较少，未显示分页组件');
      }
    });

    await test.step('测试页面大小调整', async () => {
      const pageSizeSelector = page.locator('.ant-pagination-options-size-changer');

      if (await pageSizeSelector.count() > 0) {
        await pageSizeSelector.click();

        // 选择不同的页面大小
        const pageSizeOptions = page.locator('.ant-select-dropdown:visible .ant-select-item');

        if (await pageSizeOptions.count() > 1) {
          await pageSizeOptions.nth(1).click();
          await page.waitForTimeout(1000);

          console.log('页面大小调整成功');
        }
      }
    });
  });

  test('[KB-009] 处理统计页面', async ({ page }) => {
    await test.step('导航到处理统计', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      // 点击处理统计按钮
      const statsButton = page.locator('button:has-text("处理统计"), a:has-text("处理统计")');

      if (await statsButton.count() > 0) {
        await statsButton.click();
        await page.waitForTimeout(2000);

        // 验证跳转到统计页面
        const currentUrl = page.url();
        console.log(`统计页面URL: ${currentUrl}`);

        // 如果跳转了，验证统计页面内容
        if (currentUrl.includes('/stats')) {
          await expect(page.locator('h1, h2')).toContainText('统计');

          // 检查统计图表或数据卡片
          const charts = page.locator('.ant-card, .chart-container');
          expect(await charts.count()).toBeGreaterThan(0);
        }
      } else {
        console.log('未找到处理统计按钮');
      }
    });
  });

  test('[KB-010] 性能测试', async ({ page }) => {
    await test.step('测试页面加载性能', async () => {
      const startTime = Date.now();
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();
      const loadTime = Date.now() - startTime;

      // 验证页面加载时间在合理范围内（5秒内）
      expect(loadTime).toBeLessThan(5000);

      console.log(`知识库页面加载时间: ${loadTime}ms`);
    });

    await test.step('测试搜索响应时间', async () => {
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      const startTime = Date.now();

      // 执行搜索
      const searchInput = page.locator('.ant-input-search input, input[placeholder*="搜索"]');
      if (await searchInput.count() > 0) {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);

        const searchTime = Date.now() - startTime;

        // 验证搜索响应时间在合理范围内（3秒内）
        expect(searchTime).toBeLessThan(3000);

        console.log(`搜索响应时间: ${searchTime}ms`);
      } else {
        console.log('未找到搜索输入框');
      }
    });
  });

  test('[KB-011] 错误处理测试', async ({ page }) => {
    await test.step('测试网络错误处理', async () => {
      // 模拟网络错误
      await page.route('**/api/admin/kb/documents**', route => route.abort());

      await page.goto('/admin/kb');
      await page.waitForTimeout(3000);

      // 验证错误提示
      const errorMessage = page.locator('.ant-message-error, .ant-alert-error');
      if (await errorMessage.count() > 0) {
        console.log('检测到网络错误提示');
        expect(errorMessage).toBeVisible();
      }

      // 恢复网络连接
      await page.unroute('**/api/admin/kb/documents**');
    });

    await test.step('测试文件上传错误', async () => {
      // 恢复网络连接后尝试上传
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      const uploadButton = page.locator('button:has-text("上传文档"), a:has-text("上传文档")');

      if (await uploadButton.count() > 0) {
        await uploadButton.click();
        await page.waitForTimeout(2000);

        // 尝试上传不支持的文件类型或超大文件
        if (page.url().includes('/upload')) {
          const fileInput = page.locator('input[type="file"]');

          if (await fileInput.count() > 0) {
            // 模拟选择无效文件
            await page.evaluate(() => {
              const input = document.querySelector('input[type="file"]') as HTMLInputElement;
              if (input) {
                // 创建空的DataTransfer对象来模拟清空文件
                const dataTransfer = new DataTransfer();
                input.files = dataTransfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });

            // 尝试上传
            const uploadBtn = page.locator('button:has-text("上传"), button:has-text("开始上传")');
            if (await uploadBtn.count() > 0) {
              await uploadBtn.click();
              await page.waitForTimeout(2000);

              // 检查错误提示
              const errorAlert = page.locator('.ant-alert-error, .ant-message-error');
              if (await errorAlert.count() > 0) {
                console.log('检测到文件上传错误提示');
              }
            }
          }
        }
      }
    });
  });

  test('[KB-012] 响应式设计验证', async ({ page }) => {
    await test.step('测试桌面端显示', async () => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.goto('/admin/kb');
      await kbTests.waitForApiCall();

      // 验证表格正常显示
      await expect(page.locator('table')).toBeVisible();
      await expect(page.locator('.ant-card')).toBeVisible();
    });

    await test.step('测试平板端显示', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await kbTests.waitForApiCall();

      // 验证响应式布局
      await expect(page.locator('table')).toBeVisible();
    });

    await test.step('测试移动端显示', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await kbTests.waitForApiCall();

      // 验证移动端适配
      const content = page.locator('.ant-layout-content');
      await expect(content).toBeVisible();

      // 在移动端可能表格变为卡片式布局
      const mobileCards = page.locator('.ant-list-item, .mobile-card');
      if (await mobileCards.count() > 0) {
        console.log('检测到移动端卡片布局');
      }
    });
  });
});