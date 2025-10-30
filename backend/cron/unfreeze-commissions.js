const commissionService = require('../src/services/commission.service');
const logger = require('../src/utils/logger');

/**
 * 定时任务：解冻佣金
 * 每小时执行一次，将冻结期已结束的佣金转为可提现
 */
async function unfreezeCommissionsJob() {
  try {
    logger.info('[Cron] 开始执行解冻佣金任务');
    await commissionService.unfreezeCommissions();
    logger.info('[Cron] 解冻佣金任务完成');
  } catch (error) {
    logger.error('[Cron] 解冻佣金任务失败:', error);
  }
}

// 每小时执行一次
const INTERVAL = 60 * 60 * 1000; // 1小时
let jobInterval = null; // 存储定时任务句柄

function startUnfreezeCommissionsJob() {
  // 防止重复启动
  if (jobInterval) {
    logger.warn('[Cron] 解冻佣金定时任务已在运行，跳过重复启动');
    return;
  }

  // 立即执行一次
  unfreezeCommissionsJob();

  // 设置定时任务
  jobInterval = setInterval(unfreezeCommissionsJob, INTERVAL);

  logger.info('[Cron] 解冻佣金定时任务已启动，间隔1小时');
}

function stopUnfreezeCommissionsJob() {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    logger.info('[Cron] 解冻佣金定时任务已停止');
  }
}

module.exports = { startUnfreezeCommissionsJob, stopUnfreezeCommissionsJob };
