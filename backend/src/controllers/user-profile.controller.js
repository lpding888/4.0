const logger = require('../utils/logger');
const db = require('../config/database');
const userProfileService = require('../services/user-profile.service');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');

/**
 * 用户资料控制器
 *
 * 处理用户资料相关的HTTP请求：
 * - 用户基础信息管理
 * - 教育和工作经历管理
 * - 技能和兴趣标签管理
 * - 社交媒体链接管理
 * - 资料完整度计算
 * - 隐私设置控制
 */
class UserProfileController {
  /**
   * 获取用户完整资料
   */
  async getUserFullProfile(req, res, next) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.user.id;

      const profile = await userProfileService.getUserFullProfile(targetUserId, req.user.id);

      res.json({
        success: true,
        data: profile
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to get user full profile:', error);
      next(error);
    }
  }

  /**
   * 获取用户基础信息
   */
  async getUserBasicInfo(req, res, next) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.user.id;

      const userInfo = await userProfileService.getUserBasicInfo(targetUserId, req.user.id);

      res.json({
        success: true,
        data: userInfo
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to get user basic info:', error);
      next(error);
    }
  }

  /**
   * 更新用户基础信息
   */
  async updateUserBasicInfo(req, res, next) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      const updatedUser = await userProfileService.updateUserBasicInfo(userId, updateData);

      logger.info(`[UserProfileController] User ${userId} updated basic profile`);

      res.json({
        success: true,
        message: '基础信息更新成功',
        data: updatedUser
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to update user basic info:', error);
      next(error);
    }
  }

  /**
   * 获取用户教育经历
   */
  async getUserEducation(req, res, next) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.user.id;

      const education = await userProfileService.getUserEducation(targetUserId, req.user.id);

      res.json({
        success: true,
        data: education
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to get user education:', error);
      next(error);
    }
  }

  /**
   * 添加教育经历
   */
  async addEducation(req, res, next) {
    try {
      const userId = req.user.id;
      const educationData = req.body;

      // 参数验证
      if (!educationData.school_name || !educationData.school_name.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'school_name',
          message: '学校名称不能为空'
        });
      }

      const education = await userProfileService.addEducation(userId, educationData);

      logger.info(`[UserProfileController] User ${userId} added education`);

      res.json({
        success: true,
        message: '教育经历添加成功',
        data: education
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to add education:', error);
      next(error);
    }
  }

  /**
   * 更新教育经历
   */
  async updateEducation(req, res, next) {
    try {
      const userId = req.user.id;
      const { educationId } = req.params;
      const updateData = req.body;

      const updatedEducation = await userProfileService.updateEducation(userId, educationId, updateData);

      logger.info(`[UserProfileController] User ${userId} updated education ${educationId}`);

      res.json({
        success: true,
        message: '教育经历更新成功',
        data: updatedEducation
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to update education:', error);
      next(error);
    }
  }

  /**
   * 删除教育经历
   */
  async deleteEducation(req, res, next) {
    try {
      const userId = req.user.id;
      const { educationId } = req.params;

      const success = await userProfileService.deleteEducation(userId, educationId);

      if (!success) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '教育经历不存在'
        });
      }

      logger.info(`[UserProfileController] User ${userId} deleted education ${educationId}`);

      res.json({
        success: true,
        message: '教育经历删除成功'
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to delete education:', error);
      next(error);
    }
  }

  /**
   * 获取用户工作经历
   */
  async getUserWorkExperience(req, res, next) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.user.id;

      const workExperience = await userProfileService.getUserWorkExperience(targetUserId, req.user.id);

      res.json({
        success: true,
        data: workExperience
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to get user work experience:', error);
      next(error);
    }
  }

  /**
   * 添加工作经历
   */
  async addWorkExperience(req, res, next) {
    try {
      const userId = req.user.id;
      const workData = req.body;

      // 参数验证
      if (!workData.company_name || !workData.company_name.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'company_name',
          message: '公司名称不能为空'
        });
      }

      if (!workData.job_title || !workData.job_title.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'job_title',
          message: '职位名称不能为空'
        });
      }

      const workExperience = await userProfileService.addWorkExperience(userId, workData);

      logger.info(`[UserProfileController] User ${userId} added work experience`);

      res.json({
        success: true,
        message: '工作经历添加成功',
        data: workExperience
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to add work experience:', error);
      next(error);
    }
  }

  /**
   * 更新工作经历
   */
  async updateWorkExperience(req, res, next) {
    try {
      const userId = req.user.id;
      const { workId } = req.params;
      const updateData = req.body;

      // 需要先检查工作经历是否存在且属于当前用户
      const workExperience = await userProfileService.getUserWorkExperience(userId);
      const existingWork = workExperience.find(work => work.id === workId);

      if (!existingWork) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '工作经历不存在'
        });
      }

      // 更新工作经历
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

      if (!updatedWork) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '工作经历不存在'
        });
      }

      // 清除缓存
      await userProfileService.clearUserProfileCache(userId);
      await userProfileService.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileController] User ${userId} updated work experience ${workId}`);

      res.json({
        success: true,
        message: '工作经历更新成功',
        data: updatedWork
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to update work experience:', error);
      next(error);
    }
  }

  /**
   * 删除工作经历
   */
  async deleteWorkExperience(req, res, next) {
    try {
      const userId = req.user.id;
      const { workId } = req.params;

      // 需要先检查工作经历是否存在且属于当前用户
      const workExperience = await userProfileService.getUserWorkExperience(userId);
      const existingWork = workExperience.find(work => work.id === workId);

      if (!existingWork) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '工作经历不存在'
        });
      }

      // 删除工作经历
      const deleted = await db('user_work_experience')
        .where({
          id: workId,
          user_id: userId
        })
        .del();

      if (deleted === 0) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '工作经历不存在'
        });
      }

      // 清除缓存
      await userProfileService.clearUserProfileCache(userId);
      await userProfileService.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileController] User ${userId} deleted work experience ${workId}`);

      res.json({
        success: true,
        message: '工作经历删除成功'
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to delete work experience:', error);
      next(error);
    }
  }

  /**
   * 获取用户技能
   */
  async getUserSkills(req, res, next) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.user.id;

      const skills = await userProfileService.getUserSkills(targetUserId, req.user.id);

      res.json({
        success: true,
        data: skills
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to get user skills:', error);
      next(error);
    }
  }

  /**
   * 添加技能
   */
  async addSkill(req, res, next) {
    try {
      const userId = req.user.id;
      const skillData = req.body;

      // 参数验证
      if (!skillData.skill_name || !skillData.skill_name.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'skill_name',
          message: '技能名称不能为空'
        });
      }

      const skill = await userProfileService.addSkill(userId, skillData);

      logger.info(`[UserProfileController] User ${userId} added skill`);

      res.json({
        success: true,
        message: '技能添加成功',
        data: skill
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to add skill:', error);
      next(error);
    }
  }

  /**
   * 更新技能
   */
  async updateSkill(req, res, next) {
    try {
      const userId = req.user.id;
      const { skillId } = req.params;
      const updateData = req.body;

      // 需要先检查技能是否存在且属于当前用户
      const skills = await userProfileService.getUserSkills(userId);
      const existingSkill = skills.find(skill => skill.id === skillId);

      if (!existingSkill) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '技能不存在'
        });
      }

      // 更新技能（需要在service中实现）
      const [updatedSkill] = await db('user_skills')
        .where({
          id: skillId,
          user_id: userId
        })
        .update({
          ...updateData,
          updated_at: new Date()
        })
        .returning('*');

      if (!updatedSkill) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '技能不存在'
        });
      }

      // 清除缓存
      await userProfileService.clearUserProfileCache(userId);
      await userProfileService.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileController] User ${userId} updated skill ${skillId}`);

      res.json({
        success: true,
        message: '技能更新成功',
        data: updatedSkill
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to update skill:', error);
      next(error);
    }
  }

  /**
   * 删除技能
   */
  async deleteSkill(req, res, next) {
    try {
      const userId = req.user.id;
      const { skillId } = req.params;

      // 删除技能
      const deleted = await db('user_skills')
        .where({
          id: skillId,
          user_id: userId
        })
        .del();

      if (deleted === 0) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          message: '技能不存在'
        });
      }

      // 清除缓存
      await userProfileService.clearUserProfileCache(userId);
      await userProfileService.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileController] User ${userId} deleted skill ${skillId}`);

      res.json({
        success: true,
        message: '技能删除成功'
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to delete skill:', error);
      next(error);
    }
  }

  /**
   * 获取用户兴趣标签
   */
  async getUserInterests(req, res, next) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.user.id;

      const interests = await userProfileService.getUserInterests(targetUserId, req.user.id);

      res.json({
        success: true,
        data: interests
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to get user interests:', error);
      next(error);
    }
  }

  /**
   * 获取用户社交媒体链接
   */
  async getUserSocialLinks(req, res, next) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.user.id;

      const socialLinks = await userProfileService.getUserSocialLinks(targetUserId, req.user.id);

      res.json({
        success: true,
        data: socialLinks
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to get user social links:', error);
      next(error);
    }
  }

  /**
   * 获取用户资料完整度
   */
  async getUserProfileCompleteness(req, res, next) {
    try {
      const { userId } = req.params;
      const targetUserId = userId || req.user.id;

      const completeness = await userProfileService.getUserProfileCompleteness(targetUserId);

      res.json({
        success: true,
        data: completeness
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to get user profile completeness:', error);
      next(error);
    }
  }

  /**
   * 重新计算用户资料完整度
   */
  async recalculateProfileCompleteness(req, res, next) {
    try {
      const userId = req.user.id;

      const completeness = await userProfileService.calculateProfileCompleteness(userId);

      logger.info(`[UserProfileController] User ${userId} recalculated profile completeness`);

      res.json({
        success: true,
        message: '资料完整度重新计算成功',
        data: completeness
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to recalculate profile completeness:', error);
      next(error);
    }
  }

  /**
   * 获取资料完善建议
   */
  async getProfileSuggestions(req, res, next) {
    try {
      const userId = req.user.id;

      const completeness = await userProfileService.getUserProfileCompleteness(userId);
      const suggestions = completeness.suggestions || [];

      res.json({
        success: true,
        data: {
          suggestions,
          completeness_percentage: completeness.completeness_percentage,
          missing_fields: completeness.missing_fields || []
        }
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to get profile suggestions:', error);
      next(error);
    }
  }

  /**
   * 批量更新用户资料
   */
  async batchUpdateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const { basicInfo, education, workExperience, skills } = req.body;

      const trx = await db.transaction();

      try {
        const results = {};

        // 更新基础信息
        if (basicInfo) {
          results.basicInfo = await userProfileService.updateUserBasicInfo(userId, basicInfo);
        }

        // 批量添加教育经历
        if (education && Array.isArray(education)) {
          results.education = [];
          for (const edu of education) {
            const addedEdu = await userProfileService.addEducation(userId, edu);
            results.education.push(addedEdu);
          }
        }

        // 批量添加工作经历
        if (workExperience && Array.isArray(workExperience)) {
          results.workExperience = [];
          for (const work of workExperience) {
            const addedWork = await userProfileService.addWorkExperience(userId, work);
            results.workExperience.push(addedWork);
          }
        }

        // 批量添加技能
        if (skills && Array.isArray(skills)) {
          results.skills = [];
          for (const skill of skills) {
            try {
              const addedSkill = await userProfileService.addSkill(userId, skill);
              results.skills.push(addedSkill);
            } catch (error) {
              // 忽略重复技能错误
              if (error.code !== ERROR_CODES.DUPLICATE_RESOURCE) {
                throw error;
              }
            }
          }
        }

        await trx.commit();

        // 重新计算完整度
        const completeness = await userProfileService.calculateProfileCompleteness(userId);

        logger.info(`[UserProfileController] User ${userId} batch updated profile`);

        res.json({
          success: true,
          message: '资料批量更新成功',
          data: {
            ...results,
            completeness
          }
        });

      } catch (error) {
        await trx.rollback();
        throw error;
      }

    } catch (error) {
      logger.error('[UserProfileController] Failed to batch update profile:', error);
      next(error);
    }
  }

  /**
   * 上传头像
   */
  async uploadAvatar(req, res, next) {
    try {
      const userId = req.user.id;

      if (!req.file) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          message: '请选择要上传的头像文件'
        });
      }

      // 这里应该调用文件上传服务，暂时返回模拟数据
      const avatarUrl = `/uploads/avatars/${userId}_${Date.now()}.jpg`;

      const updatedUser = await userProfileService.updateUserBasicInfo(userId, {
        avatar_url: avatarUrl
      });

      logger.info(`[UserProfileController] User ${userId} uploaded avatar`);

      res.json({
        success: true,
        message: '头像上传成功',
        data: {
          avatar_url: updatedUser.avatar_url
        }
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to upload avatar:', error);
      next(error);
    }
  }

  /**
   * 上传横幅图片
   */
  async uploadBanner(req, res, next) {
    try {
      const userId = req.user.id;

      if (!req.file) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          message: '请选择要上传的横幅图片文件'
        });
      }

      // 这里应该调用文件上传服务，暂时返回模拟数据
      const bannerUrl = `/uploads/banners/${userId}_${Date.now()}.jpg`;

      const updatedUser = await userProfileService.updateUserBasicInfo(userId, {
        banner_url: bannerUrl
      });

      logger.info(`[UserProfileController] User ${userId} uploaded banner`);

      res.json({
        success: true,
        message: '横幅图片上传成功',
        data: {
          banner_url: updatedUser.banner_url
        }
      });

    } catch (error) {
      logger.error('[UserProfileController] Failed to upload banner:', error);
      next(error);
    }
  }
}

module.exports = new UserProfileController();