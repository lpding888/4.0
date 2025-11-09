import queueService from '../src/services/queue.service.js';
import { closeRedis } from '../src/config/redis.js';
import { db } from '../src/config/database.js';

const [, , queueArg, totalJobsArg, concurrencyArg] = process.argv;
const queueName = queueArg ?? 'task_processing';
const totalJobs = Number.parseInt(totalJobsArg ?? '50', 10);
const concurrency = Number.parseInt(concurrencyArg ?? '5', 10);
const jobName = '__diagnostic__';

async function main() {
  console.log(`[queue-stress] 准备向 ${queueName} 注入 ${totalJobs} 个任务 (并发=${concurrency})`);
  queueService.registerProcessor(
    queueName,
    jobName,
    async () => {
      await wait(50);
    },
    { concurrency }
  );

  const payloads = Array.from({ length: totalJobs }).map((_, index) => ({
    name: jobName,
    data: {
      index,
      enqueuedAt: Date.now()
    }
  }));

  const start = Date.now();
  await queueService.addBulkJobs(queueName, payloads);
  await waitForDrain(queueName, totalJobs);
  const duration = Date.now() - start;

  console.log(
    `[queue-stress] 队列 ${queueName} 已完成 ${totalJobs} 个任务，耗时 ${duration}ms，平均 ${(duration / totalJobs).toFixed(2)} ms/任务`
  );
}

async function waitForDrain(queue: string, expected: number) {
  const timeoutAt = Date.now() + 60000;
  while (Date.now() < timeoutAt) {
    const stats = await queueService.getQueueStats(queue);
    const remaining = (stats.waiting ?? 0) + (stats.active ?? 0);
    if (remaining === 0) {
      console.log(`[queue-stress] 队列 ${queue} 已清空，完成 ${expected} 个任务`);
      return;
    }
    console.log(`[queue-stress] 队列 ${queue} 剩余 ${remaining} 个任务，继续等待...`);
    await wait(500);
  }
  throw new Error(`[queue-stress] 等待队列 ${queue} 清空超时`);
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch((error) => {
    console.error('[queue-stress] 执行失败', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queueService.close().catch(() => undefined);
    await closeRedis().catch(() => undefined);
    await db.destroy().catch(() => undefined);
  });
