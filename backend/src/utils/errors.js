/**
 * 错误码枚举 (P1-012)
 * 艹！统一管理所有错误码,不再用字符串错误码这种SB方式了
 *
 * 错误码分类:
 * 1xxx - 系统错误
 * 2xxx - 认证错误
 * 3xxx - 支付错误
 * 4xxx - 业务错误
 * 5xxx - 服务错误
 * 6xxx - 分销错误
 */
const ErrorCode = {
  // ========== 1xxx - 系统错误 ==========
  SYSTEM_ERROR: { code: 1000, message: '系统错误', httpStatus: 500 },
  NOT_MEMBER: { code: 1002, message: '请先购买会员', httpStatus: 403 },
  QUOTA_INSUFFICIENT: { code: 1003, message: '配额不足,请续费', httpStatus: 403 },
  USER_NOT_FOUND: { code: 1004, message: '用户不存在', httpStatus: 404 },

  // ========== 2xxx - 认证错误 ==========
  INVALID_CODE: { code: 2001, message: '验证码错误或已过期', httpStatus: 400 },
  CODE_TOO_FREQUENT: { code: 2004, message: '验证码发送过于频繁,请1分钟后再试', httpStatus: 429 },
  REQUEST_TOO_FREQUENT: { code: 2005, message: '请求过于频繁,请稍后再试', httpStatus: 429 },
  WECHAT_LOGIN_FAILED: { code: 2006, message: '微信登录失败', httpStatus: 400 },
  INVALID_CREDENTIALS: { code: 2007, message: '手机号或密码错误', httpStatus: 401 },
  PASSWORD_NOT_SET: { code: 2008, message: '该用户未设置密码,请使用验证码登录', httpStatus: 401 },
  OLD_PASSWORD_INCORRECT: { code: 2009, message: '旧密码错误', httpStatus: 401 },
  OLD_PASSWORD_REQUIRED: { code: 2010, message: '修改密码需要提供旧密码', httpStatus: 400 },
  PASSWORD_TOO_SHORT: { code: 2011, message: '密码长度至少6位', httpStatus: 400 },
  REFERRER_NOT_FOUND: { code: 2012, message: '推荐人不存在', httpStatus: 400 },
  REFERRER_DELETED: { code: 2013, message: '推荐人账号已被删除', httpStatus: 400 },
  REFRESH_TOKEN_INVALID: { code: 2014, message: '刷新令牌无效', httpStatus: 401 },
  REFRESH_TOKEN_EXPIRED: { code: 2015, message: '刷新令牌已过期', httpStatus: 401 },
  REFRESH_TOKEN_REQUIRED: { code: 2016, message: '缺少刷新令牌', httpStatus: 400 },

  // ========== 3xxx - 支付错误 ==========
  ORDER_CREATE_FAILED: { code: 3000, message: '创建订单失败', httpStatus: 500 },
  ORDER_NOT_FOUND: { code: 3001, message: '订单不存在', httpStatus: 404 },
  PAYMENT_AMOUNT_MISMATCH: { code: 3002, message: '支付金额不匹配', httpStatus: 400 },
  ORDER_ALREADY_PAID: { code: 3003, message: '订单已支付', httpStatus: 400 },
  PAYMENT_FAILED: { code: 3004, message: '支付失败', httpStatus: 500 },

  // ========== 4xxx - 业务错误 ==========
  INVALID_TASK_TYPE: { code: 4001, message: '无效的任务类型', httpStatus: 400 },
  FEATURE_NOT_FOUND: { code: 4001, message: '功能不存在', httpStatus: 404 },
  FEATURE_DISABLED: { code: 4002, message: '功能已下线', httpStatus: 403 },
  FEATURE_FORBIDDEN: { code: 4003, message: '无权访问该功能', httpStatus: 403 },
  TASK_NOT_FOUND: { code: 4004, message: '任务不存在', httpStatus: 404 },
  TASK_FORBIDDEN: { code: 4003, message: '无权访问该任务', httpStatus: 403 },
  QUOTA_INSUFFICIENT_FOR_TASK: { code: 4029, message: '配额不足,请购买会员或充值', httpStatus: 403 },
  ASSET_NOT_FOUND: { code: 4004, message: '素材不存在或无权删除', httpStatus: 404 },

  // ========== 5xxx - 服务错误 ==========
  FORM_SCHEMA_NOT_FOUND: { code: 5001, message: '表单Schema不存在', httpStatus: 500 },
  PIPELINE_SCHEMA_NOT_FOUND: { code: 5002, message: 'Pipeline Schema不存在', httpStatus: 500 },
  ALREADY_MEMBER: { code: 5002, message: '已经是会员', httpStatus: 400 },
  ORDER_TYPE_INVALID: { code: 5003, message: '无效的订单类型', httpStatus: 400 },

  // ========== 6xxx - 分销错误 ==========
  ALREADY_DISTRIBUTOR: { code: 6001, message: '已经是分销员', httpStatus: 400 },
  INVITATION_CODE_EXISTS: { code: 6002, message: '邀请码已被使用', httpStatus: 400 },
  DISTRIBUTOR_CREATE_FAILED: { code: 6003, message: '创建分销员失败', httpStatus: 500 },
  DISTRIBUTOR_INIT_FAILED: { code: 6004, message: '初始化分销员数据失败', httpStatus: 500 },
  NOT_DISTRIBUTOR: { code: 6005, message: '不是分销员', httpStatus: 403 },
  WITHDRAWAL_FAILED: { code: 6006, message: '提现失败', httpStatus: 500 },
  INSUFFICIENT_BALANCE: { code: 6007, message: '余额不足', httpStatus: 400 },
  WITHDRAWAL_AMOUNT_TOO_LOW: { code: 6008, message: '提现金额不能低于最低额度', httpStatus: 400 },
  DUPLICATE_WITHDRAWAL: { code: 6009, message: '已存在待审核的提现申请', httpStatus: 400 },
  WITHDRAWAL_CREATE_FAILED: { code: 6010, message: '创建提现记录失败', httpStatus: 500 },
  WITHDRAWAL_NOT_FOUND: { code: 6013, message: '提现记录不存在', httpStatus: 404 },
  INVALID_WITHDRAWAL_STATUS: { code: 6014, message: '提现状态无效', httpStatus: 400 },
};

/**
 * 应用错误类 (P1-012)
 * 艹！统一的错误处理类,不再手动throw对象了
 *
 * @example
 * throw new AppError(ErrorCode.USER_NOT_FOUND);
 * throw new AppError(ErrorCode.SYSTEM_ERROR, '数据库连接失败');
 */
class AppError extends Error {
  /**
   * @param {Object} errorCode - 错误码枚举对象
   * @param {string} customMessage - 可选的自定义错误消息
   */
  constructor(errorCode, customMessage = null) {
    super(customMessage || errorCode.message);
    this.name = 'AppError';
    this.errorCode = errorCode.code;
    this.statusCode = errorCode.httpStatus;
    this.message = customMessage || errorCode.message;

    // 捕获堆栈信息
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 转换为API响应格式
   */
  toJSON() {
    return {
      success: false,
      errorCode: this.errorCode,
      message: this.message
    };
  }
}

module.exports = {
  ErrorCode,
  AppError
};
