const logger = require('../utils/logger');
const { generateHMAC } = require('../utils/encryption');
const db = require('../config/database');

/**
 * SCF Callback Controller - 云函数回调控制器
 * 处理来自腾讯云SCF的回调请求
 */
class ScfCallbackController {
  /**
   * 处理SCF回调
   * POST /api/scf/callback
   */
  async handleCallback(req, res) {
    try {
      const { taskId, stepIndex, status, output, errorMessage, timestamp, signature } = req.body;

      logger.info(
        `[ScfCallbackController] 收到SCF回调 taskId=${taskId} ` +
        `stepIndex=${stepIndex} status=${status}`
      );

      // 1. 参数验证
      if (!taskId || stepIndex === undefined || !status || !timestamp || !signature) {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '缺少必要参数'
          }
        });
      }

      // 2. HMAC签名验证
      const isValidSignature = this.verifySignature(req.body);
      if (!isValidSignature) {
        logger.warn(
          `[ScfCallbackController] HMAC签名验证失败 taskId=${taskId}`,
          { body: req.body }
        );

        return res.status(403).json({
          success: false,
          error: {
            code: 4003,
            message: '签名验证失败'
          }
        });
      }

      // 3. 检查时间戳(防止重放攻击)
      const now = Date.now();
      const callbackTimestamp = parseInt(timestamp, 10);
      const timeDiff = Math.abs(now - callbackTimestamp);

      // 允许5分钟的时间差
      if (timeDiff > 5 * 60 * 1000) {
        logger.warn(
          `[ScfCallbackController] 回调时间戳过期 taskId=${taskId} ` +
          `diff=${timeDiff}ms`
        );

        return res.status(400).json({
          success: false,
          error: {
            code: 4002,
            message: '回调时间戳过期'
          }
        });
      }

      // 4. 查询任务和步骤是否存在
      const task = await db('tasks').where('id', taskId).first();
      if (!task) {
        logger.warn(`[ScfCallbackController] 任务不存在 taskId=${taskId}`);
        return res.status(404).json({
          success: false,
          error: {
            code: 4004,
            message: '任务不存在'
          }
        });
      }

      const taskStep = await db('task_steps')
        .where({ task_id: taskId, step_index: stepIndex })
        .first();

      if (!taskStep) {
        logger.warn(
          `[ScfCallbackController] 任务步骤不存在 ` +
          `taskId=${taskId} stepIndex=${stepIndex}`
        );
        return res.status(404).json({
          success: false,
          error: {
            code: 4004,
            message: '任务步骤不存在'
          }
        });
      }

      // 5. 幂等性检查(如果步骤已经是completed或failed,不重复处理)
      if (taskStep.status === 'completed' || taskStep.status === 'failed') {
        logger.info(
          `[ScfCallbackController] 步骤已处理,跳过 taskId=${taskId} ` +
          `stepIndex=${stepIndex} currentStatus=${taskStep.status}`
        );

        return res.json({
          success: true,
          message: '步骤已处理'
        });
      }

      // 6. 更新步骤状态
      await db('task_steps')
        .where({ task_id: taskId, step_index: stepIndex })
        .update({
          status: status,
          output: output ? JSON.stringify(output) : null,
          error_message: errorMessage || null,
          completed_at: new Date()
        });

      logger.info(
        `[ScfCallbackController] 步骤状态已更新 taskId=${taskId} ` +
        `stepIndex=${stepIndex} newStatus=${status}`
      );

      // 7. 如果是最后一步且成功,更新任务状态为success
      const totalSteps = await db('task_steps')
        .where('task_id', taskId)
        .count('* as count')
        .first();

      const completedSteps = await db('task_steps')
        .where('task_id', taskId)
        .where('status', 'completed')
        .count('* as count')
        .first();

      if (status === 'completed' && completedSteps.count === totalSteps.count) {
        // 所有步骤都完成了,更新任务为成功
        await db('tasks')
          .where('id', taskId)
          .update({
            status: 'success',
            artifacts: output ? JSON.stringify(output) : null,
            completed_at: new Date(),
            updated_at: new Date()
          });

        logger.info(`[ScfCallbackController] 任务全部完成 taskId=${taskId}`);

      } else if (status === 'failed') {
        // 某个步骤失败了,标记整个任务失败
        await db('tasks')
          .where('id', taskId)
          .update({
            status: 'failed',
            errorMessage: errorMessage || '步骤执行失败',
            errorReason: `步骤${stepIndex}执行失败`,
            completed_at: new Date(),
            updated_at: new Date()
          });

        logger.error(
          `[ScfCallbackController] 任务失败 taskId=${taskId} ` +
          `stepIndex=${stepIndex} error=${errorMessage}`
        );
      }

      // 8. 返回成功响应
      res.json({
        success: true,
        message: '回调处理成功'
      });

    } catch (error) {
      logger.error(
        `[ScfCallbackController] 处理回调失败: ${error.message}`,
        { error, body: req.body }
      );

      res.status(500).json({
        success: false,
        error: {
          code: 5000,
          message: '服务器内部错误'
        }
      });
    }
  }

  /**
   * 验证HMAC签名
   * @param {Object} data - 请求数据
   * @returns {boolean}
   */
  verifySignature(data) {
    try {
      const { signature, ...payload } = data;

      // 获取HMAC密钥(从环境变量)
      const hmacSecret = process.env.INTERNAL_CALLBACK_SECRET || 'default_secret';

      // 构造签名数据(按字段名排序后拼接)
      const sortedKeys = Object.keys(payload).sort();
      const signatureData = sortedKeys.map(key => `${key}=${payload[key]}`).join('&');

      // 计算HMAC
      const expectedSignature = generateHMAC(signatureData, hmacSecret);

      // 比较签名
      return signature === expectedSignature;

    } catch (error) {
      logger.error(`[ScfCallbackController] 签名验证异常: ${error.message}`, error);
      return false;
    }
  }
}

module.exports = new ScfCallbackController();
