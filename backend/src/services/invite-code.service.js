const logger = require('../utils/logger');
const db = require('../config/database');
const cacheService = require('./cache.service');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');
const crypto = require('crypto');

/**
 * 邀请码服务类
 *
 * 管理邀请码的生成、验证、使用和统计：
 * - 批量生成邀请码
 * - 邀请码验证和使用
 * - 邀请奖励计算
 * - 邀请统计追踪
 * - 邀请码池管理
 */
class InviteCodeService {
  constructor() {
    this.initialized = false;
    this.cachePrefix = 'invite_code:';
    this.cacheTTL = 300; // 5分钟缓存
    this.codeLength = 8; // 邀请码长度
    this.codePattern = /^[A-Z0-9]+$/; // 邀请码格式（只包含大写字母和数字）
  }

  /**
   * 初始化邀请码服务
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('[InviteCodeService] Initializing invite code service...');

      // 测试数据库连接
      await db('invite_codes').select(1).first();

      // 清理过期的邀请码
      await this.cleanupExpiredCodes();

      this.initialized = true;
      logger.info('[InviteCodeService] Invite code service initialized successfully');

    } catch (error) {
      logger.error('[InviteCodeService] Failed to initialize invite code service:', error);
      throw error;
    }
  }

  /**
   * 生成邀请码
   * @param {number} length - 邀请码长度
   * @returns {string} 邀请码
   */
  generateCode(length = this.codeLength) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';

    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  }

  /**
   * 批量生成邀请码
   * @param {Object} options - 生成选项
   * @returns {Array} 生成的邀请码列表
   */
  async generateInviteCodes(options = {}) {
    try {
      const {
        count = 10,
        type = 'general',
        maxUses = 1,
        validDays = 30,
        batchName = null,
        description = null,
        createdBy = 'system'
      } = options;

      const codes = [];
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validDays);

      const trx = await db.transaction();

      try {
        // 创建批次记录
        const [batch] = await trx('invite_code_batches').insert({
          batch_name: batchName || `Batch_${Date.now()}`,
          description: description || `批量生成${count}个${type}类型邀请码`,
          type,
          count,
          valid_days: validDays,
          max_uses_per_code: maxUses,
          created_by: createdBy,
          generation_config: {
            codeLength: this.codeLength,
            expiresAt: expiresAt.toISOString()
          }
        }).returning('*');

        // 批量生成邀请码
        for (let i = 0; i < count; i++) {
          let code;
          let attempts = 0;
          const maxAttempts = 10;

          // 确保生成的邀请码不重复
          do {
            code = this.generateCode();
            attempts++;

            if (attempts > maxAttempts) {
              throw new Error('Failed to generate unique invite code after multiple attempts');
            }
          } while (await this.isCodeExists(code));

          const [inviteCode] = await trx('invite_codes').insert({
            code,
            type,
            status: 'active',
            creator_id: null,
            creator_type: 'system',
            max_uses,
            used_count: 0,
            expires_at: expiresAt,
            created_at: new Date(),
            updated_at: new Date()
          }).returning('*');

          codes.push(inviteCode);
        }

        await trx.commit();

        logger.info(`[InviteCodeService] Generated ${codes.length} invite codes of type ${type}`);
        return codes;

      } catch (error) {
        await trx.rollback();
        throw error;
      }

    } catch (error) {
      logger.error('[InviteCodeService] Failed to generate invite codes:', error);
      throw AppError.fromError(error, ERROR_CODES.TASK_CREATION_FAILED);
    }
  }

  /**
   * 检查邀请码是否存在
   * @param {string} code - 邀请码
   * @returns {boolean} 是否存在
   */
  async isCodeExists(code) {
    try {
      const existing = await db('invite_codes')
        .where('code', code)
        .first();

      return !!existing;
    } catch (error) {
      logger.error('[InviteCodeService] Failed to check code existence:', error);
      return false;
    }
  }

  /**
   * 验证邀请码
   * @param {string} code - 邀请码
   * @returns {Object} 验证结果
   */
  async validateInviteCode(code) {
    try {
      // 清理输入
      const cleanCode = code.toUpperCase().trim();

      // 检查格式
      if (!this.codePattern.test(cleanCode)) {
        return {
          valid: false,
          error: 'Invalid code format',
          code: ERROR_CODES.INVALID_PARAMETERS
        };
      }

      // 从缓存获取
      const cacheKey = `${this.cachePrefix}validate:${cleanCode}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 从数据库查询
      const inviteCode = await db('invite_codes')
        .where('code', cleanCode)
        .first();

      if (!inviteCode) {
        const result = {
          valid: false,
          error: 'Invite code not found',
          code: ERROR_CODES.TASK_NOT_FOUND
        };
        await cacheService.set(cacheKey, result, this.cacheTTL);
        return result;
      }

      // 检查状态
      const now = new Date();
      let result;

      if (inviteCode.status === 'disabled') {
        result = {
          valid: false,
          error: 'Invite code has been disabled',
          code: ERROR_CODES.TASK_NOT_FOUND
        };
      } else if (inviteCode.status === 'used' || inviteCode.used_count >= inviteCode.max_uses) {
        result = {
          valid: false,
          error: 'Invite code has been fully used',
          code: ERROR_CODES.INVITE_CODE_USED
        };
      } else if (inviteCode.expires_at && now > inviteCode.expires_at) {
        result = {
          valid: false,
          error: 'Invite code has expired',
          code: ERROR_CODES.INVITE_CODE_EXPIRED
        };
      } else {
        result = {
          valid: true,
          inviteCode: {
            id: inviteCode.id,
            type: inviteCode.type,
            maxUses: inviteCode.max_uses,
            usedCount: inviteCode.used_count,
            expiresAt: inviteCode.expires_at
          }
        };
      }

      // 缓存结果
      await cacheService.set(cacheKey, result, this.cacheTTL);
      return result;

    } catch (error) {
      logger.error('[InviteCodeService] Failed to validate invite code:', error);
      return {
        valid: false,
        error: 'Validation failed',
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      };
    }
  }

  /**
   * 使用邀请码
   * @param {string} code - 邀请码
   * @param {Object} usageData - 使用数据
   * @returns {Object} 使用结果
   */
  async useInviteCode(code, usageData = {}) {
    try {
      const { inviterId, inviteeId, inviteeEmail, inviteePhone, ipAddress, userAgent } = usageData;

      // 验证邀请码
      const validation = await this.validateInviteCode(code);
      if (!validation.valid) {
        throw AppError.create(validation.code, {
          code,
          error: validation.error
        });
      }

      const { inviteCode } = validation;
      const now = new Date();

      const trx = await db.transaction();

      try {
        // 更新邀请码使用状态
        const newUsedCount = inviteCode.used_count + 1;
        const newStatus = newUsedCount >= inviteCode.max_uses ? 'used' : 'active';

        await trx('invite_codes')
          .where('id', inviteCode.id)
          .update({
            used_count: newUsedCount,
            status: newStatus,
            invitee_id: inviteeId,
            used_at: newUsedCount === 1 ? now : inviteCode.used_at,
            updated_at: now
          });

        // 创建使用记录
        await trx('invite_usage_logs').insert({
          invite_code_id: inviteCode.id,
          inviter_id: inviteCode.inviter_id || inviterId,
          invitee_id,
          invitee_email: inviteeEmail,
          invitee_phone: inviteePhone,
          status: 'pending',
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: now,
          updated_at: now
        });

        // 更新邀请人统计
        if (inviteCode.inviter_id) {
          await this.updateUserInviteStats(inviteCode.inviter_id, 'success');
        }

        // 更新被邀请人统计
        if (inviteeId) {
          await this.updateUserInviteStats(inviteeId, 'received');
        }

        await trx.commit();

        // 清除缓存
        await cacheService.del(`${this.cachePrefix}validate:${code}`);

        logger.info(`[InviteCodeService] Invite code used: ${code} by user ${inviteeId}`);

        return {
          success: true,
          inviteCode: {
            id: inviteCode.id,
            type: inviteCode.type,
            remainingUses: inviteCode.max_uses - newUsedCount
          }
        };

      } catch (error) {
        await trx.rollback();
        throw error;
      }

    } catch (error) {
      logger.error('[InviteCodeService] Failed to use invite code:', error);
      throw AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
    }
  }

  /**
   * 获取邀请码列表
   * @param {Object} options - 查询选项
   * @returns {Array} 邀请码列表
   */
  async getInviteCodes(options = {}) {
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
      } = options;

      let query = db('invite_codes');

      // 应用过滤条件
      if (type) {
        query = query.where('type', type);
      }
      if (status) {
        query = query.where('status', status);
      }
      if (creatorId) {
        query = query.where('creator_id', creatorId);
      }
      if (inviterId) {
        query = query.where('inviter_id', inviterId);
      }
      if (inviteeId) {
        query = query.where('invitee_id', inviteeId);
      }

      // 应用排序
      const validSortFields = ['created_at', 'updated_at', 'used_count', 'expires_at'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      query = query.orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc');

      // 应用分页
      const offset = (page - 1) * limit;
      query = query.limit(limit).offset(offset);

      const codes = await query;

      return codes;

    } catch (error) {
      logger.error('[InviteCodeService] Failed to get invite codes:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 更新用户邀请统计
   * @param {string} userId - 用户ID
   * @param {string} action - 动作类型
   */
  async updateUserInviteStats(userId, action) {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      await db.transaction(async (trx) => {
        // 获取或创建统计记录
        let stats = await trx('user_invite_stats')
          .where('user_id', userId)
          .first();

        if (!stats) {
          stats = await trx('user_invite_stats').insert({
            user_id: userId,
            total_invites: 0,
            successful_invites: 0,
            pending_invites: 0,
            failed_invites: 0,
            total_rewards: 0,
            last_invite_date: null,
            monthly_stats: {},
            created_at: now,
            updated_at: now
          }).returning('*');
        }

        // 更新统计
        const updates = {
          updated_at: now
        };

        switch (action) {
          case 'created':
            updates.total_invites = stats.total_invites + 1;
            updates.pending_invites = stats.pending_invites + 1;
            break;
          case 'success':
            updates.successful_invites = stats.successful_invites + 1;
            updates.pending_invites = Math.max(0, stats.pending_invites - 1);
            updates.last_invite_date = today;
            break;
          case 'failed':
            updates.failed_invites = stats.failed_invites + 1;
            updates.pending_invites = Math.max(0, stats.pending_invites - 1);
            break;
          case 'received':
            updates.last_invite_date = today;
            break;
        }

        await trx('user_invite_stats')
          .where('user_id', userId)
          .update(updates);

      });

    } catch (error) {
      logger.error('[InviteCodeService] Failed to update user invite stats:', error);
      // 统计更新失败不应该影响主要功能
    }
  }

  /**
   * 获取用户邀请统计
   * @param {string} userId - 用户ID
   * @returns {Object} 统计信息
   */
  async getUserInviteStats(userId) {
    try {
      const stats = await db('user_invite_stats')
        .where('user_id', userId)
        .first();

      return stats || {
        total_invites: 0,
        successful_invites: 0,
        pending_invites: 0,
        failed_invites: 0,
        total_rewards: 0,
        last_invite_date: null,
        monthly_stats: {}
      };

    } catch (error) {
      logger.error('[InviteCodeService] Failed to get user invite stats:', error);
      return null;
    }
  }

  /**
   * 获取邀请使用记录
   * @param {Object} options - 查询选项
   * @returns {Array} 使用记录列表
   */
  async getInviteUsageLogs(options = {}) {
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
      } = options;

      let query = db('invite_usage_logs')
        .select('invite_usage_logs.*')
        .leftJoin('invite_codes', 'invite_usage_logs.invite_code_id', '=', 'invite_codes.id')
        .select('invite_codes.code as invite_code');

      // 应用过滤条件
      if (inviteCodeId) {
        query = query.where('invite_usage_logs.invite_code_id', inviteCodeId);
      }
      if (inviterId) {
        query = query.where('invite_usage_logs.inviter_id', inviterId);
      }
      if (inviteeId) {
        query = query.where('invite_usage_logs.invitee_id', inviteeId);
      }
      if (status) {
        query = query.where('invite_usage_logs.status', status);
      }

      // 应用排序
      const validSortFields = ['created_at', 'updated_at'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      query = query.orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc');

      // 应用分页
      const offset = (page - 1) * limit;
      query = query.limit(limit).offset(offset);

      const logs = await query;

      return logs;

    } catch (error) {
      logger.error('[InviteCodeService] Failed to get invite usage logs:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 清理过期邀请码
   */
  async cleanupExpiredCodes() {
    try {
      const now = new Date();

      const result = await db('invite_codes')
        .where('expires_at', '<', now)
        .where('status', 'active')
        .update({
          status: 'expired',
          updated_at: now
        });

      if (result > 0) {
        logger.info(`[InviteCodeService] Cleaned up ${result} expired invite codes`);
      }

    } catch (error) {
      logger.error('[InviteCodeService] Failed to cleanup expired codes:', error);
    }
  }

  /**
   * 禁用邀请码
   * @param {string} code - 邀请码
   * @returns {boolean} 是否成功
   */
  async disableInviteCode(code) {
    try {
      const result = await db('invite_codes')
        .where('code', code.toUpperCase().trim())
        .update({
          status: 'disabled',
          updated_at: new Date()
        });

      if (result > 0) {
        await cacheService.del(`${this.cachePrefix}validate:${code}`);
        logger.info(`[InviteCodeService] Disabled invite code: ${code}`);
      }

      return result > 0;

    } catch (error) {
      logger.error('[InviteCodeService] Failed to disable invite code:', error);
      return false;
    }
  }

  /**
   * 获取邀请码统计信息
   * @returns {Object} 统计信息
   */
  async getStats() {
    try {
      const [
        totalCodes,
        activeCodes,
        usedCodes,
        expiredCodes,
        disabledCodes
      ] = await Promise.all([
        db('invite_codes').count('*'),
        db('invite_codes').where('status', 'active').count('*'),
        db('invite_codes').where('status', 'used').count('*'),
        db('invite_codes').where('expires_at', '<', db.fn.now()).count('*'),
        db('invite_codes').where('status', 'disabled').count('*')
      ]);

      const statsByType = await db('invite_codes')
        .select('type')
        .count('* as count')
        .groupBy('type');

      return {
        total: totalCodes,
        active: activeCodes,
        used: usedCodes,
        expired: expiredCodes,
        disabled: disabledCodes,
        byType: statsByType.reduce((acc, item) => {
          acc[item.type] = item.count;
          return acc;
        }, {}),
        initialized: this.initialized,
        cachePrefix: this.cachePrefix,
        cacheTTL: this.cacheTTL
      };

    } catch (error) {
      logger.error('[InviteCodeService] Failed to get stats:', error);
      return {
        total: 0,
        active: 0,
        used: 0,
        expired: 0,
        disabled: 0,
        byType: {},
        initialized: this.initialized,
        cachePrefix: this.cachePrefix,
        cacheTTL: this.cacheTTL
      };
    }
  }

  /**
   * 关闭服务
   */
  async close() {
    try {
      this.initialized = false;
      logger.info('[InviteCodeService] Invite code service closed');
    } catch (error) {
      logger.error('[InviteCodeService] Error closing invite code service:', error);
    }
  }
}

module.exports = new InviteCodeService();