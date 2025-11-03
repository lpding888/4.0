/**
 * PAGE-P1-STUDIO-101 任务进度SSE流
 * 艹，这个SSE流必须稳定可靠，支持实时进度推送、错误处理、自动断线！
 *
 * @author 老王
 */

import { NextRequest } from 'next/server';

// 模拟任务存储（与tasks/route.ts共享）
declare global {
  var tasks: Map<string, any> | undefined;
}

// 初始化任务存储
if (!global.tasks) {
  global.tasks = new Map();
}
const tasks = global.tasks;

// SSE响应
export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;

  // 检查任务是否存在
  const task = tasks.get(taskId);
  if (!task) {
    return new Response('Task not found', { status: 404 });
  }

  console.log(`SSE connection established for task: ${taskId}`);

  // 创建SSE流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // 发送初始连接消息
      const initEvent = {
        type: 'status',
        data: {
          taskId,
          status: task.status,
          message: 'SSE连接已建立'
        },
        timestamp: Date.now()
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`));

      // 监控任务进度变化
      let lastProgress = -1;
      let lastStatus = '';
      let intervalId: NodeJS.Timeout;

      const checkProgress = () => {
        const currentTask = tasks.get(taskId);
        if (!currentTask) {
          controller.close();
          return;
        }

        // 检查进度变化
        if (currentTask.progress !== lastProgress) {
          lastProgress = currentTask.progress;

          const progressEvent = {
            type: 'progress',
            data: {
              taskId,
              progress: currentTask.progress,
              message: currentTask.message,
              currentStep: Math.floor(currentTask.progress / 20) + 1,
              totalSteps: 5,
              estimatedTime: Math.max(0, (100 - currentTask.progress) * 100) // 剩余时间估算(ms)
            },
            timestamp: Date.now()
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressEvent)}\n\n`));
        }

        // 检查状态变化
        if (currentTask.status !== lastStatus) {
          lastStatus = currentTask.status;

          const statusEvent = {
            type: 'status',
            data: {
              taskId,
              status: currentTask.status,
              message: currentTask.message,
              error: currentTask.error
            },
            timestamp: Date.now()
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusEvent)}\n\n`));

          // 如果任务完成或失败，发送完成事件并关闭连接
          if (currentTask.status === 'completed') {
            const completeEvent = {
              type: 'complete',
              data: {
                taskId,
                result: currentTask.result,
                completedAt: currentTask.completedAt
              },
              timestamp: Date.now()
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeEvent)}\n\n`));

            // 短暂延迟后关闭连接
            setTimeout(() => {
              controller.close();
              clearInterval(intervalId);
            }, 1000);

          } else if (currentTask.status === 'failed') {
            const errorEvent = {
              type: 'error',
              data: {
                taskId,
                message: currentTask.error || '任务执行失败'
              },
              timestamp: Date.now()
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));

            setTimeout(() => {
              controller.close();
              clearInterval(intervalId);
            }, 1000);
          }
        }
      };

      // 立即检查一次
      checkProgress();

      // 定期检查进度变化
      intervalId = setInterval(checkProgress, 500);

      // 处理客户端断开连接
      request.signal.addEventListener('abort', () => {
        console.log(`SSE connection closed for task: ${taskId}`);
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}