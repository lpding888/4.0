const logger = require('../utils/logger');
const referralValidationService = require('../services/referral-validation.service');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');

/**
 * 推荐验证控制器
 *
 * 处理推荐验证相关的HTTP请求：
 * - 推荐人资格验证
 * - 推荐关系验证
 * - 推荐记录创建
 * - 欺诈检测
 * - 推荐统计
 */
class ReferralValidationController {
  /**
   * 验证推荐人资格
   */
  async validateReferrerQualification(req, res, next) {
    try {
      const { userId } = req.params;
      const { qualificationType = 'active_user' } = req.query;

      const result = await referralValidationService.validateReferrerQualification(userId, qualificationType);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to validate referrer qualification:', error);
      next(error);
    }
  }

  /**
   * 验证当前用户推荐人资格
   */
  async validateCurrentUserQualification(req, res, next) {
    try {
      const userId = req.user.id;
      const { qualificationType = 'active_user' } = req.query;

      const result = await referralValidationService.validateReferrerQualification(userId, qualificationType);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to validate current user qualification:', error);
      next(error);
    }
  }

  /**
   * 验证推荐关系
   */
  async validateReferralRelationship(req, res, next) {
    try {
      const { referrerId, refereeId } = req.body;
      const referralData = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        ...req.body
      };

      // 参数验证
      if (!referrerId || !refereeId) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          message: '推荐人ID和被推荐人ID不能为空'
        });
      }

      const result = await referralValidationService.validateReferralRelationship(referrerId, refereeId, referralData);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to validate referral relationship:', error);
      next(error);
    }
  }

  /**
   * 创建推荐记录
   */
  async createReferral(req, res, next) {
    try {
      const {
        referrerId,
        refereeId,
        referralCode,
        type = 'user',
        source = null,
        campaign = null,
        referralData = {}
      } = req.body;

      // 参数验证
      if (!referrerId || !refereeId) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          message: '推荐人ID和被推荐人ID不能为空'
        });
      }

      const referralDataWithMeta = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        ...referralData
      };

      const referral = await referralValidationService.createReferral({
        referrerId,
        refereeId,
        referralCode,
        type,
        source,
        campaign,
        referralData: referralDataWithMeta
      });

      logger.info(`[ReferralValidationController] User ${req.user.id} created referral: ${referrerId} -> ${refereeId}`);

      res.json({
        success: true,
        message: '推荐记录创建成功',
        data: referral
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to create referral:', error);
      next(error);
    }
  }

  /**
   * 获取推荐记录列表
   */
  async getReferrals(req, res, next) {
    try {
      const {
        referrerId,
        refereeId,
        status,
        type,
        campaign,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const db = require('../config/database');
      let query = db('referrals');

      // 应用过滤条件
      if (referrerId) {
        query = query.where('referrer_id', referrerId);
      }
      if (refereeId) {
        query = query.where('referee_id', refereeId);
      }
      if (status) {
        query = query.where('status', status);
      }
      if (type) {
        query = query.where('type', type);
      }
      if (campaign) {
        query = query.where('campaign', campaign);
      }

      // 应用排序
      const validSortFields = ['created_at', 'updated_at', 'validated_at', 'completed_at'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      query = query.orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc');

      // 应用分页
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      query = query.limit(limitNum).offset(offset);

      const referrals = await query;

      res.json({
        success: true,
        data: {
          referrals,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: referrals.length
          }
        }
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to get referrals:', error);
      next(error);
    }
  }

  /**
   * 获取推荐链信息
   */
  async getReferralChain(req, res, next) {
    try {
      const { userId } = req.params;
      const db = require('../config/database');

      const chain = await db('referral_chains')
        .where('user_id', userId)
        .first();

      if (!chain) {
        return res.json({
          success: true,
          data: {
            chain: null,
            message: '用户不在推荐链中'
          }
        });
      }

      // 获取推荐链详细信息
      const chainPath = JSON.parse(chain.chain_path || '[]');
      const chainUsers = await db('users')
        .select('id', 'username', 'email', 'avatar_url', 'created_at')
        .whereIn('id', chainPath)
        .orderByRaw(`FIELD(id, ${chainPath.map(id => `'${id}'`).join(',')})`);

      res.json({
        success: true,
        data: {
          chain,
          chainUsers,
          chainPath,
          depth: chain.chain_level
        }
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to get referral chain:', error);
      next(error);
    }
  }

  /**
   * 获取推荐统计信息
   */
  async getReferralStatistics(req, res, next) {
    try {
      const { userId } = req.params;
      const { period = 'monthly', startDate, endDate } = req.query;
      const db = require('../config/database');

      // 基础统计
      const [
        totalReferrals,
        successfulReferrals,
        pendingReferrals,
        failedReferrals
      ] = await Promise.all([
        db('referrals').where('referrer_id', userId).count('* as count'),
        db('referrals').where('referrer_id', userId).where('status', 'completed').count('* as count'),
        db('referrals').where('referrer_id', userId).where('status', 'pending').count('* as count'),
        db('referrals').where('referrer_id', userId).where('status', 'failed').count('* as count')
      ]);

      // 按时间统计
      let timeQuery = db('referrals')
        .where('referrer_id', userId)
        .select(
          db.raw('DATE(created_at) as date'),
          db.raw('COUNT(*) as count'),
          db.raw('SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as successful')
        )
        .groupBy('DATE(created_at)')
        .orderBy('date', 'desc');

      if (startDate) {
        timeQuery = timeQuery.where('created_at', '>=', startDate);
      }
      if (endDate) {
        timeQuery = timeQuery.where('created_at', '<=', endDate);
      }

      const timeStats = await timeQuery;

      // 转化率计算
      const total = parseInt(totalReferrals.count) || 0;
      const successful = parseInt(successfulReferrals.count) || 0;
      const conversionRate = total > 0 ? Math.round((successful / total) * 100) : 0;

      // 推荐层级统计
      const levelStats = await db('referral_chains')
        .where('root_referrer_id', userId)
        .select('chain_level')
        .count('* as count')
        .groupBy('chain_level');

      res.json({
        success: true,
        data: {
          summary: {
            totalReferrals: total,
            successfulReferrals: successful,
            pendingReferrals: parseInt(pendingReferrals.count) || 0,
            failedReferrals: parseInt(failedReferrals.count) || 0,
            conversionRate
          },
          timeStats,
          levelStats
        }
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to get referral statistics:', error);
      next(error);
    }
  }

  /**
   * 获取推荐欺诈检测记录
   */
  async getFraudDetections(req, res, next) {
    try {
      const { referralId, fraudType, riskLevel, status } = req.query;
      const db = require('../config/database');

      let query = db('referral_fraud_detection')
        .select('*')
        .orderBy('detected_at', 'desc');

      // 应用过滤条件
      if (referralId) {
        query = query.where('referral_id', referralId);
      }
      if (fraudType) {
        query = query.where('fraud_type', fraudType);
      }
      if (riskLevel) {
        query = query.where('risk_level', riskLevel);
      }
      if (status) {
        query = query.where('status', status);
      }

      const detections = await query;

      res.json({
        success: true,
        data: {
          detections,
          total: detections.length
        }
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to get fraud detections:', error);
      next(error);
    }
  }

  /**
   * 更新欺诈检测状态
   */
  async updateFraudDetectionStatus(req, res, next) {
    try {
      const { detectionId } = req.params;
      const { status, resolutionNotes } = req.body;

      const db = require('../config/database');
      const [updatedDetection] = await db('referral_fraud_detection')
        .where('id', detectionId)
        .update({
          status,
          resolution_notes: resolutionNotes,
          investigated_by: req.user.id,
          resolved_at: status === 'resolved' ? new Date() : null,
          updated_at: new Date()
        })
        .returning('*');

      if (!updatedDetection) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '欺诈检测记录不存在'
        });
      }

      logger.info(`[ReferralValidationController] User ${req.user.id} updated fraud detection ${detectionId} status to ${status}`);

      res.json({
        success: true,
        message: '欺诈检测状态更新成功',
        data: updatedDetection
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to update fraud detection status:', error);
      next(error);
    }
  }

  /**
   * 获取推荐人资格列表
   */
  async getReferrerQualifications(req, res, next) {
    try {
      const { userId, qualificationType, isQualified } = req.query;
      const db = require('../config/database');

      let query = db('referrer_qualifications');

      // 应用过滤条件
      if (userId) {
        query = query.where('user_id', userId);
      }
      if (qualificationType) {
        query = query.where('qualification_type', qualificationType);
      }
      if (isQualified !== undefined) {
        query = query.where('is_qualified', isQualified === 'true');
      }

      const qualifications = await query.orderBy('last_checked_at', 'desc');

      res.json({
        success: true,
        data: {
          qualifications,
          total: qualifications.length
        }
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to get referrer qualifications:', error);
      next(error);
    }
  }

  /**
   * 手动重新验证推荐人资格
   */
  async revalidateReferrerQualification(req, res, next) {
    try {
      const { userId } = req.params;
      const { qualificationType = 'active_user' } = req.body;

      // 清除缓存，强制重新验证
      const cacheService = require('../services/cache.service');
      await cacheService.del(`referral_validation:qualification:${userId}:${qualificationType}`);

      const result = await referralValidationService.validateReferrerQualification(userId, qualificationType);

      logger.info(`[ReferralValidationController] User ${req.user.id} revalidated qualification for ${userId}`);

      res.json({
        success: true,
        message: '推荐人资格重新验证完成',
        data: result
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to revalidate referrer qualification:', error);
      next(error);
    }
  }

  /**
   * 获取推荐验证规则
   */
  async getValidationRules(req, res, next) {
    try {
      const { ruleType, isActive } = req.query;
      const db = require('../config/database');

      let query = db('referral_validation_rules')
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'asc');

      // 应用过滤条件
      if (ruleType) {
        query = query.where('rule_type', ruleType);
      }
      if (isActive !== undefined) {
        query = query.where('is_active', isActive === 'true');
      }

      const rules = await query;

      res.json({
        success: true,
        data: {
          rules,
          total: rules.length
        }
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to get validation rules:', error);
      next(error);
    }
  }

  /**
   * 批量验证推荐关系
   */
  async batchValidateReferrals(req, res, next) {
    try {
      const { referralIds } = req.body;

      if (!Array.isArray(referralIds) || referralIds.length === 0) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          message: '推荐ID列表不能为空'
        });
      }

      const db = require('../config/database');
      const referrals = await db('referrals')
        .whereIn('id', referralIds)
        .select('*');

      const results = [];

      for (const referral of referrals) {
        try {
          const validation = await referralValidationService.validateReferralRelationship(
            referral.referrer_id,
            referral.referee_id,
            referral.referral_data || {}
          );

          results.push({
            referralId: referral.id,
            validation,
            success: true
          });

        } catch (error) {
          results.push({
            referralId: referral.id,
            error: error.message,
            success: false
          });
        }
      }

      logger.info(`[ReferralValidationController] User ${req.user.id} batch validated ${referralIds.length} referrals`);

      res.json({
        success: true,
        message: `批量验证完成，处理了${referralIds.length}个推荐`,
        data: {
          results,
          total: referralIds.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      });

    } catch (error) {
      logger.error('[ReferralValidationController] Failed to batch validate referrals:', error);
      next(error);
    }
  }
}

module.exports = new ReferralValidationController();