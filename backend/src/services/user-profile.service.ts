import logger from '../utils/logger.js';
import { db } from '../config/database.js';
import cacheService from './cache.service.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';

/**
 * 用户信息对象
 */
interface UserRecord {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  verification_level: number;
  profile_updated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  email: string | null;
  phone: string | null;
  birth_date: Date | null;
  gender: string | null;
  country: string | null;
  city: string | null;
  occupation: string | null;
  company: string | null;
  industry: string | null;
  education_level: string | null;
  university: string | null;
  interests: string | null;
  language: string | null;
  account_status: string;
  login_count: number;
  last_login_at: Date | null;
  profile_public: boolean;
  show_email: boolean;
  show_phone: boolean;
  privacy_settings: Record<string, unknown> | null;
  notification_preferences: Record<string, unknown> | null;
  ui_preferences: Record<string, unknown> | null;
  [key: string]: unknown;
}

type BasicProfileInfo = {
  id: string;
  username: string;
  profile_updated_at?: Date | string | null;
  updated_at?: Date | string | null;
  profile_public?: boolean;
  show_email?: boolean;
  show_phone?: boolean;
  privacy_settings?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type CountRow = {
  count?: string | number | bigint | null;
};

const parseCount = (row?: CountRow): number => {
  if (!row || row.count === null || row.count === undefined) return 0;
  if (typeof row.count === 'number') return row.count;
  if (typeof row.count === 'bigint') return Number(row.count);
  const parsed = Number(row.count);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * 完整度权重配置
 */
interface CompletenessWeights {
  basicInfo: number;
  contactInfo: number;
  education: number;
  work: number;
  skills: number;
  social: number;
}

/**
 * 完整度得分对象
 */
interface CompletenessScores {
  basicInfo: number;
  contactInfo: number;
  education: number;
  work: number;
  skills: number;
  social: number;
}

/**
 * 缺失字段对象
 */
interface MissingField {
  category: string;
  field: string;
  label: string;
}

/**
 * 建议对象
 */
interface Suggestion {
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
}

/**
 * 完整度计算结果
 */
interface CompletenessResult {
  scores: CompletenessScores;
  totalScore: number;
  completenessPercentage: number;
  missingFields: MissingField[];
  suggestions: Suggestion[];
}

/**
 * 用户资料服务类
 *
 * 管理用户资料的完整性和展示：
 * - 用户基础信息管理
 * - 教育和工作经历管理
 * - 技能和兴趣标签管理
 * - 社交媒体链接管理
 * - 资料完整度计算
 * - 隐私设置控制
 */
class UserProfileService {
  private initialized: boolean;
  private cachePrefix: string;
  private cacheTTL: number;
  private completenessWeights: CompletenessWeights;

  constructor() {
    this.initialized = false;
    this.cachePrefix = 'user_profile:';
    this.cacheTTL = 600; // 10分钟缓存
    this.completenessWeights = {
      basicInfo: 25, // 基础信息权重 25%
      contactInfo: 20, // 联系信息权重 20%
      education: 15, // 教育信息权重 15%
      work: 15, // 工作经历权重 15%
      skills: 15, // 技能权重 15%
      social: 10 // 社交信息权重 10%
    };
  }

  /**
   * 初始化用户资料服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('[UserProfileService] Initializing user profile service...');

      // 测试数据库连接
      await db('users').select(1).first();

      this.initialized = true;
      logger.info('[UserProfileService] User profile service initialized successfully');
    } catch (error) {
      logger.error('[UserProfileService] Failed to initialize user profile service:', error);
      throw error;
    }
  }

  /**
   * 获取用户完整资料
   * @param userId - 用户ID
   * @param viewerId - 查看者ID（可选）
   * @returns 用户完整资料
   */
  async getUserFullProfile(
    userId: string,
    viewerId: string | null = null
  ): Promise<Record<string, unknown>> {
    try {
      const cacheKey = `${this.cachePrefix}full:${userId}:${viewerId || 'public'}`;
      const cached = await cacheService.get<Record<string, unknown>>(cacheKey);
      if (cached) {
        return cached;
      }

      // 并行获取用户信息
      const [basicInfo, socialLinks, education, workExperience, skills, interests, completeness] =
        await Promise.all([
          this.getUserBasicInfo(userId, viewerId),
          this.getUserSocialLinks(userId, viewerId),
          this.getUserEducation(userId, viewerId),
          this.getUserWorkExperience(userId, viewerId),
          this.getUserSkills(userId, viewerId),
          this.getUserInterests(userId, viewerId),
          this.getUserProfileCompleteness(userId)
        ]);

      const profile: Record<string, unknown> = {
        basicInfo,
        socialLinks,
        education,
        workExperience,
        skills,
        interests,
        completeness,
        privacy: this.getPrivacySettings(basicInfo),
        lastUpdated: basicInfo.profile_updated_at || basicInfo.updated_at || null
      };

      // 记录查看日志
      if (viewerId && viewerId !== userId) {
        await this.recordProfileView(userId, viewerId);
      }

      await cacheService.set(cacheKey, profile, this.cacheTTL);
      return profile;
    } catch (error) {
      logger.error('[UserProfileService] Failed to get user full profile:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取用户基础信息
   * @param userId - 用户ID
   * @param viewerId - 查看者ID（可选）
   * @returns 用户基础信息
   */
  async getUserBasicInfo(
    userId: string,
    viewerId: string | null = null
  ): Promise<BasicProfileInfo> {
    try {
      const user = (await db('users').where('id', userId).first()) as UserRecord | undefined;

      if (!user) {
        throw AppError.create(ERROR_CODES.USER_NOT_FOUND, { userId });
      }

      // 检查隐私设置
      const isOwner = viewerId === userId;
      const publicInfo: BasicProfileInfo = {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
        banner_url: user.banner_url,
        bio: user.bio,
        verification_level: user.verification_level,
        profile_updated_at: user.profile_updated_at,
        updated_at: user.updated_at,
        created_at: user.created_at,
        profile_public: user.profile_public,
        show_email: user.show_email,
        show_phone: user.show_phone,
        privacy_settings: user.privacy_settings || {}
      };

      // 如果是本人或资料公开，返回更多信息
      if (isOwner || user.profile_public) {
        return {
          ...publicInfo,
          email: user.show_email || isOwner ? user.email : null,
          phone: user.show_phone || isOwner ? user.phone : null,
          birth_date: isOwner ? user.birth_date : null,
          gender: user.gender,
          country: user.country,
          city: user.city,
          occupation: user.occupation,
          company: user.company,
          industry: user.industry,
          education_level: user.education_level,
          university: user.university,
          interests: user.interests,
          language: user.language,
          account_status: user.account_status,
          login_count: user.login_count,
          last_login_at: user.last_login_at
        };
      }

      return publicInfo;
    } catch (error) {
      logger.error('[UserProfileService] Failed to get user basic info:', error);
      throw error;
    }
  }

  /**
   * 更新用户基础信息
   * @param userId - 用户ID
   * @param updateData - 更新数据
   * @returns 更新后的用户信息
   */
  async updateUserBasicInfo(
    userId: string,
    updateData: Record<string, unknown>
  ): Promise<UserRecord> {
    try {
      // 验证更新数据
      const validFields = [
        'first_name',
        'last_name',
        'birth_date',
        'gender',
        'phone',
        'email',
        'country',
        'state',
        'city',
        'address',
        'postal_code',
        'occupation',
        'company',
        'industry',
        'education_level',
        'university',
        'interests',
        'bio',
        'avatar_url',
        'banner_url',
        'language',
        'timezone',
        'profile_public',
        'show_email',
        'show_phone',
        'privacy_settings',
        'notification_preferences',
        'ui_preferences'
      ];

      const filteredData: Record<string, unknown> = {};
      for (const field of validFields) {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      }

      if (Object.keys(filteredData).length === 0) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          message: '没有有效的更新字段'
        });
      }

      filteredData.profile_updated_at = new Date();
      filteredData.updated_at = new Date();

      const [updatedUser] = await db('users')
        .where('id', userId)
        .update(filteredData)
        .returning('*');

      if (!updatedUser) {
        throw AppError.create(ERROR_CODES.USER_NOT_FOUND, { userId });
      }

      // 清除相关缓存
      await this.clearUserProfileCache(userId);

      // 重新计算完整度
      await this.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileService] User ${userId} updated basic profile`);

      return updatedUser;
    } catch (error) {
      logger.error('[UserProfileService] Failed to update user basic info:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 添加教育经历
   * @param userId - 用户ID
   * @param educationData - 教育经历数据
   * @returns 添加的教育经历
   */
  async addEducation(
    userId: string,
    educationData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const {
        school_name,
        degree,
        major,
        education_level,
        start_date,
        end_date,
        is_current,
        description,
        gpa,
        activities,
        achievements,
        is_public
      } = educationData;

      const [education] = await db('user_education')
        .insert({
          user_id: userId,
          school_name,
          degree,
          major,
          education_level,
          start_date,
          end_date,
          is_current: is_current || false,
          description,
          gpa,
          activities,
          achievements,
          is_public: is_public !== false,
          display_order: await this.getNextDisplayOrder(userId, 'education'),
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      // 清除缓存
      await this.clearUserProfileCache(userId);
      await this.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileService] User ${userId} added education: ${school_name}`);

      return education;
    } catch (error) {
      logger.error('[UserProfileService] Failed to add education:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 更新教育经历
   * @param userId - 用户ID
   * @param educationId - 教育经历ID
   * @param updateData - 更新数据
   * @returns 更新后的教育经历
   */
  async updateEducation(
    userId: string,
    educationId: string,
    updateData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const education = await db('user_education')
        .where({
          id: educationId,
          user_id: userId
        })
        .first();

      if (!education) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '教育经历不存在'
        });
      }

      const [updatedEducation] = await db('user_education')
        .where({
          id: educationId,
          user_id: userId
        })
        .update({
          ...updateData,
          updated_at: new Date()
        })
        .returning('*');

      await this.clearUserProfileCache(userId);
      await this.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileService] User ${userId} updated education: ${educationId}`);

      return updatedEducation;
    } catch (error) {
      logger.error('[UserProfileService] Failed to update education:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 删除教育经历
   * @param userId - 用户ID
   * @param educationId - 教育经历ID
   * @returns 是否删除成功
   */
  async deleteEducation(userId: string, educationId: string): Promise<boolean> {
    try {
      const deleted = await db('user_education')
        .where({
          id: educationId,
          user_id: userId
        })
        .del();

      if (deleted) {
        await this.clearUserProfileCache(userId);
        await this.calculateProfileCompleteness(userId);
        logger.info(`[UserProfileService] User ${userId} deleted education: ${educationId}`);
      }

      return deleted > 0;
    } catch (error) {
      logger.error('[UserProfileService] Failed to delete education:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 添加工作经历
   * @param userId - 用户ID
   * @param workData - 工作经历数据
   * @returns 添加的工作经历
   */
  async addWorkExperience(
    userId: string,
    workData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const {
        company_name,
        job_title,
        department,
        employment_type,
        start_date,
        end_date,
        is_current,
        location,
        description,
        responsibilities,
        achievements,
        salary_start,
        salary_end,
        currency,
        skills,
        is_public
      } = workData;

      const [workExperience] = await db('user_work_experience')
        .insert({
          user_id: userId,
          company_name,
          job_title,
          department,
          employment_type,
          start_date,
          end_date,
          is_current: is_current || false,
          location,
          description,
          responsibilities,
          achievements,
          salary_start,
          salary_end,
          currency: currency || 'CNY',
          skills,
          is_public: is_public !== false,
          display_order: await this.getNextDisplayOrder(userId, 'work'),
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      await this.clearUserProfileCache(userId);
      await this.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileService] User ${userId} added work experience: ${company_name}`);

      return workExperience;
    } catch (error) {
      logger.error('[UserProfileService] Failed to add work experience:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 添加技能
   * @param userId - 用户ID
   * @param skillData - 技能数据
   * @returns 添加的技能
   */
  async addSkill(
    userId: string,
    skillData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const { skill_name, skill_level, experience_years, description, certifications, is_public } =
        skillData;

      // 检查技能是否已存在
      const existingSkill = await db('user_skills')
        .where({
          user_id: userId,
          skill_name: skill_name
        })
        .first();

      if (existingSkill) {
        throw AppError.create(ERROR_CODES.DUPLICATE_VALUE, {
          message: '技能已存在'
        });
      }

      const [skill] = await db('user_skills')
        .insert({
          user_id: userId,
          skill_name,
          skill_level,
          experience_years: experience_years || 0,
          description,
          certifications,
          is_public: is_public !== false,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      await this.clearUserProfileCache(userId);
      await this.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileService] User ${userId} added skill: ${skill_name}`);

      return skill;
    } catch (error) {
      logger.error('[UserProfileService] Failed to add skill:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取用户社交媒体链接
   * @param userId - 用户ID
   * @param viewerId - 查看者ID（可选）
   * @returns 社交媒体链接列表
   */
  async getUserSocialLinks(
    userId: string,
    viewerId: string | null = null
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const isOwner = viewerId === userId;

      let query = db('user_social_links').where('user_id', userId);

      if (!isOwner) {
        query = query.where('is_public', true);
      }

      const links = await query.orderBy('linked_at', 'desc');

      return links.map((link) => ({
        id: link.id,
        platform: link.platform,
        username: link.username,
        display_name: link.display_name,
        profile_url: link.profile_url,
        avatar_url: link.avatar_url,
        is_verified: link.is_verified,
        followers_count: link.followers_count,
        linked_at: link.linked_at
      }));
    } catch (error) {
      logger.error('[UserProfileService] Failed to get user social links:', error);
      throw error;
    }
  }

  /**
   * 获取用户教育经历
   * @param userId - 用户ID
   * @param viewerId - 查看者ID（可选）
   * @returns 教育经历列表
   */
  async getUserEducation(
    userId: string,
    viewerId: string | null = null
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const isOwner = viewerId === userId;

      let query = db('user_education').where('user_id', userId);

      if (!isOwner) {
        query = query.where('is_public', true);
      }

      return await query.orderBy('display_order', 'asc');
    } catch (error) {
      logger.error('[UserProfileService] Failed to get user education:', error);
      throw error;
    }
  }

  /**
   * 获取用户工作经历
   * @param userId - 用户ID
   * @param viewerId - 查看者ID（可选）
   * @returns 工作经历列表
   */
  async getUserWorkExperience(
    userId: string,
    viewerId: string | null = null
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const isOwner = viewerId === userId;

      let query = db('user_work_experience').where('user_id', userId);

      if (!isOwner) {
        query = query.where('is_public', true);
      }

      return await query.orderBy('display_order', 'asc');
    } catch (error) {
      logger.error('[UserProfileService] Failed to get user work experience:', error);
      throw error;
    }
  }

  /**
   * 获取用户技能
   * @param userId - 用户ID
   * @param viewerId - 查看者ID（可选）
   * @returns 技能列表
   */
  async getUserSkills(
    userId: string,
    viewerId: string | null = null
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const isOwner = viewerId === userId;

      let query = db('user_skills').where('user_id', userId);

      if (!isOwner) {
        query = query.where('is_public', true);
      }

      return await query.orderBy('endorsement_count', 'desc');
    } catch (error) {
      logger.error('[UserProfileService] Failed to get user skills:', error);
      throw error;
    }
  }

  /**
   * 获取用户兴趣标签
   * @param userId - 用户ID
   * @param viewerId - 查看者ID（可选）
   * @returns 兴趣标签列表
   */
  async getUserInterests(
    userId: string,
    viewerId: string | null = null
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const isOwner = viewerId === userId;

      let query = db('user_interest_tags').where('user_id', userId);

      if (!isOwner) {
        query = query.where('is_public', true);
      }

      return await query.orderBy('weight', 'desc');
    } catch (error) {
      logger.error('[UserProfileService] Failed to get user interests:', error);
      throw error;
    }
  }

  /**
   * 计算用户资料完整度
   * @param userId - 用户ID
   * @returns 完整度信息
   */
  async calculateProfileCompleteness(userId: string): Promise<CompletenessResult> {
    try {
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw AppError.create(ERROR_CODES.USER_NOT_FOUND, { userId });
      }

      // 计算各项得分
      const scores = {
        basicInfo: await this.calculateBasicInfoScore(user),
        contactInfo: await this.calculateContactInfoScore(user),
        education: await this.calculateEducationScore(userId),
        work: await this.calculateWorkScore(userId),
        skills: await this.calculateSkillsScore(userId),
        social: await this.calculateSocialScore(userId)
      };

      // 计算总分和百分比
      const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
      const maxScore = Object.values(this.completenessWeights).reduce(
        (sum, weight) => sum + weight,
        0
      );
      const completenessPercentage = Math.round((totalScore / maxScore) * 100);

      // 生成缺失字段和建议
      const missingFields = await this.identifyMissingFields(user, userId);
      const suggestions = await this.generateProfileSuggestions(missingFields, scores);

      // 更新或创建完整度记录
      await db('user_profile_completeness')
        .insert({
          user_id: userId,
          basic_info_score: scores.basicInfo,
          contact_info_score: scores.contactInfo,
          education_score: scores.education,
          work_score: scores.work,
          skills_score: scores.skills,
          social_score: scores.social,
          total_score: totalScore,
          completeness_percentage: completenessPercentage,
          missing_fields: missingFields,
          suggestions: suggestions,
          last_calculated_at: new Date(),
          updated_at: new Date()
        })
        .onConflict('user_id')
        .merge({
          basic_info_score: scores.basicInfo,
          contact_info_score: scores.contactInfo,
          education_score: scores.education,
          work_score: scores.work,
          skills_score: scores.skills,
          social_score: scores.social,
          total_score: totalScore,
          completeness_percentage: completenessPercentage,
          missing_fields: missingFields,
          suggestions: suggestions,
          last_calculated_at: new Date(),
          updated_at: new Date()
        });

      return {
        scores,
        totalScore,
        completenessPercentage,
        missingFields,
        suggestions
      };
    } catch (error) {
      logger.error('[UserProfileService] Failed to calculate profile completeness:', error);
      throw error;
    }
  }

  /**
   * 获取用户资料完整度
   * @param userId - 用户ID
   * @returns 完整度信息
   */
  async getUserProfileCompleteness(userId: string): Promise<CompletenessResult> {
    try {
      const completeness = await db('user_profile_completeness').where('user_id', userId).first();

      if (!completeness) {
        return await this.calculateProfileCompleteness(userId);
      }

      return completeness;
    } catch (error) {
      logger.error('[UserProfileService] Failed to get user profile completeness:', error);
      throw error;
    }
  }

  /**
   * 记录资料查看日志
   * @param profileUserId - 被查看用户ID
   * @param viewerId - 查看者ID
   * @param viewData - 查看数据
   */
  async recordProfileView(
    profileUserId: string,
    viewerId: string,
    viewData: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await db('user_profile_views').insert({
        profile_user_id: profileUserId,
        viewer_id: viewerId,
        viewer_ip: viewData.ip,
        user_agent: viewData.userAgent,
        view_type: viewData.viewType || 'profile',
        view_data: viewData.additionalData,
        viewed_at: new Date()
      });
    } catch (error) {
      logger.error('[UserProfileService] Failed to record profile view:', error);
      // 不抛出错误，避免影响主要功能
    }
  }

  /**
   * 更新工作经历
   * @param userId - 用户ID
   * @param workId - 工作经历ID
   * @param updateData - 更新数据
   * @returns 更新后的工作经历
   */
  async updateWorkExperience(
    userId: string,
    workId: string,
    updateData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const work = await db('user_work_experience')
        .where({
          id: workId,
          user_id: userId
        })
        .first();

      if (!work) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '工作经历不存在'
        });
      }

      const [updatedWork] = await db('user_work_experience')
        .where({
          id: workId,
          user_id: userId
        })
        .update({
          ...updateData,
          updated_at: new Date()
        })
        .returning('*');

      await this.clearUserProfileCache(userId);
      await this.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileService] User ${userId} updated work experience: ${workId}`);

      return updatedWork;
    } catch (error) {
      logger.error('[UserProfileService] Failed to update work experience:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 删除工作经历
   * @param userId - 用户ID
   * @param workId - 工作经历ID
   * @returns 是否删除成功
   */
  async deleteWorkExperience(userId: string, workId: string): Promise<boolean> {
    try {
      const deleted = await db('user_work_experience')
        .where({
          id: workId,
          user_id: userId
        })
        .del();

      if (deleted) {
        await this.clearUserProfileCache(userId);
        await this.calculateProfileCompleteness(userId);
        logger.info(`[UserProfileService] User ${userId} deleted work experience: ${workId}`);
      }

      return deleted > 0;
    } catch (error) {
      logger.error('[UserProfileService] Failed to delete work experience:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取下一个显示顺序
   * @param userId - 用户ID
   * @param type - 类型
   * @returns 下一个显示顺序
   */
  async getNextDisplayOrder(userId: string, type: string): Promise<number> {
    try {
      let tableName;
      switch (type) {
        case 'education':
          tableName = 'user_education';
          break;
        case 'work':
          tableName = 'user_work_experience';
          break;
        default:
          return 1;
      }

      const result = await db(tableName)
        .where('user_id', userId)
        .max('display_order as maxOrder')
        .first();

      return (result?.maxOrder || 0) + 1;
    } catch (error) {
      logger.error('[UserProfileService] Failed to get next display order:', error);
      return 1;
    }
  }

  /**
   * 计算基础信息得分
   * @param user - 用户信息
   * @returns 得分
   */
  async calculateBasicInfoScore(user: UserRecord): Promise<number> {
    const requiredFields = ['first_name', 'last_name', 'bio', 'avatar_url'];
    const optionalFields = ['birth_date', 'gender', 'occupation', 'company', 'industry'];

    let score = 0;
    const requiredWeight = this.completenessWeights.basicInfo * 0.6;
    const optionalWeight = this.completenessWeights.basicInfo * 0.4;

    // 必需字段
    const requiredFilled = requiredFields.filter((field) => {
      const value = user[field as keyof UserRecord];
      return value && String(value).trim();
    }).length;
    score += (requiredFilled / requiredFields.length) * requiredWeight;

    // 可选字段
    const optionalFilled = optionalFields.filter((field) => {
      const value = user[field as keyof UserRecord];
      return value && String(value).trim();
    }).length;
    score += (optionalFilled / optionalFields.length) * optionalWeight;

    return Math.round(score);
  }

  /**
   * 计算联系信息得分
   * @param user - 用户信息
   * @returns 得分
   */
  async calculateContactInfoScore(user: UserRecord): Promise<number> {
    const fields = ['phone', 'country', 'state', 'city'];
    const filled = fields.filter((field) => {
      const value = user[field as keyof UserRecord];
      return value && String(value).trim();
    }).length;
    return Math.round((filled / fields.length) * this.completenessWeights.contactInfo);
  }

  /**
   * 计算教育信息得分
   * @param userId - 用户ID
   * @returns 得分
   */
  async calculateEducationScore(userId: string): Promise<number> {
    try {
      const educationCount = (await db('user_education')
        .where('user_id', userId)
        .count('* as count')
        .first()) as CountRow | undefined;

      const count = parseCount(educationCount);

      if (count === 0) return 0;
      if (count === 1) return Math.round(this.completenessWeights.education * 0.6);
      if (count === 2) return Math.round(this.completenessWeights.education * 0.8);
      return this.completenessWeights.education;
    } catch (error) {
      logger.error('[UserProfileService] Failed to calculate education score:', error);
      return 0;
    }
  }

  /**
   * 计算工作经历得分
   * @param userId - 用户ID
   * @returns 得分
   */
  async calculateWorkScore(userId: string): Promise<number> {
    try {
      const workCount = (await db('user_work_experience')
        .where('user_id', userId)
        .count('* as count')
        .first()) as CountRow | undefined;

      const count = parseCount(workCount);

      if (count === 0) return 0;
      if (count === 1) return Math.round(this.completenessWeights.work * 0.6);
      if (count === 2) return Math.round(this.completenessWeights.work * 0.8);
      return this.completenessWeights.work;
    } catch (error) {
      logger.error('[UserProfileService] Failed to calculate work score:', error);
      return 0;
    }
  }

  /**
   * 计算技能得分
   * @param userId - 用户ID
   * @returns 得分
   */
  async calculateSkillsScore(userId: string): Promise<number> {
    try {
      const skillCount = (await db('user_skills')
        .where('user_id', userId)
        .count('* as count')
        .first()) as CountRow | undefined;

      const count = parseCount(skillCount);

      if (count === 0) return 0;
      if (count <= 3) return Math.round(this.completenessWeights.skills * 0.5);
      if (count <= 6) return Math.round(this.completenessWeights.skills * 0.8);
      return this.completenessWeights.skills;
    } catch (error) {
      logger.error('[UserProfileService] Failed to calculate skills score:', error);
      return 0;
    }
  }

  /**
   * 计算社交信息得分
   * @param userId - 用户ID
   * @returns 得分
   */
  async calculateSocialScore(userId: string): Promise<number> {
    try {
      const socialCount = (await db('user_social_links')
        .where('user_id', userId)
        .count('* as count')
        .first()) as CountRow | undefined;

      const count = parseCount(socialCount);

      if (count === 0) return 0;
      if (count === 1) return Math.round(this.completenessWeights.social * 0.4);
      if (count === 2) return Math.round(this.completenessWeights.social * 0.7);
      return this.completenessWeights.social;
    } catch (error) {
      logger.error('[UserProfileService] Failed to calculate social score:', error);
      return 0;
    }
  }

  /**
   * 识别缺失字段
   * @param user - 用户信息
   * @param userId - 用户ID
   * @returns 缺失字段列表
   */
  async identifyMissingFields(user: UserRecord, userId: string): Promise<MissingField[]> {
    const missing: MissingField[] = [];

    // 基础信息
    const basicFields = ['first_name', 'last_name', 'bio', 'avatar_url'];
    basicFields.forEach((field) => {
      const value = user[field as keyof UserRecord];
      if (!value || !String(value).trim()) {
        missing.push({ category: 'basic', field, label: this.getFieldLabel(field) });
      }
    });

    // 联系信息
    const contactFields = ['phone', 'country', 'city'];
    contactFields.forEach((field) => {
      const value = user[field as keyof UserRecord];
      if (!value || !String(value).trim()) {
        missing.push({ category: 'contact', field, label: this.getFieldLabel(field) });
      }
    });

    // 检查是否有教育、工作、技能、社交信息
    const [educationCountRow, workCountRow, skillCountRow, socialCountRow] = await Promise.all([
      db('user_education').where('user_id', userId).count('* as count').first(),
      db('user_work_experience').where('user_id', userId).count('* as count').first(),
      db('user_skills').where('user_id', userId).count('* as count').first(),
      db('user_social_links').where('user_id', userId).count('* as count').first()
    ]);

    const educationCount = parseInt(String(educationCountRow?.count ?? 0)) ?? 0;
    const workCount = parseInt(String(workCountRow?.count ?? 0)) ?? 0;
    const skillCount = parseInt(String(skillCountRow?.count ?? 0)) ?? 0;
    const socialCount = parseInt(String(socialCountRow?.count ?? 0)) ?? 0;

    if (educationCount === 0) {
      missing.push({ category: 'education', field: 'education', label: '教育经历' });
    }
    if (workCount === 0) {
      missing.push({ category: 'work', field: 'work_experience', label: '工作经历' });
    }
    if (skillCount === 0) {
      missing.push({ category: 'skills', field: 'skills', label: '技能标签' });
    }
    if (socialCount === 0) {
      missing.push({ category: 'social', field: 'social_links', label: '社交媒体链接' });
    }

    return missing;
  }

  /**
   * 生成资料完善建议
   * @param missingFields - 缺失字段
   * @param scores - 各项得分
   * @returns 建议列表
   */
  async generateProfileSuggestions(
    missingFields: MissingField[],
    scores: CompletenessScores
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // 根据缺失字段生成建议
    if (missingFields.some((field) => field.category === 'basic')) {
      suggestions.push({
        type: 'basic_info',
        priority: 'high',
        title: '完善基础信息',
        description: '添加您的姓名、头像和个人简介，让其他人更好地了解您',
        action: 'update_profile'
      });
    }

    if (missingFields.some((field) => field.category === 'education')) {
      suggestions.push({
        type: 'education',
        priority: 'medium',
        title: '添加教育经历',
        description: '分享您的教育背景，展示您的学术成就',
        action: 'add_education'
      });
    }

    if (missingFields.some((field) => field.category === 'work')) {
      suggestions.push({
        type: 'work',
        priority: 'medium',
        title: '添加工作经历',
        description: '记录您的职业发展历程，展示专业能力',
        action: 'add_work_experience'
      });
    }

    if (missingFields.some((field) => field.category === 'skills')) {
      suggestions.push({
        type: 'skills',
        priority: 'medium',
        title: '添加技能标签',
        description: '展示您的专业技能和专长领域',
        action: 'add_skills'
      });
    }

    // 根据得分生成个性化建议
    if (scores.contactInfo < this.completenessWeights.contactInfo * 0.5) {
      suggestions.push({
        type: 'contact',
        priority: 'low',
        title: '完善联系信息',
        description: '添加您的位置信息，便于同城交流',
        action: 'update_contact'
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 获取字段标签
   * @param field - 字段名
   * @returns 字段标签
   */
  getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      first_name: '名',
      last_name: '姓',
      bio: '个人简介',
      avatar_url: '头像',
      phone: '手机号',
      country: '国家',
      state: '省/州',
      city: '城市',
      address: '详细地址',
      postal_code: '邮政编码',
      occupation: '职业',
      company: '公司',
      industry: '行业',
      education_level: '教育程度',
      university: '大学'
    };
    return labels[field] || field;
  }

  /**
   * 获取隐私设置
   * @param user - 用户信息
   * @returns 隐私设置
   */
  getPrivacySettings(user: BasicProfileInfo): Record<string, unknown> {
    return {
      profile_public: Boolean(user.profile_public),
      show_email: Boolean(user.show_email),
      show_phone: Boolean(user.show_phone),
      privacy_settings: user.privacy_settings || {}
    };
  }

  /**
   * 清除用户资料缓存
   * @param userId - 用户ID
   */
  async clearUserProfileCache(userId: string): Promise<void> {
    try {
      await cacheService.deletePattern(`${this.cachePrefix}*${userId}*`);
    } catch (error) {
      logger.error('[UserProfileService] Failed to clear user profile cache:', error);
    }
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    try {
      this.initialized = false;
      logger.info('[UserProfileService] User profile service closed');
    } catch (error) {
      logger.error('[UserProfileService] Error closing user profile service:', error);
    }
  }
}

const userProfileService: UserProfileService = new UserProfileService();

export default userProfileService;
