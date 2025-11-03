const logger = require('../utils/logger');
const inviteCodeService = require('../services/invite-code.service');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');

/**
 * 邀请码控制器
 *
 * 处理邀请码相关的HTTP请求：
 * - 批量生成邀请码
 * - 验证和使用邀请码
 * - 查询邀请码列表和统计
 * - 邀请记录管理
 */
class InviteCodeController {
  /**
   * 批量生成邀请码
   */
  async generateInviteCodes(req, res, next) {
    try {
      const {
        count = 10,
        type = 'general',
        maxUses = 1,
        validDays = 30,
        batchName = null,
        description = null
      } = req.body;

      // 参数验证
      if (!Number.isInteger(count) || count < 1 || count > 1000) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'count',
          message: '生成数量必须在1-1000之间'
        });
      }

      if (!['general', 'vip', 'special', 'limited'].includes(type)) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'type',
          message: '无效的邀请码类型'
        });
      }

      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'maxUses',
          message: '最大使用次数必须在1-100之间'
        });
      }

      if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'validDays',
          message: '有效天数必须在1-365之间'
        });
      }

      const options = {
        count,
        type,
        maxUses,
        validDays,
        batchName,
        description,
        createdBy: req.user?.id || 'system'
      };

      const codes = await inviteCodeService.generateInviteCodes(options);

      logger.info(`[InviteCodeController] User ${req.user?.id || 'system'} generated ${codes.length} invite codes`);

      res.json({
        success: true,
        message: `成功生成${codes.length}个邀请码`,
        data: {
          codes,
          summary: {
            total: codes.length,
            type,
            maxUses,
            validDays,
            expiresAt: codes[0]?.expires_at
          }
        }
      });

    } catch (error) {
      logger.error('[InviteCodeController] Failed to generate invite codes:', error);
      next(error);
    }
  }

  /**
   * 验证邀请码
   */
  async validateInviteCode(req, res, next) {
    try {
      const { code } = req.body;

      if (!code || typeof code !== 'string') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'code',
          message: '邀请码不能为空'
        });
      }

      const result = await inviteCodeService.validateInviteCode(code);

      logger.info(`[InviteCodeController] Invite code validation: ${code} -> ${result.valid}`);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('[InviteCodeController] Failed to validate invite code:', error);
      next(error);
    }
  }

  /**
   * 使用邀请码
   */
  async useInviteCode(req, res, next) {
    try {
      const { code } = req.body;
      const usageData = {
        inviterId: req.body.inviterId,
        inviteeId: req.user?.id,
        inviteeEmail: req.body.inviteeEmail,
        inviteePhone: req.body.inviteePhone,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      };

      if (!code || typeof code !== 'string') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'code',
          message: '邀请码不能为空'
        });
      }

      const result = await inviteCodeService.useInviteCode(code, usageData);

      logger.info(`[InviteCodeController] User ${usageData.inviteeId} used invite code: ${code}`);

      res.json({
        success: true,
        message: '邀请码使用成功',
        data: result
      });

    } catch (error) {
      logger.error('[InviteCodeController] Failed to use invite code:', error);
      next(error);
    }
  }

  /**
   * 获取邀请码列表
   */
  async getInviteCodes(req, res, next) {
    try {
      const {
        type,
        status,
        creatorId,
        inviterId,
        inviteeId,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      // 参数验证
      if (type && !['general', 'vip', 'special', 'limited'].includes(type)) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'type',
          message: '无效的邀请码类型'
        });
      }

      if (status && !['active', 'used', 'expired', 'disabled'].includes(status)) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'status',
          message: '无效的邀请码状态'
        });
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (pageNum < 1 || pageNum > 1000) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'page',
          message: '页码必须在1-1000之间'
        });
      }

      if (limitNum < 1 || limitNum > 100) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'limit',
          message: '每页数量必须在1-100之间'
        });
      }

      const options = {
        type,
        status,
        creatorId,
        inviterId,
        inviteeId,
        page: pageNum,
        limit: limitNum,
        sortBy,
        sortOrder
      };

      const codes = await inviteCodeService.getInviteCodes(options);

      res.json({
        success: true,
        data: {
          codes,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: codes.length
          }
        }
      });

    } catch (error) {
      logger.error('[InviteCodeController] Failed to get invite codes:', error);
      next(error);
    }
  }

  /**
   * 获取用户邀请统计
   */
  async getUserInviteStats(req, res, next) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.user?.id;

      if (!targetUserId) {
        throw AppError.create(ERROR_CODES.UNAUTHORIZED, {
          message: '用户ID不能为空'
        });
      }

      const stats = await inviteCodeService.getUserInviteStats(targetUserId);

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('[InviteCodeController] Failed to get user invite stats:', error);
      next(error);
    }
  }

  /**
   * 获取邀请使用记录
   */
  async getInviteUsageLogs(req, res, next) {
    try {
      const {
        inviteCodeId,
        inviterId,
        inviteeId,
        status,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      if (pageNum < 1 || pageNum > 1000) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'page',
          message: '页码必须在1-1000之间'
        });
      }

      if (limitNum < 1 || limitNum > 100) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'limit',
          message: '每页数量必须在1-100之间'
        });
      }

      const options = {
        inviteCodeId,
        inviterId,
        inviteeId,
        status,
        page: pageNum,
        limit: limitNum,
        sortBy,
        sortOrder
      };

      const logs = await inviteCodeService.getInviteUsageLogs(options);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: logs.length
          }
        }
      });

    } catch (error) {
      logger.error('[InviteCodeController] Failed to get invite usage logs:', error);
      next(error);
    }
  }

  /**
   * 禁用邀请码
   */
  async disableInviteCode(req, res, next) {
    try {
      const { code } = req.params;

      if (!code || typeof code !== 'string') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'code',
          message: '邀请码不能为空'
        });
      }

      const success = await inviteCodeService.disableInviteCode(code);

      if (!success) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          code,
          message: '邀请码不存在或已被禁用'
        });
      }

      logger.info(`[InviteCodeController] User ${req.user?.id} disabled invite code: ${code}`);

      res.json({
        success: true,
        message: '邀请码已禁用'
      });

    } catch (error) {
      logger.error('[InviteCodeController] Failed to disable invite code:', error);
      next(error);
    }
  }

  /**
   * 获取邀请码统计信息
   */
  async getInviteCodeStats(req, res, next) {
    try {
      const stats = await inviteCodeService.getStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('[InviteCodeController] Failed to get invite code stats:', error);
      next(error);
    }
  }

  /**
   * 清理过期邀请码
   */
  async cleanupExpiredCodes(req, res, next) {
    try {
      await inviteCodeService.cleanupExpiredCodes();

      logger.info(`[InviteCodeController] User ${req.user?.id} triggered cleanup of expired codes`);

      res.json({
        success: true,
        message: '过期邀请码清理完成'
      });

    } catch (error) {
      logger.error('[InviteCodeController] Failed to cleanup expired codes:', error);
      next(error);
    }
  }
}

module.exports = new InviteCodeController();