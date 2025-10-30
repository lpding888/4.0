/**
 * 回调发送器 - 向后端发送任务状态更新
 * 使用 HMAC-SHA256 签名保证安全性
 *
 * 签名算法（与后端 verifyInternalSignature 中间件一致）：
 * payload = task_id + step_index + timestamp
 * signature = HMAC-SHA256(payload, secret) -> hex
 */

const crypto = require('crypto');
const axios = require('axios');
const logger = require('../../common/logger');

/**
 * 发送回调到后端
 * @param {Object} params - 回调参数
 * @param {string} params.task_id - 任务ID
 * @param {number} params.step_index - 步骤索引
 * @param {string} params.status - 状态: success | failed
 * @param {string} params.output_url - 输出文件URL（成功时）
 * @param {string} params.error_message - 错误信息（失败时）
 * @param {string} backendUrl - 后端API地址
 * @param {string} secret - 签名密钥
 */
async function send(params, backendUrl, secret) {
  const { task_id, step_index, status, output_url, error_message } = params;

  // 1. 生成时间戳
  const timestamp = Math.floor(Date.now() / 1000);

  // 2. 计算签名（严格按照顺序：task_id + step_index + timestamp）
  const payload = `${task_id}${step_index}${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // 3. 构建回调URL
  const callbackUrl = `${backendUrl}/api/internal/tasks/${task_id}/steps/${step_index}/callback`;

  // 4. 构建请求体
  const body = {
    status: status,
    output_url: output_url || null,
    error_message: error_message || null
  };

  // 5. 发送请求（带重试机制）
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info('发送回调到后端', {
        attempt,
        task_id,
        step_index,
        status,
        callbackUrl
      });

      const response = await axios.post(callbackUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Signature': signature,
          'X-Timestamp': timestamp
        },
        timeout: 10000 // 10秒超时
      });

      logger.info('回调发送成功', {
        task_id,
        step_index,
        status,
        responseStatus: response.status
      });

      return true;

    } catch (error) {
      lastError = error;
      logger.warn(`回调发送失败 (尝试 ${attempt}/${maxRetries})`, {
        task_id,
        step_index,
        error: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });

      // 如果不是最后一次尝试，等待后重试
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 指数退避
      }
    }
  }

  // 所有重试都失败
  logger.error('回调发送最终失败', {
    task_id,
    step_index,
    error: lastError.message
  });

  throw new Error(`回调发送失败: ${lastError.message}`);
}

module.exports = { send };
