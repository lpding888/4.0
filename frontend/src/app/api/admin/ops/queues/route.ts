/**
 * 队列监控API
 * 艹，这个API必须提供实时队列状态，支持重试和清理操作！
 *
 * @author 老王
 */

import { NextRequest, NextResponse } from 'next/server';

type QueueStatus = {
  id: string;
  name: string;
  type: string;
  count: number;
  isActive: boolean;
  concurrency: number;
  processed: number;
  failed: number;
  avgProcessingTime: number;
  lastActivity: string;
};

// 模拟队列数据
let mockQueues: QueueStatus[] = [
  {
    id: 'queue_001',
    name: 'ai-generation',
    type: 'processing',
    count: 15,
    isActive: true,
    concurrency: 5,
    processed: 1250,
    failed: 23,
    avgProcessingTime: 8.5,
    lastActivity: new Date().toISOString()
  },
  {
    id: 'queue_002',
    name: 'image-processing',
    type: 'waiting',
    count: 32,
    isActive: true,
    concurrency: 3,
    processed: 890,
    failed: 12,
    avgProcessingTime: 12.3,
    lastActivity: new Date().toISOString()
  },
  {
    id: 'queue_003',
    name: 'batch-upload',
    type: 'completed',
    count: 0,
    isActive: false,
    concurrency: 2,
    processed: 456,
    failed: 5,
    avgProcessingTime: 6.7,
    lastActivity: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: 'queue_004',
    name: 'notification',
    type: 'failed',
    count: 8,
    isActive: true,
    concurrency: 10,
    processed: 2340,
    failed: 156,
    avgProcessingTime: 2.1,
    lastActivity: new Date().toISOString()
  }
];

// 模拟任务数据
let mockTasks: any[] = [
  {
    id: 'task_001',
    name: 'AI商品图生成',
    type: 'ai-generation',
    status: 'active',
    progress: 65,
    data: { tool: 'product-shoot', parameters: { count: 4, style: 'natural' } },
    attempts: 1,
    maxAttempts: 3,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    priority: 1,
    processingTime: 45000
  },
  {
    id: 'task_002',
    name: '服装换色处理',
    type: 'image-processing',
    status: 'failed',
    progress: 100,
    data: { tool: 'recolor', color: '#FF0000' },
    attempts: 3,
    maxAttempts: 3,
    createdAt: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    failedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    errorMessage: 'Color transformation failed: Invalid color format',
    processingTime: 72000,
    priority: 2
  },
  {
    id: 'task_003',
    name: '批量图片上传',
    type: 'batch-upload',
    status: 'completed',
    progress: 100,
    data: { files: 25, target: 'cos-bucket' },
    attempts: 1,
    maxAttempts: 3,
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 54 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    processingTime: 240000,
    priority: 3
  },
  {
    id: 'task_004',
    name: '邮件通知发送',
    type: 'notification',
    status: 'waiting',
    progress: 0,
    data: { recipients: 150, template: 'task-completed' },
    attempts: 0,
    maxAttempts: 5,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    priority: 1,
    delay: 5000
  }
];

// 模拟操作日志
let operationLogs: any[] = [
  {
    id: 'log_001',
    operation: 'QUEUE_TOGGLE',
    target: 'queue_001',
    targetName: 'ai-generation',
    operator: 'admin',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    details: '队列已启动',
    status: 'success'
  },
  {
    id: 'log_002',
    operation: 'TASK_RETRY',
    target: 'task_002',
    targetName: '服装换色处理',
    operator: 'admin',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    details: '任务已重新加入队列',
    status: 'success'
  }
];

// GET - 获取队列状态
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'queues' | 'tasks' | 'stats' | 'logs'

  try {
    switch (type) {
      case 'queues':
        return NextResponse.json({
          data: mockQueues,
          meta: {
            total: mockQueues.length,
            active: mockQueues.filter(q => q.isActive).length,
            timestamp: new Date().toISOString()
          }
        });

      case 'tasks':
        const queueFilter = searchParams.get('queue');
        const statusFilter = searchParams.get('status');

        let filteredTasks = mockTasks;

        if (queueFilter) {
          filteredTasks = filteredTasks.filter(task => task.type === queueFilter);
        }

        if (statusFilter) {
          filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
        }

        return NextResponse.json({
          data: filteredTasks,
          meta: {
            total: filteredTasks.length,
            filters: { queue: queueFilter, status: statusFilter }
          }
        });

      case 'stats':
        const totalQueues = mockQueues.length;
        const activeQueues = mockQueues.filter(q => q.isActive).length;
        const totalTasks = mockTasks.length;
        const processingTasks = mockTasks.filter(t => t.status === 'active').length;
        const waitingTasks = mockTasks.filter(t => t.status === 'waiting').length;
        const completedTasks = mockTasks.filter(t => t.status === 'completed').length;
        const failedTasks = mockTasks.filter(t => t.status === 'failed').length;

        const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const avgProcessingTime = mockTasks
          .filter(t => t.processingTime)
          .reduce((sum, task) => sum + (task.processingTime || 0), 0) /
          Math.max(completedTasks, 1);

        const stats = {
          queues: {
            total: totalQueues,
            active: activeQueues,
            inactive: totalQueues - activeQueues
          },
          tasks: {
            total: totalTasks,
            processing: processingTasks,
            waiting: waitingTasks,
            completed: completedTasks,
            failed: failedTasks
          },
          performance: {
            successRate: Math.round(successRate * 100) / 100,
            avgProcessingTime: Math.round((avgProcessingTime / 1000) * 100) / 100,
            throughput: Math.round((completedTasks / 60) * 100) / 100
          },
          timestamp: new Date().toISOString()
        };

        return NextResponse.json({
          data: stats
        });

      case 'logs':
        const limit = parseInt(searchParams.get('limit') || '50');
        const operationFilter = searchParams.get('operation');

        let filteredLogs = operationLogs;

        if (operationFilter) {
          filteredLogs = filteredLogs.filter(log => log.operation === operationFilter);
        }

        return NextResponse.json({
          data: filteredLogs.slice(0, limit),
          meta: {
            total: filteredLogs.length,
            limit
          }
        });

      default:
        // 返回所有数据
        return NextResponse.json({
          queues: mockQueues,
          tasks: mockTasks,
          logs: operationLogs.slice(0, 20),
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('Failed to fetch queue data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue data' },
      { status: 500 }
    );
  }
}

// POST - 执行队列操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, target, params } = body;

    switch (operation) {
      case 'TOGGLE_QUEUE':
        const queueIndex = mockQueues.findIndex(q => q.id === target);
        if (queueIndex === -1) {
          return NextResponse.json(
            { error: 'Queue not found' },
            { status: 404 }
          );
        }

        const queue = mockQueues[queueIndex]!;
        mockQueues[queueIndex] = {
          ...queue,
          isActive: !queue.isActive,
          lastActivity: new Date().toISOString()
        };

        // 添加操作日志
        operationLogs.unshift({
          id: `log_${Date.now()}`,
          operation: 'QUEUE_TOGGLE',
          target,
          targetName: queue.name,
          operator: 'admin',
          timestamp: new Date().toISOString(),
          details: `队列已${mockQueues[queueIndex].isActive ? '启动' : '暂停'}`,
          status: 'success'
        });

        return NextResponse.json({
          success: true,
          message: `Queue ${mockQueues[queueIndex].name} ${mockQueues[queueIndex].isActive ? 'started' : 'stopped'}`,
          data: mockQueues[queueIndex]
        });

      case 'RETRY_TASK':
        const taskIndex = mockTasks.findIndex(t => t.id === target);
        if (taskIndex === -1) {
          return NextResponse.json(
            { error: 'Task not found' },
            { status: 404 }
          );
        }

        mockTasks[taskIndex] = {
          ...mockTasks[taskIndex],
          status: 'waiting',
          attempts: 0,
          errorMessage: undefined,
          failedAt: undefined,
          progress: 0
        };

        // 添加操作日志
        operationLogs.unshift({
          id: `log_${Date.now()}`,
          operation: 'TASK_RETRY',
          target,
          targetName: mockTasks[taskIndex].name,
          operator: 'admin',
          timestamp: new Date().toISOString(),
          details: '任务已重新加入队列',
          status: 'success'
        });

        return NextResponse.json({
          success: true,
          message: 'Task has been retried',
          data: mockTasks[taskIndex]
        });

      case 'BULK_RETRY':
        const failedTasks = mockTasks.filter(t => t.status === 'failed');
        const retriedTasks = failedTasks.map(task => {
          const taskIndex = mockTasks.findIndex(t => t.id === task.id);
          if (taskIndex !== -1) {
            mockTasks[taskIndex] = {
              ...mockTasks[taskIndex],
              status: 'waiting',
              attempts: 0,
              errorMessage: undefined,
              failedAt: undefined,
              progress: 0
            };
          }
          return mockTasks[taskIndex];
        });

        // 添加操作日志
        operationLogs.unshift({
          id: `log_${Date.now()}`,
          operation: 'BULK_RETRY',
          target: 'multiple',
          targetName: `${retriedTasks.length}个失败任务`,
          operator: 'admin',
          timestamp: new Date().toISOString(),
          details: `批量重试了${retriedTasks.length}个失败任务`,
          status: 'success'
        });

        return NextResponse.json({
          success: true,
          message: `Retried ${retriedTasks.length} failed tasks`,
          data: { retriedCount: retriedTasks.length }
        });

      case 'CLEAR_QUEUE':
        const clearQueueIndex = mockQueues.findIndex(q => q.id === target);
        if (clearQueueIndex === -1) {
          return NextResponse.json(
            { error: 'Queue not found' },
            { status: 404 }
          );
        }

        const queueToClear = mockQueues[clearQueueIndex];
        if (!queueToClear) {
          return NextResponse.json(
            { error: 'Queue not found' },
            { status: 404 }
          );
        }

        const queueName = queueToClear.name;
        const initialCount = mockTasks.length;

        // 移除等待中的任务
        mockTasks = mockTasks.filter(task => task.type !== queueName || task.status !== 'waiting');

        const clearedCount = initialCount - mockTasks.length;

        // 添加操作日志
        operationLogs.unshift({
          id: `log_${Date.now()}`,
          operation: 'CLEAR_QUEUE',
          target,
          targetName: queueName,
          operator: 'admin',
          timestamp: new Date().toISOString(),
          details: `清理了${clearedCount}个等待中的任务`,
          status: 'success'
        });

        return NextResponse.json({
          success: true,
          message: `Cleared ${clearedCount} waiting tasks from queue ${queueName}`,
          data: { clearedCount }
        });

      default:
        return NextResponse.json(
          { error: 'Unknown operation' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Failed to execute queue operation:', error);
    return NextResponse.json(
      { error: 'Failed to execute queue operation' },
      { status: 500 }
    );
  }
}

// DELETE - 删除任务
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'Task ID is required' },
      { status: 400 }
    );
  }

  try {
    const taskIndex = mockTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    const deletedTask = mockTasks[taskIndex];
    mockTasks.splice(taskIndex, 1);

    // 添加操作日志
    operationLogs.unshift({
      id: `log_${Date.now()}`,
      operation: 'DELETE_TASK',
      target: taskId,
      targetName: deletedTask.name,
      operator: 'admin',
      timestamp: new Date().toISOString(),
      details: '任务已删除',
      status: 'success'
    });

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
      data: deletedTask
    });

  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
