const logger = require('../utils/logger');
const db = require('../config/database');
const cacheService = require('./cache.service');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');

/**
 * 推荐人有效性校验服务
 *
 * 管理推荐系统的验证和风控：
 * - 推荐人资格验证
 * - 推荐关系验证
 * - 欺诈检测和风险控制
 * - 推荐链追踪
 * - 奖励发放管理
 */
class ReferralValidationService {
  constructor() {
    this.initialized = false;
    this.cachePrefix = 'referral_validation:';
    this.cacheTTL = 300; // 5分钟缓存
    this.riskThresholds = {
      low: 30,
      medium: 60,
      high: 80,
      critical: 95
    };
  }

  /**
   * 初始化推荐验证服务
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('[ReferralValidationService] Initializing referral validation service...');

      // 测试数据库连接
      await db('referrals').select(1).first();

      // 初始化默认验证规则
      await this.initializeDefaultRules();

      this.initialized = true;
      logger.info('[ReferralValidationService] Referral validation service initialized successfully');

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to initialize referral validation service:', error);
      throw error;
    }
  }

  /**
   * 验证推荐人资格
   * @param {string} referrerId - 推荐人ID
   * @param {string} qualificationType - 资格类型
   * @returns {Object} 验证结果
   */
  async validateReferrerQualification(referrerId, qualificationType = 'active_user') {
    try {
      const cacheKey = `${this.cachePrefix}qualification:${referrerId}:${qualificationType}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const referrer = await db('users').where('id', referrerId).first();
      if (!referrer) {
        return {
          valid: false,
          reason: '推荐人不存在',
          riskScore: 100
        };
      }

      // 检查账户状态
      if (referrer.account_status !== 'active') {
        return {
          valid: false,
          reason: '推荐人账户状态异常',
          riskScore: 90
        };
      }

      let qualificationResult = {
        valid: false,
        reason: '',
        riskScore: 0,
        qualificationData: {}
      };

      // 根据资格类型进行验证
      switch (qualificationType) {
        case 'active_user':
          qualificationResult = await this.validateActiveUserQualification(referrer);
          break;
        case 'premium_member':
          qualificationResult = await this.validatePremiumMemberQualification(referrer);
          break;
        case 'verified_user':
          qualificationResult = await this.validateVerifiedUserQualification(referrer);
          break;
        case 'content_creator':
          qualificationResult = await this.validateContentCreatorQualification(referrer);
          break;
        case 'partner':
          qualificationResult = await this.validatePartnerQualification(referrer);
          break;
        default:
          qualificationResult = await this.validateActiveUserQualification(referrer);
      }

      // 更新或创建资格记录
      await this.updateReferrerQualification(referrerId, qualificationType, qualificationResult);

      await cacheService.set(cacheKey, qualificationResult, this.cacheTTL);
      return qualificationResult;

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate referrer qualification:', error);
      return {
        valid: false,
        reason: '验证失败',
        riskScore: 100
      };
    }
  }

  /**
   * 验证推荐关系
   * @param {string} referrerId - 推荐人ID
   * @param {string} refereeId - 被推荐人ID
   * @param {Object} referralData - 推荐数据
   * @returns {Object} 验证结果
   */
  async validateReferralRelationship(referrerId, refereeId, referralData = {}) {
    try {
      const validationResults = {
        valid: true,
        overallRiskScore: 0,
        validations: [],
        fraudDetections: [],
        recommendations: []
      };

      // 基础验证
      const basicValidation = await this.performBasicValidation(referrerId, refereeId);
      validationResults.validations.push(basicValidation);
      validationResults.overallRiskScore += basicValidation.riskScore;

      if (!basicValidation.valid) {
        validationResults.valid = false;
        return validationResults;
      }

      // 时间窗口验证
      const timeWindowValidation = await this.validateTimeWindow(referrerId, refereeId);
      validationResults.validations.push(timeWindowValidation);
      validationResults.overallRiskScore += timeWindowValidation.riskScore;

      // IP和设备验证
      const deviceValidation = await this.validateDeviceAndIP(referrerId, refereeId, referralData);
      validationResults.validations.push(deviceValidation);
      validationResults.overallRiskScore += deviceValidation.riskScore;

      // 行为模式验证
      const behaviorValidation = await this.validateBehaviorPattern(referrerId, refereeId);
      validationResults.validations.push(behaviorValidation);
      validationResults.overallRiskScore += behaviorValidation.riskScore;

      // 欺诈检测
      const fraudDetection = await this.detectReferralFraud(referrerId, refereeId, referralData);
      validationResults.fraudDetections = fraudDetection.detections;
      validationResults.overallRiskScore += fraudDetection.totalRiskScore;

      // 计算最终风险分数
      validationResults.overallRiskScore = Math.min(validationResults.overallRiskScore, 100);

      // 生成建议
      validationResults.recommendations = this.generateRecommendations(validationResults);

      // 如果风险分数过高，标记为无效
      if (validationResults.overallRiskScore > this.riskThresholds.high) {
        validationResults.valid = false;
      }

      return validationResults;

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate referral relationship:', error);
      return {
        valid: false,
        overallRiskScore: 100,
        validations: [],
        fraudDetections: [],
        recommendations: ['验证过程中发生错误，请稍后重试']
      };
    }
  }

  /**
   * 创建推荐记录
   * @param {Object} referralData - 推荐数据
   * @returns {Object} 创建的推荐记录
   */
  async createReferral(referralData) {
    try {
      const {
        referrerId,
        refereeId,
        referralCode,
        type = 'user',
        source = null,
        campaign = null,
        referralData: additionalData = {}
      } = referralData;

      // 检查是否已存在推荐关系
      const existingReferral = await db('referrals')
        .where({
          referrer_id: referrerId,
          referee_id: refereeId
        })
        .first();

      if (existingReferral) {
        throw AppError.create(ERROR_CODES.DUPLICATE_RESOURCE, {
          message: '推荐关系已存在'
        });
      }

      // 验证推荐关系
      const validation = await this.validateReferralRelationship(referrerId, refereeId, additionalData);
      if (!validation.valid) {
        throw AppError.create(ERROR_CODES.VALIDATION_FAILED, {
          reason: validation.recommendations.join('; '),
          riskScore: validation.overallRiskScore
        });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天后过期

      const [referral] = await db('referrals')
        .insert({
          referrer_id: referrerId,
          referee_id: refereeId,
          referral_code: referralCode,
          status: 'pending',
          type,
          source,
          campaign,
          referral_data: additionalData,
          expires_at: expiresAt,
          created_at: now,
          updated_at: now
        })
        .returning('*');

      // 创建推荐链记录
      await this.createReferralChain(referrerId, refereeId);

      // 记录验证结果
      await this.recordValidationResults(referral.id, validation);

      // 检测到的欺诈记录
      if (validation.fraudDetections.length > 0) {
        await this.recordFraudDetections(referral.id, validation.fraudDetections);
      }

      logger.info(`[ReferralValidationService] Created referral: ${referrerId} -> ${refereeId}`);

      return referral;

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to create referral:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 验证活跃用户资格
   * @param {Object} user - 用户信息
   * @returns {Object} 验证结果
   */
  async validateActiveUserQualification(user) {
    try {
      const now = new Date();
      const registrationDate = new Date(user.created_at);
      const daysSinceRegistration = Math.floor((now - registrationDate) / (1000 * 60 * 60 * 24));

      // 注册时间至少7天
      if (daysSinceRegistration < 7) {
        return {
          valid: false,
          reason: '注册时间不足7天',
          riskScore: 70,
          qualificationData: {
            registrationDays: daysSinceRegistration,
            requiredDays: 7
          }
        };
      }

      // 检查登录活跃度
      const loginCount = user.login_count || 0;
      if (loginCount < 5) {
        return {
          valid: false,
          reason: '登录次数不足',
          riskScore: 60,
          qualificationData: {
            loginCount,
            requiredLogins: 5
          }
        };
      }

      // 检查最后登录时间
      if (user.last_login_at) {
        const lastLogin = new Date(user.last_login_at);
        const daysSinceLastLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));

        if (daysSinceLastLogin > 30) {
          return {
            valid: false,
            reason: '超过30天未登录',
            riskScore: 50,
            qualificationData: {
              daysSinceLastLogin,
              maxDays: 30
            }
          };
        }
      }

      return {
        valid: true,
        reason: '活跃用户资格验证通过',
        riskScore: 10,
        qualificationData: {
          registrationDays: daysSinceRegistration,
          loginCount,
          lastLoginAt: user.last_login_at
        }
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate active user qualification:', error);
      return {
        valid: false,
        reason: '验证失败',
        riskScore: 80
      };
    }
  }

  /**
   * 验证高级会员资格
   * @param {Object} user - 用户信息
   * @returns {Object} 验证结果
   */
  async validatePremiumMemberQualification(user) {
    try {
      // 检查是否为付费会员
      const membership = await db('user_memberships')
        .where('user_id', user.id)
        .where('status', 'active')
        .first();

      if (!membership) {
        return {
          valid: false,
          reason: '不是付费会员',
          riskScore: 60,
          qualificationData: {
            hasActiveMembership: false
          }
        };
      }

      return {
        valid: true,
        reason: '高级会员资格验证通过',
        riskScore: 5,
        qualificationData: {
          membershipType: membership.membership_type,
          expiresAt: membership.expires_at
        }
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate premium member qualification:', error);
      return {
        valid: false,
        reason: '验证失败',
        riskScore: 70
      };
    }
  }

  /**
   * 验证已认证用户资格
   * @param {Object} user - 用户信息
   * @returns {Object} 验证结果
   */
  async validateVerifiedUserQualification(user) {
    try {
      // 检查邮箱验证
      if (!user.email_verified) {
        return {
          valid: false,
          reason: '邮箱未验证',
          riskScore: 40,
          qualificationData: {
            emailVerified: false
          }
        };
      }

      // 检查手机验证
      if (!user.phone_verified) {
        return {
          valid: false,
          reason: '手机号未验证',
          riskScore: 30,
          qualificationData: {
            phoneVerified: false
          }
        };
      }

      // 检查认证级别
      if (user.verification_level !== 'verified' && user.verification_level !== 'premium') {
        return {
          valid: false,
          reason: '用户未完成身份认证',
          riskScore: 50,
          qualificationData: {
            verificationLevel: user.verification_level
          }
        };
      }

      return {
        valid: true,
        reason: '已认证用户资格验证通过',
        riskScore: 5,
        qualificationData: {
          verificationLevel: user.verification_level,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified
        }
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate verified user qualification:', error);
      return {
        valid: false,
        reason: '验证失败',
        riskScore: 60
      };
    }
  }

  /**
   * 验证内容创作者资格
   * @param {Object} user - 用户信息
   * @returns {Object} 验证结果
   */
  async validateContentCreatorQualification(user) {
    try {
      // 检查是否有创作的内容
      const contentCount = await db('user_contents')
        .where('user_id', user.id)
        .count('* as count')
        .first();

      const count = parseInt(contentCount.count) || 0;
      if (count < 5) {
        return {
          valid: false,
          reason: '创作内容不足',
          riskScore: 50,
          qualificationData: {
            contentCount: count,
            requiredCount: 5
          }
        };
      }

      return {
        valid: true,
        reason: '内容创作者资格验证通过',
        riskScore: 10,
        qualificationData: {
          contentCount: count
        }
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate content creator qualification:', error);
      return {
        valid: false,
        reason: '验证失败',
        riskScore: 70
      };
    }
  }

  /**
   * 验证合作伙伴资格
   * @param {Object} user - 用户信息
   * @returns {Object} 验证结果
   */
  async validatePartnerQualification(user) {
    try {
      // 检查是否在合作伙伴列表中
      const partnership = await db('partnerships')
        .where('user_id', user.id)
        .where('status', 'active')
        .first();

      if (!partnership) {
        return {
          valid: false,
          reason: '不是合作伙伴',
          riskScore: 60,
          qualificationData: {
            hasActivePartnership: false
          }
        };
      }

      return {
        valid: true,
        reason: '合作伙伴资格验证通过',
        riskScore: 0,
        qualificationData: {
          partnershipType: partnership.partnership_type,
          partnershipLevel: partnership.level
        }
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate partner qualification:', error);
      return {
        valid: false,
        reason: '验证失败',
        riskScore: 80
      };
    }
  }

  /**
   * 执行基础验证
   * @param {string} referrerId - 推荐人ID
   * @param {string} refereeId - 被推荐人ID
   * @returns {Object} 验证结果
   */
  async performBasicValidation(referrerId, refereeId) {
    try {
      // 检查是否为同一用户
      if (referrerId === refereeId) {
        return {
          valid: false,
          type: 'basic',
          reason: '不能推荐自己',
          riskScore: 100
        };
      }

      // 检查被推荐人是否已存在
      const referee = await db('users').where('id', refereeId).first();
      if (!referee) {
        return {
          valid: false,
          type: 'basic',
          reason: '被推荐人不存在',
          riskScore: 100
        };
      }

      // 检查推荐人是否已存在
      const referrer = await db('users').where('id', referrerId).first();
      if (!referrer) {
        return {
          valid: false,
          type: 'basic',
          reason: '推荐人不存在',
          riskScore: 100
        };
      }

      return {
        valid: true,
        type: 'basic',
        reason: '基础验证通过',
        riskScore: 0
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to perform basic validation:', error);
      return {
        valid: false,
        type: 'basic',
        reason: '基础验证失败',
        riskScore: 50
      };
    }
  }

  /**
   * 验证时间窗口
   * @param {string} referrerId - 推荐人ID
   * @param {string} refereeId - 被推荐人ID
   * @returns {Object} 验证结果
   */
  async validateTimeWindow(referrerId, refereeId) {
    try {
      const referee = await db('users').where('id', refereeId).first();
      const now = new Date();
      const registrationTime = new Date(referee.created_at);
      const hoursSinceRegistration = (now - registrationTime) / (1000 * 60 * 60);

      // 检查是否在24小时内注册（可疑）
      if (hoursSinceRegistration < 24) {
        return {
          valid: true,
          type: 'time_window',
          reason: '被推荐人注册时间过短，需要进一步验证',
          riskScore: 40
        };
      }

      // 检查推荐人和被推荐人的注册时间差
      const referrer = await db('users').where('id', referrerId).first();
      const referrerRegistrationTime = new Date(referrer.created_at);
      const registrationTimeDiff = Math.abs(registrationTime - referrerRegistrationTime) / (1000 * 60 * 60 * 24);

      if (registrationTimeDiff < 7) {
        return {
          valid: true,
          type: 'time_window',
          reason: '推荐人和被推荐人注册时间过近',
          riskScore: 30
        };
      }

      return {
        valid: true,
        type: 'time_window',
        reason: '时间窗口验证通过',
        riskScore: 0
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate time window:', error);
      return {
        valid: true,
        type: 'time_window',
        reason: '时间窗口验证失败',
        riskScore: 20
      };
    }
  }

  /**
   * 验证设备和IP
   * @param {string} referrerId - 推荐人ID
   * @param {string} refereeId - 被推荐人ID
   * @param {Object} referralData - 推荐数据
   * @returns {Object} 验证结果
   */
  async validateDeviceAndIP(referrerId, refereeId, referralData) {
    try {
      const currentIP = referralData.ipAddress;
      const currentUserAgent = referralData.userAgent;

      if (!currentIP) {
        return {
          valid: true,
          type: 'device_ip',
          reason: '缺少IP信息，跳过设备验证',
          riskScore: 10
        };
      }

      // 检查推荐人是否使用过相同IP
      const referrerLoginHistory = await db('user_login_history')
        .where('user_id', referrerId)
        .where('ip_address', currentIP)
        .first();

      if (referrerLoginHistory) {
        return {
          valid: true,
          type: 'device_ip',
          reason: '检测到相同IP地址，需要进一步验证',
          riskScore: 50
        };
      }

      // 检查设备指纹
      if (currentUserAgent) {
        const referrerDeviceHistory = await db('user_login_history')
          .where('user_id', referrerId)
          .where('user_agent', currentUserAgent)
          .first();

        if (referrerDeviceHistory) {
          return {
            valid: true,
            type: 'device_ip',
            reason: '检测到相同设备，需要进一步验证',
            riskScore: 45
          };
        }
      }

      return {
        valid: true,
        type: 'device_ip',
        reason: '设备和IP验证通过',
        riskScore: 0
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate device and IP:', error);
      return {
        valid: true,
        type: 'device_ip',
        reason: '设备验证失败',
        riskScore: 15
      };
    }
  }

  /**
   * 验证行为模式
   * @param {string} referrerId - 推荐人ID
   * @param {string} refereeId - 被推荐人ID
   * @returns {Object} 验证结果
   */
  async validateBehaviorPattern(referrerId, refereeId) {
    try {
      // 检查推荐人的推荐历史
      const referrerReferralCount = await db('referrals')
        .where('referrer_id', referrerId)
        .count('* as count')
        .first();

      const count = parseInt(referrerReferralCount.count) || 0;

      // 如果推荐人推荐数量过多，可能存在异常
      if (count > 50) {
        return {
          valid: true,
          type: 'behavior',
          reason: '推荐人推荐数量异常',
          riskScore: 35
        };
      }

      // 检查推荐成功率
      const successfulReferrals = await db('referrals')
        .where('referrer_id', referrerId)
        .where('status', 'completed')
        .count('* as count')
        .first();

      const successCount = parseInt(successfulReferrals.count) || 0;
      const successRate = count > 0 ? (successCount / count) * 100 : 0;

      if (successRate < 20) {
        return {
          valid: true,
          type: 'behavior',
          reason: '推荐成功率过低',
          riskScore: 25
        };
      }

      return {
        valid: true,
        type: 'behavior',
        reason: '行为模式验证通过',
        riskScore: 0
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to validate behavior pattern:', error);
      return {
        valid: true,
        type: 'behavior',
        reason: '行为模式验证失败',
        riskScore: 20
      };
    }
  }

  /**
   * 检测推荐欺诈
   * @param {string} referrerId - 推荐人ID
   * @param {string} refereeId - 被推荐人ID
   * @param {Object} referralData - 推荐数据
   * @returns {Object} 欺诈检测结果
   */
  async detectReferralFraud(referrerId, refereeId, referralData) {
    try {
      const detections = [];
      let totalRiskScore = 0;

      // 自我推荐检测
      const selfReferralDetection = await this.detectSelfReferral(referrerId, refereeId, referralData);
      if (selfReferralDetection.detected) {
        detections.push(selfReferralDetection);
        totalRiskScore += selfReferralDetection.riskScore;
      }

      // 虚假账户检测
      const fakeAccountDetection = await this.detectFakeAccount(refereeId);
      if (fakeAccountDetection.detected) {
        detections.push(fakeAccountDetection);
        totalRiskScore += fakeAccountDetection.riskScore;
      }

      // 激励滥用检测
      const incentiveAbuseDetection = await this.detectIncentiveAbuse(referrerId);
      if (incentiveAbuseDetection.detected) {
        detections.push(incentiveAbuseDetection);
        totalRiskScore += incentiveAbuseDetection.riskScore;
      }

      return {
        detections,
        totalRiskScore: Math.min(totalRiskScore, 100)
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to detect referral fraud:', error);
      return {
        detections: [],
        totalRiskScore: 50
      };
    }
  }

  /**
   * 检测自我推荐
   * @param {string} referrerId - 推荐人ID
   * @param {string} refereeId - 被推荐人ID
   * @param {Object} referralData - 推荐数据
   * @returns {Object} 检测结果
   */
  async detectSelfReferral(referrerId, refereeId, referralData) {
    try {
      // 检查相同设备或IP
      if (referralData.ipAddress) {
        const referrerRecentLogin = await db('user_login_history')
          .where('user_id', referrerId)
          .where('ip_address', referralData.ipAddress)
          .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
          .first();

        if (referrerRecentLogin) {
          return {
            detected: true,
            fraudType: 'ip_mismatch',
            riskLevel: 'high',
            riskScore: 70,
            reason: '检测到相同IP地址，可能为自我推荐',
            evidence: {
              ipAddress: referralData.ipAddress,
              referrerLoginTime: referrerRecentLogin.created_at
            }
          };
        }
      }

      // 检查设备指纹
      if (referralData.userAgent) {
        const referrerDeviceLogin = await db('user_login_history')
          .where('user_id', referrerId)
          .where('user_agent', referralData.userAgent)
          .where('created_at', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          .first();

        if (referrerDeviceLogin) {
          return {
            detected: true,
            fraudType: 'device_fingerprint',
            riskLevel: 'medium',
            riskScore: 60,
            reason: '检测到相同设备，可能为自我推荐',
            evidence: {
              userAgent: referralData.userAgent,
              referrerLoginTime: referrerDeviceLogin.created_at
            }
          };
        }
      }

      return {
        detected: false,
        fraudType: 'self_referral',
        riskLevel: 'low',
        riskScore: 0
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to detect self referral:', error);
      return {
        detected: false,
        fraudType: 'self_referral',
        riskLevel: 'low',
        riskScore: 20
      };
    }
  }

  /**
   * 检测虚假账户
   * @param {string} userId - 用户ID
   * @returns {Object} 检测结果
   */
  async detectFakeAccount(userId) {
    try {
      const user = await db('users').where('id', userId).first();
      if (!user) {
        return {
          detected: false,
          fraudType: 'fake_account',
          riskLevel: 'low',
          riskScore: 0
        };
      }

      const now = new Date();
      const registrationTime = new Date(user.created_at);
      const daysSinceRegistration = (now - registrationTime) / (1000 * 60 * 60 * 24);

      // 检查账户年龄
      if (daysSinceRegistration < 1) {
        return {
          detected: true,
          fraudType: 'fake_account',
          riskLevel: 'high',
          riskScore: 80,
          reason: '账户注册时间过短',
          evidence: {
            registrationDays: daysSinceRegistration
          }
        };
      }

      // 检查资料完整度
      const profileCompleteness = await db('user_profile_completeness')
        .where('user_id', userId)
        .first();

      if (profileCompleteness && profileCompleteness.completeness_percentage < 20) {
        return {
          detected: true,
          fraudType: 'fake_account',
          riskLevel: 'medium',
          riskScore: 50,
          reason: '资料完整度过低',
          evidence: {
            completenessPercentage: profileCompleteness.completeness_percentage
          }
        };
      }

      return {
        detected: false,
        fraudType: 'fake_account',
        riskLevel: 'low',
        riskScore: 0
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to detect fake account:', error);
      return {
        detected: false,
        fraudType: 'fake_account',
        riskLevel: 'low',
        riskScore: 20
      };
    }
  }

  /**
   * 检测激励滥用
   * @param {string} referrerId - 推荐人ID
   * @returns {Object} 检测结果
   */
  async detectIncentiveAbuse(referrerId) {
    try {
      // 检查最近30天的推荐数量
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentReferrals = await db('referrals')
        .where('referrer_id', referrerId)
        .where('created_at', '>', thirtyDaysAgo)
        .count('* as count')
        .first();

      const count = parseInt(recentReferrals.count) || 0;

      if (count > 100) {
        return {
          detected: true,
          fraudType: 'incentive_abuse',
          riskLevel: 'critical',
          riskScore: 90,
          reason: '30天内推荐数量异常',
          evidence: {
            recentReferralCount: count,
            period: '30天'
          }
        };
      }

      // 检查失败率
      const failedReferrals = await db('referrals')
        .where('referrer_id', referrerId)
        .where('status', 'failed')
        .where('created_at', '>', thirtyDaysAgo)
        .count('* as count')
        .first();

      const failedCount = parseInt(failedReferrals.count) || 0;
      const failureRate = count > 0 ? (failedCount / count) * 100 : 0;

      if (failureRate > 80) {
        return {
          detected: true,
          fraudType: 'incentive_abuse',
          riskLevel: 'high',
          riskScore: 75,
          reason: '推荐失败率过高',
          evidence: {
            failureRate,
            failedCount,
            totalCount: count
          }
        };
      }

      return {
        detected: false,
        fraudType: 'incentive_abuse',
        riskLevel: 'low',
        riskScore: 0
      };

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to detect incentive abuse:', error);
      return {
        detected: false,
        fraudType: 'incentive_abuse',
        riskLevel: 'low',
        riskScore: 20
      };
    }
  }

  /**
   * 创建推荐链
   * @param {string} referrerId - 推荐人ID
   * @param {string} refereeId - 被推荐人ID
   */
  async createReferralChain(referrerId, refereeId) {
    try {
      // 查找推荐人的推荐链
      const referrerChain = await db('referral_chains')
        .where('user_id', referrerId)
        .first();

      let rootReferrerId = referrerId;
      let parentReferrerId = referrerId;
      let chainLevel = 1;
      let chainPath = [referrerId];

      if (referrerChain) {
        rootReferrerId = referrerChain.root_referrer_id;
        parentReferrerId = referrerId;
        chainLevel = referrerChain.chain_level + 1;
        chainPath = [...JSON.parse(referrerChain.chain_path || '[]'), refereeId];
      }

      // 创建新的推荐链记录
      await db('referral_chains')
        .insert({
          root_referrer_id: rootReferrerId,
          user_id: refereeId,
          parent_referrer_id: parentReferrerId,
          chain_level: chainLevel,
          chain_path: JSON.stringify(chainPath),
          is_active: true,
          joined_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        })
        .onConflict('user_id')
        .merge({
          root_referrer_id: rootReferrerId,
          parent_referrer_id: parentReferrerId,
          chain_level: chainLevel,
          chain_path: JSON.stringify(chainPath),
          is_active: true,
          updated_at: new Date()
        });

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to create referral chain:', error);
    }
  }

  /**
   * 记录验证结果
   * @param {string} referralId - 推荐ID
   * @param {Object} validationResults - 验证结果
   */
  async recordValidationResults(referralId, validationResults) {
    try {
      const validations = validationResults.validations || [];

      for (const validation of validations) {
        await db('referral_validations')
          .insert({
            referral_id: referralId,
            rule_id: 'default', // 使用默认规则ID
            validation_type: validation.type,
            status: validation.valid ? 'passed' : 'failed',
            validation_data: validation,
            result_data: validation,
            score: validation.riskScore || 0,
            validated_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          });
      }

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to record validation results:', error);
    }
  }

  /**
   * 记录欺诈检测结果
   * @param {string} referralId - 推荐ID
   * @param {Array} fraudDetections - 欺诈检测结果
   */
  async recordFraudDetections(referralId, fraudDetections) {
    try {
      for (const detection of fraudDetections) {
        await db('referral_fraud_detection')
          .insert({
            referral_id: referralId,
            fraud_type: detection.fraudType,
            risk_level: detection.riskLevel,
            risk_score: detection.riskScore,
            detection_data: detection,
            evidence: detection.evidence,
            detection_reason: detection.reason,
            status: 'detected',
            detected_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          });
      }

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to record fraud detections:', error);
    }
  }

  /**
   * 更新推荐人资格
   * @param {string} userId - 用户ID
   * @param {string} qualificationType - 资格类型
   * @param {Object} result - 验证结果
   */
  async updateReferrerQualification(userId, qualificationType, result) {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后过期

      await db('referrer_qualifications')
        .insert({
          user_id: userId,
          qualification_type: qualificationType,
          is_qualified: result.valid,
          qualification_data: result.qualificationData,
          qualified_at: result.valid ? now : null,
          expires_at: result.valid ? expiresAt : null,
          last_checked_at: now,
          created_at: now,
          updated_at: now
        })
        .onConflict(['user_id', 'qualification_type'])
        .merge({
          is_qualified: result.valid,
          qualification_data: result.qualificationData,
          qualified_at: result.valid ? now : null,
          expires_at: result.valid ? expiresAt : null,
          last_checked_at: now,
          updated_at: now
        });

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to update referrer qualification:', error);
    }
  }

  /**
   * 生成建议
   * @param {Object} validationResults - 验证结果
   * @returns {Array} 建议列表
   */
  generateRecommendations(validationResults) {
    const recommendations = [];

    validationResults.validations.forEach(validation => {
      if (!validation.valid && validation.reason) {
        recommendations.push(validation.reason);
      }
    });

    validationResults.fraudDetections.forEach(detection => {
      if (detection.reason) {
        recommendations.push(`风险提示: ${detection.reason}`);
      }
    });

    if (validationResults.overallRiskScore > this.riskThresholds.medium) {
      recommendations.push('推荐关系存在较高风险，建议人工审核');
    }

    if (recommendations.length === 0) {
      recommendations.push('验证通过，推荐关系正常');
    }

    return recommendations;
  }

  /**
   * 初始化默认验证规则
   */
  async initializeDefaultRules() {
    try {
      const defaultRules = [
        {
          name: '基础验证规则',
          description: '验证推荐人和被推荐人的基本信息',
          rule_type: 'custom',
          conditions: { type: 'basic_validation' },
          actions: { required: true },
          is_active: true,
          priority: 100
        },
        {
          name: '时间窗口验证规则',
          description: '验证注册时间是否合理',
          rule_type: 'custom',
          conditions: { type: 'time_window_validation' },
          actions: { required: false },
          is_active: true,
          priority: 90
        },
        {
          name: '设备IP验证规则',
          description: '验证设备和IP地址是否存在异常',
          rule_type: 'custom',
          conditions: { type: 'device_ip_validation' },
          actions: { required: false },
          is_active: true,
          priority: 80
        }
      ];

      for (const rule of defaultRules) {
        await db('referral_validation_rules')
          .insert({
            ...rule,
            created_at: new Date(),
            updated_at: new Date()
          })
          .onConflict('name')
          .ignore();
      }

    } catch (error) {
      logger.error('[ReferralValidationService] Failed to initialize default rules:', error);
    }
  }

  /**
   * 关闭服务
   */
  async close() {
    try {
      this.initialized = false;
      logger.info('[ReferralValidationService] Referral validation service closed');
    } catch (error) {
      logger.error('[ReferralValidationService] Error closing referral validation service:', error);
    }
  }
}

module.exports = new ReferralValidationService();