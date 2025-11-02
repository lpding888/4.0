/**
 * Announcement Scheduler Service
 * 艹，公告定时任务调度器！
 * 负责：
 * 1. 定时发布预约公告
 * 2. 定时下线过期公告
 */

import {
  publishScheduledAnnouncements,
  updateExpiredAnnouncements,
} from '../repositories/announcements.repo';

/**
 * 执行定时任务
 */
export async function runAnnouncementScheduler(): Promise<void> {
  try {
    console.log('[SCHEDULER] 开始执行公告定时任务');

    // 1. 发布到期的公告
    const published = await publishScheduledAnnouncements();
    if (published > 0) {
      console.log(`[SCHEDULER] 已发布${published}个定时公告`);
    }

    // 2. 更新过期的公告
    const expired = await updateExpiredAnnouncements();
    if (expired > 0) {
      console.log(`[SCHEDULER] 已标记${expired}个过期公告`);
    }

    console.log('[SCHEDULER] 公告定时任务执行完成');
  } catch (error: any) {
    console.error('[SCHEDULER] 公告定时任务执行失败:', error.message);
  }
}

/**
 * 启动定时调度器（每分钟执行一次）
 */
export function startAnnouncementScheduler(): NodeJS.Timeout {
  console.log('[SCHEDULER] 启动公告定时调度器（间隔: 1分钟）');

  // 立即执行一次
  runAnnouncementScheduler();

  // 每分钟执行一次
  return setInterval(() => {
    runAnnouncementScheduler();
  }, 60 * 1000); // 60秒
}

/**
 * 停止定时调度器
 */
export function stopAnnouncementScheduler(timer: NodeJS.Timeout): void {
  clearInterval(timer);
  console.log('[SCHEDULER] 已停止公告定时调度器');
}
