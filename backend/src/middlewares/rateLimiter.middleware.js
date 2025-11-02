const { checkRateLimit } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * 限流中间件 - 基于Redis的滑动窗口限流
 * 根据功能的rate_limit_policy进行限流
 */

/**
 * 解析限流策略
 * @param {string} policy - 限流策略(格式: "hourly:30" 或 "daily:100")
 * @returns {Object} {window: 秒数, limit: 次数}
 */
function parseRateLimitPolicy(policy) {
  if (!policy) {
    return null;
  }

  try {
    const [period, limitStr] = policy.split(':');
    const limit = parseInt(limitStr, 10);

    let windowSeconds;
    switch (period) {
      case 'minute':
      case 'minutely':
        windowSeconds = 60;
        break;
      case 'hour':
      case 'hourly':
        windowSeconds = 60 * 60;
        break;
      case 'day':
      case 'daily':
        windowSeconds = 60 * 60 * 24;
        break;
      default:
        logger.warn(`[RateLimiter] 未知的限流周期: ${period}`);
        return null;
    }

    return {
      window: windowSeconds,
      limit
    };

  } catch (error) {
    logger.error(`[RateLimiter] 解析限流策略失败: ${error.message}`, { policy });
    return null;
  }
}

/**
 * 功能级限流中间件
 * 需要在路由参数或请求体中包含featureId
 * @param {string} featureId - 功能ID
 * @param {string} rateLimitPolicy - 限流策略
 * @param {string} userId - 用户ID
 */
async function checkFeatureRateLimit(featureId, rateLimitPolicy, userId) {
  // 如果没有限流策略,直接通过
  if (!rateLimitPolicy) {
    return {
      allowed: true,
      remaining: Infinity
    };
  }

  const policy = parseRateLimitPolicy(rateLimitPolicy);
  if (!policy) {
    // 解析失败,放行(避免影响业务)
    return {
      allowed: true,
      remaining: Infinity
    };
  }

  const key = `rate_limit:${userId}:${featureId}:${Math.floor(Date.now() / (policy.window * 1000))}`;

  try {
    const result = await checkRateLimit(key, policy.limit, policy.window);

    logger.info(
      `[RateLimiter] 限流检查 userId=${userId} featureId=${featureId} ` +
      `current=${result.current} limit=${policy.limit} allowed=${result.allowed}`
    );

    return result;

  } catch (error) {
    logger.error(`[RateLimiter] 限流检查失败: ${error.message}`, { userId, featureId, error });
    // 失败时放行,避免影响正常业务
    return {
      allowed: true,
      remaining: policy.limit
    };
  }
}

module.exports = {
  parseRateLimitPolicy,
  checkFeatureRateLimit
};
