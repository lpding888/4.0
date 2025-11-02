/**
 * Banner Scheduler Service
 * 艹，轮播图定时任务调度器！
 * 负责：
 * 1. 定时发布预约轮播图（status: draft -> published）
 * 2. 定时下线过期轮播图（status: published -> expired）
 */

import db from '../db';

/**
 * 发布到期的轮播图
 */
export async function publishScheduledBanners(): Promise<number> {
  const affected = await db('banners')
    .where({ status: 'draft' })
    .whereNotNull('publish_at')
    .where('publish_at', '<=', db.fn.now())
    .update({ status: 'published', updated_at: db.fn.now() });

  return affected;
}

/**
 * 更新过期的轮播图
 */
export async function updateExpiredBanners(): Promise<number> {
  const affected = await db('banners')
    .where({ status: 'published' })
    .whereNotNull('expire_at')
    .where('expire_at', '<=', db.fn.now())
    .update({ status: 'expired', updated_at: db.fn.now() });

  return affected;
}

/**
 * 执行定时任务
 */
export async function runBannerScheduler(): Promise<void> {
  try {
    console.log('[SCHEDULER] 开始执行轮播图定时任务');

    // 1. 发布到期的轮播图
    const published = await publishScheduledBanners();
    if (published > 0) {
      console.log(`[SCHEDULER] 已发布${published}个定时轮播图`);
    }

    // 2. 更新过期的轮播图
    const expired = await updateExpiredBanners();
    if (expired > 0) {
      console.log(`[SCHEDULER] 已标记${expired}个过期轮播图`);
    }

    console.log('[SCHEDULER] 轮播图定时任务执行完成');
  } catch (error: any) {
    console.error('[SCHEDULER] 轮播图定时任务执行失败:', error.message);
  }
}

/**
 * 启动定时调度器（每分钟执行一次）
 */
export function startBannerScheduler(): NodeJS.Timeout {
  console.log('[SCHEDULER] 启动轮播图定时调度器（间隔: 1分钟）');

  // 立即执行一次
  runBannerScheduler();

  // 每分钟执行一次
  return setInterval(() => {
    runBannerScheduler();
  }, 60 * 1000); // 60秒
}

/**
 * 停止定时调度器
 */
export function stopBannerScheduler(timer: NodeJS.Timeout): void {
  clearInterval(timer);
  console.log('[SCHEDULER] 已停止轮播图定时调度器');
}
