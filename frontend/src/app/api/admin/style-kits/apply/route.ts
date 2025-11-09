/**
 * Style Kits应用到编辑器API
 * 艹，这个API必须能将样式包完美应用到编辑器，还要支持回滚！
 *
 * @author 老王
 */

import { NextRequest, NextResponse } from 'next/server';

// 模拟应用记录
let applicationHistory: any[] = [
  {
    id: 'app_001',
    kitId: 'kit_001',
    kitName: '经典品牌样式',
    userId: 'user_001',
    appliedAt: '2025-11-01T10:00:00Z',
    componentsApplied: {
      colors: 2,
      fonts: 1,
      watermarks: 1,
      priceTags: 1
    },
    status: 'active'
  }
];

// 回滚记录
let rollbackHistory: any[] = [
  {
    id: 'rollback_001',
    applicationId: 'app_001',
    userId: 'user_001',
    rolledBackAt: '2025-11-02T15:30:00Z',
    reason: '用户主动回滚',
    status: 'completed'
  }
];

// POST - 应用样式包到编辑器
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kitId, userId, targetEditor = 'default' } = body;

    if (!kitId) {
      return NextResponse.json(
        { error: 'Style kit ID is required' },
        { status: 400 }
      );
    }

    console.log(`Applying style kit ${kitId} to editor ${targetEditor} for user ${userId}`);

    // 模拟应用过程
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 模拟应用结果
    const applicationResult = {
      id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      kitId,
      kitName: '经典品牌样式', // 这里应该从数据库查询
      userId: userId || 'anonymous',
      targetEditor,
      appliedAt: new Date().toISOString(),
      componentsApplied: {
        colors: Math.floor(Math.random() * 5) + 1,
        fonts: Math.floor(Math.random() * 3) + 1,
        watermarks: Math.floor(Math.random() * 3) + 1,
        priceTags: Math.floor(Math.random() * 4) + 1
      },
      status: 'active',
      editorState: {
        theme: 'applied',
        lastModified: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    // 保存应用记录
    applicationHistory.push(applicationResult);

    return NextResponse.json({
      success: true,
      data: applicationResult,
      message: 'Style kit applied successfully to editor',
      meta: {
        applicationTime: '1.5s',
        componentsCount: Object.values(applicationResult.componentsApplied).reduce((a, b) => a + b, 0)
      }
    });

  } catch (error) {
    console.error('Failed to apply style kit:', error);
    return NextResponse.json(
      { error: 'Failed to apply style kit to editor' },
      { status: 500 }
    );
  }
}

// GET - 获取应用历史
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const kitId = searchParams.get('kitId');
  const status = searchParams.get('status');

  try {
    let filteredHistory = applicationHistory;

    // 用户过滤
    if (userId) {
      filteredHistory = filteredHistory.filter(app => app.userId === userId);
    }

    // 样式包过滤
    if (kitId) {
      filteredHistory = filteredHistory.filter(app => app.kitId === kitId);
    }

    // 状态过滤
    if (status) {
      filteredHistory = filteredHistory.filter(app => app.status === status);
    }

    return NextResponse.json({
      data: filteredHistory,
      meta: {
        total: filteredHistory.length,
        filters: { userId, kitId, status }
      }
    });

  } catch (error) {
    console.error('Failed to fetch application history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch application history' },
      { status: 500 }
    );
  }
}

// DELETE - 回滚样式包应用
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get('applicationId');
  const userId = searchParams.get('userId');
  const reason = searchParams.get('reason') || '用户主动回滚';

  if (!applicationId) {
    return NextResponse.json(
      { error: 'Application ID is required' },
      { status: 400 }
    );
  }

  try {
    console.log(`Rolling back application ${applicationId} for user ${userId}`);

    // 查找应用记录
    const application = applicationHistory.find(app => app.id === applicationId);
    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      );
    }

    // 模拟回滚过程
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 创建回滚记录
    const rollbackRecord = {
      id: `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      applicationId,
      userId: userId || application.userId,
      rolledBackAt: new Date().toISOString(),
      reason,
      status: 'completed',
      previousState: {
        theme: 'default',
        lastModified: application.appliedAt,
        version: '0.9.0'
      }
    };

    // 保存回滚记录
    rollbackHistory.push(rollbackRecord);

    // 更新应用状态
    const appIndex = applicationHistory.findIndex(app => app.id === applicationId);
    if (appIndex !== -1) {
      applicationHistory[appIndex] = {
        ...applicationHistory[appIndex],
        status: 'rolled_back',
        rolledBackAt: new Date().toISOString()
      };
    }

    return NextResponse.json({
      success: true,
      data: rollbackRecord,
      message: 'Style kit rolled back successfully',
      meta: {
        rollbackTime: '1.0s',
        revertedComponents: application.componentsApplied
      }
    });

  } catch (error) {
    console.error('Failed to rollback style kit:', error);
    return NextResponse.json(
      { error: 'Failed to rollback style kit' },
      { status: 500 }
    );
  }
}
