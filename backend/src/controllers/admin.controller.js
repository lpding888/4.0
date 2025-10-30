const db = require('../config/database');
const logger = require('../utils/logger');
const encryptionUtils = require('../utils/encryption');

/**
 * 管理后台控制器 - 处理管理相关请求
 */
class AdminController {
  /**
   * 获取用户列表
   * GET /api/admin/users?limit=10&offset=0&isMember=true
   */
  async getUsers(req, res, next) {
    try {
      const { limit = 20, offset = 0, isMember } = req.query;

      let query = db('users')
        .select(
          'id',
          'phone',
          'isMember',
          'quota_remaining',
          'quota_expireAt',
          'created_at',
          'updated_at'
        )
        .orderBy('created_at', 'desc');

      // 按会员状态筛选
      if (isMember !== undefined) {
        query = query.where('isMember', isMember === 'true');
      }

      const users = await query.limit(parseInt(limit)).offset(parseInt(offset));

      // 获取总数
      let countQuery = db('users');
      if (isMember !== undefined) {
        countQuery = countQuery.where('isMember', isMember === 'true');
      }
      const [{ count }] = await countQuery.count('* as count');

      // 获取统计信息
      const stats = await this.getUserStats();

      res.json({
        success: true,
        data: {
          users,
          total: parseInt(count),
          limit: parseInt(limit),
          offset: parseInt(offset),
          stats
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取用户列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats() {
    const [totalUsers] = await db('users').count('* as count');
    const [memberUsers] = await db('users').where('isMember', true).count('* as count');
    const [activeMembers] = await db('users')
      .where('isMember', true)
      .where('quota_expireAt', '>', new Date())
      .count('* as count');

    return {
      totalUsers: parseInt(totalUsers.count),
      memberUsers: parseInt(memberUsers.count),
      activeMembers: parseInt(activeMembers.count),
      memberRate: totalUsers.count > 0
        ? ((memberUsers.count / totalUsers.count) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 获取任务列表
   * GET /api/admin/tasks?limit=20&offset=0&status=success&type=basic_clean
   */
  async getTasks(req, res, next) {
    try {
      const { limit = 20, offset = 0, status, type, userId } = req.query;

      let query = db('tasks')
        .select(
          'tasks.*',
          'users.phone as userPhone'
        )
        .leftJoin('users', 'tasks.userId', 'users.id')
        .orderBy('tasks.created_at', 'desc');

      // 筛选条件
      if (status) {
        query = query.where('tasks.status', status);
      }
      if (type) {
        query = query.where('tasks.type', type);
      }
      if (userId) {
        query = query.where('tasks.userId', userId);
      }

      const tasks = await query.limit(parseInt(limit)).offset(parseInt(offset));

      // 获取总数
      let countQuery = db('tasks');
      if (status) countQuery = countQuery.where('status', status);
      if (type) countQuery = countQuery.where('type', type);
      if (userId) countQuery = countQuery.where('userId', userId);
      const [{ count }] = await countQuery.count('* as count');

      // 获取任务统计
      const stats = await this.getTaskStats();

      res.json({
        success: true,
        data: {
          tasks,
          total: parseInt(count),
          limit: parseInt(limit),
          offset: parseInt(offset),
          stats
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取任务列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取任务统计信息
   */
  async getTaskStats() {
    const [totalTasks] = await db('tasks').count('* as count');
    const [successTasks] = await db('tasks').where('status', 'success').count('* as count');
    const [failedTasks] = await db('tasks').where('status', 'failed').count('* as count');
    const [processingTasks] = await db('tasks')
      .whereIn('status', ['pending', 'processing'])
      .count('* as count');

    return {
      totalTasks: parseInt(totalTasks.count),
      successTasks: parseInt(successTasks.count),
      failedTasks: parseInt(failedTasks.count),
      processingTasks: parseInt(processingTasks.count),
      successRate: totalTasks.count > 0
        ? ((successTasks.count / totalTasks.count) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 获取失败任务列表
   * GET /api/admin/failed-tasks?limit=20&offset=0
   */
  async getFailedTasks(req, res, next) {
    try {
      const { limit = 20, offset = 0 } = req.query;

      const tasks = await db('tasks')
        .select(
          'tasks.*',
          'users.phone as userPhone'
        )
        .leftJoin('users', 'tasks.userId', 'users.id')
        .where('tasks.status', 'failed')
        .orderBy('tasks.updated_at', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      const [{ count }] = await db('tasks')
        .where('status', 'failed')
        .count('* as count');

      res.json({
        success: true,
        data: {
          tasks,
          total: parseInt(count),
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取失败任务列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取系统概览统计
   * GET /api/admin/overview
   */
  async getOverview(req, res, next) {
    try {
      const userStats = await this.getUserStats();
      const taskStats = await this.getTaskStats();

      // 获取订单统计
      const [totalOrders] = await db('orders').count('* as count');
      const [paidOrders] = await db('orders').where('status', 'paid').count('* as count');
      
      // 计算总收入(简化,实际应从orders表的amount字段累加)
      const revenue = parseInt(paidOrders.count) * 99;

      // 今日新增用户
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const [todayUsers] = await db('users')
        .where('created_at', '>=', todayStart)
        .count('* as count');

      // 今日新增任务
      const [todayTasks] = await db('tasks')
        .where('created_at', '>=', todayStart)
        .count('* as count');

      res.json({
        success: true,
        data: {
          userStats,
          taskStats,
          orderStats: {
            totalOrders: parseInt(totalOrders.count),
            paidOrders: parseInt(paidOrders.count),
            revenue
          },
          todayStats: {
            newUsers: parseInt(todayUsers.count),
            newTasks: parseInt(todayTasks.count)
          }
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取系统概览失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取所有功能卡片（包括禁用的,但不包括软删除的）
   * GET /api/admin/features
   */
  async getFeatures(req, res, next) {
    try {
      const features = await db('feature_definitions')
        .whereNull('deleted_at')
        .select('*')
        .orderBy('created_at', 'desc');

      // 反序列化 allowed_accounts 为数组
      features.forEach(f => {
        if (f.allowed_accounts) {
          try {
            f.allowed_accounts = JSON.parse(f.allowed_accounts);
          } catch (e) {
            f.allowed_accounts = [];
          }
        }
      });

      res.json({
        success: true,
        features
      });

    } catch (error) {
      logger.error(`[AdminController] 获取功能列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 创建新功能卡片
   * POST /api/admin/features
   */
  async createFeature(req, res, next) {
    try {
      const { feature_definition, form_schema, pipeline_schema } = req.body;

      if (!feature_definition || !form_schema || !pipeline_schema) {
        return res.status(400).json({
          success: false,
          error: { code: 4001, message: '缺少必要参数：feature_definition, form_schema, pipeline_schema' }
        });
      }

      // 规范化 allowed_accounts 字段
      let allowedAccounts = feature_definition.allowed_accounts;
      if (allowedAccounts) {
        if (typeof allowedAccounts === 'string') {
          // 多行文本转数组
          const accountArray = allowedAccounts
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .filter((value, index, self) => self.indexOf(value) === index); // 去重
          allowedAccounts = JSON.stringify(accountArray);
        } else if (Array.isArray(allowedAccounts)) {
          allowedAccounts = JSON.stringify(allowedAccounts);
        }
      }

      // 在事务中插入
      await db.transaction(async (trx) => {
        // 插入 form_schema
        await trx('form_schemas').insert({
          schema_id: form_schema.schema_id,
          fields: JSON.stringify(form_schema.fields),
          created_at: new Date(),
          updated_at: new Date()
        });

        // 插入 pipeline_schema
        await trx('pipeline_schemas').insert({
          pipeline_id: pipeline_schema.pipeline_id,
          steps: JSON.stringify(pipeline_schema.steps),
          created_at: new Date(),
          updated_at: new Date()
        });

        // 插入 feature_definition
        await trx('feature_definitions').insert({
          ...feature_definition,
          allowed_accounts: allowedAccounts,
          form_schema_ref: form_schema.schema_id,
          pipeline_schema_ref: pipeline_schema.pipeline_id,
          created_at: new Date(),
          updated_at: new Date()
        });
      });

      logger.info(`[AdminController] 功能创建成功 featureId=${feature_definition.feature_id}`);

      res.json({
        success: true,
        message: '功能创建成功',
        feature_id: feature_definition.feature_id
      });

    } catch (error) {
      logger.error(`[AdminController] 创建功能失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 更新功能卡片
   * PUT /api/admin/features/:featureId
   */
  async updateFeature(req, res, next) {
    try {
      const { featureId } = req.params;
      const { feature_definition, form_schema, pipeline_schema } = req.body;

      // 检查功能是否存在
      const existing = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: { code: 4004, message: '功能不存在' }
        });
      }

      // 规范化 allowed_accounts 字段
      let allowedAccounts = feature_definition?.allowed_accounts;
      if (allowedAccounts) {
        if (typeof allowedAccounts === 'string') {
          const accountArray = allowedAccounts
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .filter((value, index, self) => self.indexOf(value) === index);
          allowedAccounts = JSON.stringify(accountArray);
        } else if (Array.isArray(allowedAccounts)) {
          allowedAccounts = JSON.stringify(allowedAccounts);
        }
      }

      // 在事务中更新
      await db.transaction(async (trx) => {
        // 更新 form_schema（如果提供）
        if (form_schema) {
          await trx('form_schemas')
            .where('schema_id', existing.form_schema_ref)
            .update({
              fields: JSON.stringify(form_schema.fields),
              updated_at: new Date()
            });
        }

        // 更新 pipeline_schema（如果提供）
        if (pipeline_schema) {
          await trx('pipeline_schemas')
            .where('pipeline_id', existing.pipeline_schema_ref)
            .update({
              steps: JSON.stringify(pipeline_schema.steps),
              updated_at: new Date()
            });
        }

        // 更新 feature_definition（如果提供）
        if (feature_definition) {
          await trx('feature_definitions')
            .where('feature_id', featureId)
            .update({
              ...feature_definition,
              allowed_accounts: allowedAccounts,
              updated_at: new Date()
            });
        }
      });

      logger.info(`[AdminController] 功能更新成功 featureId=${featureId}`);

      res.json({
        success: true,
        message: '功能更新成功'
      });

    } catch (error) {
      logger.error(`[AdminController] 更新功能失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 快速切换功能启用状态
   * PATCH /api/admin/features/:featureId
   */
  async toggleFeature(req, res, next) {
    try {
      const { featureId } = req.params;
      const { is_enabled } = req.body;

      if (typeof is_enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: { code: 4001, message: 'is_enabled 必须为布尔值' }
        });
      }

      // 检查功能
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!feature) {
        return res.status(404).json({
          success: false,
          error: { code: 4004, message: '功能不存在' }
        });
      }

      // 风险提示：配额为0的功能不建议上线
      if (is_enabled && feature.quota_cost === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 4001, message: '配额为0的功能不建议上线' },
          warning: '该功能不扣费,可能导致滥用和成本失控'
        });
      }

      // 更新状态
      await db('feature_definitions')
        .where('feature_id', featureId)
        .update({
          is_enabled,
          updated_at: new Date()
        });

      logger.info(`[AdminController] 功能状态切换成功 featureId=${featureId} is_enabled=${is_enabled}`);

      res.json({
        success: true,
        message: `功能已${is_enabled ? '启用' : '禁用'}`
      });

    } catch (error) {
      logger.error(`[AdminController] 切换功能状态失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 软删除功能卡片
   * DELETE /api/admin/features/:featureId
   */
  async deleteFeature(req, res, next) {
    try {
      const { featureId } = req.params;

      // 检查功能是否存在
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first();

      if (!feature) {
        return res.status(404).json({
          success: false,
          error: { code: 4004, message: '功能不存在' }
        });
      }

      // 软删除（设置 deleted_at）
      await db('feature_definitions')
        .where('feature_id', featureId)
        .update({
          deleted_at: new Date(),
          updated_at: new Date()
        });

      logger.info(`[AdminController] 功能软删除成功 featureId=${featureId}`);

      res.json({
        success: true,
        message: '功能已删除'
      });

    } catch (error) {
      logger.error(`[AdminController] 删除功能失败: ${error.message}`, error);
      next(error);
    }
  }

  // ============ 分销代理管理接口 ============

  /**
   * 获取分销员列表
   * GET /api/admin/distributors
   */
  async getDistributors(req, res, next) {
    try {
      const { status, keyword, limit = 20, offset = 0 } = req.query;

      let query = db('distributors as d')
        .join('users as u', 'd.user_id', 'u.id')
        .select(
          'd.*',
          'u.phone'
        )
        .orderBy('d.created_at', 'desc');

      // 状态筛选
      if (status) {
        query = query.where('d.status', status);
      }

      // 关键词搜索
      if (keyword) {
        query = query.where(function() {
          this.where('d.real_name', 'like', `%${keyword}%`)
            .orWhere('u.phone', 'like', `%${keyword}%`)
            .orWhere('d.invite_code', 'like', `%${keyword}%`);
        });
      }

      // 获取总数
      const countQuery = query.clone();
      const [{ count }] = await countQuery.count('* as count');

      // 分页查询
      const distributors = await query
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      // 查询每个分销员的推荐人数
      const isSuperAdmin = req.user.role === 'super_admin';
      for (let dist of distributors) {
        const [{ count: referralCount }] = await db('referral_relationships')
          .where('referrer_distributor_id', dist.id)
          .count('* as count');
        dist.totalReferrals = parseInt(referralCount);

        // 🔥 身份证号脱敏（法律合规）
        if (isSuperAdmin) {
          // super_admin: 解密后显示完整身份证
          dist.id_card = encryptionUtils.decryptIdCard(dist.id_card);
        } else {
          // 普通admin: 解密后脱敏显示
          dist.id_card = encryptionUtils.decryptAndMaskIdCard(dist.id_card);
        }
      }

      res.json({
        success: true,
        data: {
          distributors,
          total: parseInt(count)
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取分销员列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取分销员详细信息（管理端）
   * GET /api/admin/distributors/:id
   */
  async getDistributorDetail(req, res, next) {
    try {
      const { id } = req.params;

      const distributor = await db('distributors')
        .where({ id })
        .first();

      if (!distributor) {
        return res.status(404).json({
          success: false,
          error: { code: 6007, message: '分销员不存在' }
        });
      }

      // 查询用户信息
      const user = await db('users')
        .where({ id: distributor.user_id })
        .select('id', 'phone', 'created_at')
        .first();

      // 查询推荐用户总数
      const [{ count: totalReferrals }] = await db('referral_relationships')
        .where({ referrer_distributor_id: distributor.id })
        .count('* as count');

      // 查询已付费推荐用户数
      const [{ count: paidReferrals }] = await db('referral_relationships as rr')
        .join('orders as o', 'rr.referred_user_id', 'o.userId')
        .where({ 'rr.referrer_distributor_id': distributor.id, 'o.status': 'paid' })
        .countDistinct('rr.referred_user_id as count');

      // 查询冻结佣金
      const [{ total: frozenCommission }] = await db('commissions')
        .where({ distributor_id: distributor.id, status: 'frozen' })
        .sum('commission_amount as total');

      // 查询待审核提现
      const [{ total: pendingWithdrawal }] = await db('withdrawals')
        .where({ distributor_id: distributor.id, status: 'pending' })
        .sum('amount as total');

      // 查询历史提现记录数
      const [{ count: withdrawalCount }] = await db('withdrawals')
        .where({ distributor_id: distributor.id })
        .count('* as count');

      const baseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
      const inviteLink = `${baseUrl}/register?ref=${distributor.user_id}`;

          // 🔥 身份证号权限控制（法律合规）
          // 只有super_admin能查看完整身份证，普通admin只能看脱敏版本
          const isSuperAdmin = req.user.role === 'super_admin';
          let idCard;
          if (isSuperAdmin) {
            // super_admin: 解密后显示完整身份证
            idCard = encryptionUtils.decryptIdCard(distributor.id_card);
          } else {
            // 普通admin: 解密后脱敏显示
            idCard = encryptionUtils.decryptAndMaskIdCard(distributor.id_card);
          }

          res.json({
            success: true,
            data: {
              // 基本信息
              id: distributor.id,
              userId: distributor.user_id,
              phone: user.phone,
              realName: distributor.real_name,
              idCard: idCard, // 🔥 根据权限返回完整或脱敏的身份证号
          contact: distributor.contact,
          channel: distributor.channel,
          status: distributor.status,
          inviteCode: distributor.invite_code,
          inviteLink: inviteLink,

          // 申请与审核信息
          appliedAt: distributor.created_at,
          approvalTime: distributor.approval_time,
          updatedAt: distributor.updated_at,

          // 推广数据
          totalReferrals: parseInt(totalReferrals) || 0,
          paidReferrals: parseInt(paidReferrals) || 0,

          // 佣金数据
          totalCommission: parseFloat(distributor.total_commission) || 0,
          availableCommission: parseFloat(distributor.available_commission) || 0,
          frozenCommission: parseFloat(frozenCommission) || 0,
          withdrawnCommission: parseFloat(distributor.withdrawn_commission) || 0,
          pendingWithdrawal: parseFloat(pendingWithdrawal) || 0,

          // 提现记录数
          withdrawalCount: parseInt(withdrawalCount) || 0
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取分销员详情失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取分销员推广用户列表（管理端）
   * GET /api/admin/distributors/:id/referrals
   */
  async getDistributorReferrals(req, res, next) {
    try {
      const { id } = req.params;
      const { status = 'all', limit = 20, offset = 0 } = req.query;

      // 检查分销员是否存在
      const distributor = await db('distributors')
        .where({ id })
        .first();

      if (!distributor) {
        return res.status(404).json({
          success: false,
          error: { code: 6007, message: '分销员不存在' }
        });
      }

      // 构建查询
      let query = db('referral_relationships as rr')
        .join('users as u', 'rr.referred_user_id', 'u.id')
        .leftJoin('orders as o', function() {
          this.on('u.id', 'o.userId').andOn('o.status', db.raw('?', ['paid']));
        })
        .leftJoin('commissions as c', function() {
          this.on('rr.referred_user_id', 'c.referred_user_id')
            .andOn('c.distributor_id', db.raw('?', [distributor.id]));
        })
        .where('rr.referrer_distributor_id', distributor.id)
        .select(
          'u.id as userId',
          'u.phone',
          'rr.created_at as registeredAt',
          db.raw('IF(o.id IS NOT NULL, true, false) as hasPaid'),
          db.raw('MAX(o.paidAt) as paidAt'),
          db.raw('SUM(c.commission_amount) as commissionAmount')
        )
        .groupBy('u.id', 'u.phone', 'rr.created_at');

      // 状态过滤
      if (status === 'paid') {
        query = query.havingRaw('hasPaid = true');
      } else if (status === 'unpaid') {
        query = query.havingRaw('hasPaid = false');
      }

      // 获取总数
      const countQuery = query.clone();
      const totalResult = await countQuery.count('* as count').first();
      const total = parseInt(totalResult.count) || 0;

      // 分页查询
      const referrals = await query
        .orderBy('rr.created_at', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      // 格式化结果（管理端不脱敏手机号）
      const formattedReferrals = referrals.map(r => ({
        userId: r.userId,
        phone: r.phone, // 管理端显示完整手机号
        registeredAt: r.registeredAt,
        hasPaid: r.hasPaid,
        paidAt: r.paidAt,
        commissionAmount: parseFloat(r.commissionAmount) || 0
      }));

      res.json({
        success: true,
        data: {
          referrals: formattedReferrals,
          total
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取分销员推广用户列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取分销员佣金记录（管理端）
   * GET /api/admin/distributors/:id/commissions
   */
  async getDistributorCommissions(req, res, next) {
    try {
      const { id } = req.params;
      const { status = 'all', limit = 20, offset = 0 } = req.query;

      // 检查分销员是否存在
      const distributor = await db('distributors')
        .where({ id })
        .first();

      if (!distributor) {
        return res.status(404).json({
          success: false,
          error: { code: 6007, message: '分销员不存在' }
        });
      }

      // 构建查询
      let query = db('commissions as c')
        .join('users as u', 'c.referred_user_id', 'u.id')
        .where('c.distributor_id', distributor.id)
        .select(
          'c.id',
          'c.order_id as orderId',
          'u.id as userId',
          'u.phone',
          'c.order_amount as orderAmount',
          'c.commission_amount as commissionAmount',
          'c.commission_rate as commissionRate',
          'c.status',
          'c.freeze_until as freezeUntil',
          'c.created_at as createdAt',
          'c.settled_at as settledAt'
        );

      // 状态过滤
      if (status !== 'all') {
        query = query.where('c.status', status);
      }

      // 获取总数
      const total = await query.clone().count('* as count').first();

      // 分页查询
      const commissions = await query
        .orderBy('c.created_at', 'desc')
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      // 格式化结果（管理端不脱敏手机号）
      const formattedCommissions = commissions.map(c => ({
        id: c.id,
        orderId: c.orderId,
        userId: c.userId,
        referredUserPhone: c.phone, // 管理端显示完整手机号
        orderAmount: parseFloat(c.orderAmount),
        commissionAmount: parseFloat(c.commissionAmount),
        commissionRate: parseFloat(c.commissionRate),
        status: c.status,
        freezeUntil: c.freezeUntil,
        createdAt: c.createdAt,
        settledAt: c.settledAt
      }));

      res.json({
        success: true,
        data: {
          commissions: formattedCommissions,
          total: parseInt(total.count) || 0
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取分销员佣金记录失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 审核分销员申请
   * PATCH /api/admin/distributors/:id/approve
   */
  async approveDistributor(req, res, next) {
    try {
      const { id } = req.params;

      const distributor = await db('distributors').where({ id }).first();

      if (!distributor) {
        return res.status(404).json({
          success: false,
          error: { code: 6011, message: '分销员不存在' }
        });
      }

      if (distributor.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: { code: 6012, message: '该申请已处理' }
        });
      }

      await db('distributors')
        .where({ id })
        .update({
          status: 'active',
          approval_time: new Date(),
          updated_at: new Date()
        });

      logger.info(`[AdminController] 分销员审核通过: id=${id}`);

      res.json({
        success: true,
        message: '审核通过'
      });

    } catch (error) {
      logger.error(`[AdminController] 审核分销员失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 禁用分销员
   * PATCH /api/admin/distributors/:id/disable
   */
  async disableDistributor(req, res, next) {
    try {
      const { id } = req.params;

      const distributor = await db('distributors').where({ id }).first();

      if (!distributor) {
        return res.status(404).json({
          success: false,
          error: { code: 6011, message: '分销员不存在' }
        });
      }

      await db('distributors')
        .where({ id })
        .update({
          status: 'disabled',
          updated_at: new Date()
        });

      logger.info(`[AdminController] 分销员已禁用: id=${id}`);

      res.json({
        success: true,
        message: '分销员已禁用'
      });

    } catch (error) {
      logger.error(`[AdminController] 禁用分销员失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取提现申请列表
   * GET /api/admin/withdrawals
   */
  async getWithdrawals(req, res, next) {
    try {
      const { status, limit = 20, offset = 0 } = req.query;

      let query = db('withdrawals as w')
        .join('distributors as d', 'w.distributor_id', 'd.id')
        .join('users as u', 'd.user_id', 'u.id')
        .select(
          'w.*',
          'd.real_name',
          'u.phone'
        )
        .orderBy('w.created_at', 'desc');

      // 状态筛选
      if (status) {
        query = query.where('w.status', status);
      }

      // 获取总数
      const countQuery = query.clone();
      const [{ count }] = await countQuery.count('* as count');

      // 分页查询
      const withdrawals = await query
        .limit(parseInt(limit))
        .offset(parseInt(offset));

      // 解析 account_info
      withdrawals.forEach(w => {
        w.account_info = JSON.parse(w.account_info);
      });

      res.json({
        success: true,
        data: {
          withdrawals,
          total: parseInt(count)
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取提现列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 审核通过提现
   * PATCH /api/admin/withdrawals/:id/approve
   */
  async approveWithdrawal(req, res, next) {
    try {
      const { id } = req.params;

      await db.transaction(async (trx) => {
        // 使用行锁查询提现记录（防止并发重复审核）
        const withdrawal = await trx('withdrawals')
          .where({ id })
          .forUpdate()
          .first();

        if (!withdrawal) {
          throw {
            statusCode: 404,
            errorCode: 6013,
            message: '提现记录不存在'
          };
        }

        if (withdrawal.status !== 'pending') {
          throw {
            statusCode: 400,
            errorCode: 6014,
            message: '该提现申请已处理'
          };
        }

        // 更新提现状态
        await trx('withdrawals')
          .where({ id })
          .update({
            status: 'approved',
            approved_at: new Date()
          });

        // 更新分销员已提现金额
        await trx('distributors')
          .where({ id: withdrawal.distributor_id })
          .increment('withdrawn_commission', withdrawal.amount);
      });

      logger.info(`[AdminController] 提现审核通过: id=${id}`);

      res.json({
        success: true,
        message: '审核通过，请尽快打款'
      });

    } catch (error) {
      logger.error(`[AdminController] 审核提现失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 拒绝提现
   * PATCH /api/admin/withdrawals/:id/reject
   */
  async rejectWithdrawal(req, res, next) {
    try {
      const { id } = req.params;
      const { rejectReason } = req.body;

      if (!rejectReason) {
        return res.status(400).json({
          success: false,
          error: { code: 6015, message: '请填写拒绝原因' }
        });
      }

      await db.transaction(async (trx) => {
        // 使用行锁查询提现记录（防止并发重复退款）
        const withdrawal = await trx('withdrawals')
          .where({ id })
          .forUpdate()
          .first();

        if (!withdrawal) {
          throw {
            statusCode: 404,
            errorCode: 6013,
            message: '提现记录不存在'
          };
        }

        if (withdrawal.status !== 'pending') {
          throw {
            statusCode: 400,
            errorCode: 6014,
            message: '该提现申请已处理'
          };
        }

        // 更新提现状态为已拒绝
        await trx('withdrawals')
          .where({ id })
          .update({
            status: 'rejected',
            reject_reason: rejectReason,
            approved_at: new Date()
          });

        // 退还可提现余额
        await trx('distributors')
          .where({ id: withdrawal.distributor_id })
          .increment('available_commission', withdrawal.amount);
      });

      logger.info(`[AdminController] 提现已拒绝: id=${id}`);

      res.json({
        success: true,
        message: '已拒绝提现申请'
      });

    } catch (error) {
      logger.error(`[AdminController] 拒绝提现失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 分销数据统计
   * GET /api/admin/distribution/stats
   */
  async getDistributionStats(req, res, next) {
    try {
      // 分销员统计
      const [totalDistributors] = await db('distributors').count('* as count');
      const [activeDistributors] = await db('distributors')
        .where('status', 'active')
        .count('* as count');

      // 推荐用户统计
      const [totalReferrals] = await db('referral_relationships').count('* as count');
      const [paidReferrals] = await db('referral_relationships as rr')
        .join('orders as o', 'rr.referred_user_id', 'o.userId')
        .where('o.status', 'paid')
        .countDistinct('rr.referred_user_id as count');

      // 佣金统计
      const [commissionStats] = await db('commissions')
        .sum('commission_amount as totalCommissionPaid')
        .first();

      // 待审核提现统计
      const [pendingWithdrawals] = await db('withdrawals')
        .where('status', 'pending')
        .count('* as count')
        .sum('amount as amount')
        .first();

      res.json({
        success: true,
        data: {
          totalDistributors: parseInt(totalDistributors.count),
          activeDistributors: parseInt(activeDistributors.count),
          totalReferrals: parseInt(totalReferrals.count),
          paidReferrals: parseInt(paidReferrals.count),
          totalCommissionPaid: parseFloat(commissionStats.totalCommissionPaid) || 0,
          pendingWithdrawals: parseInt(pendingWithdrawals.count) || 0,
          pendingWithdrawalAmount: parseFloat(pendingWithdrawals.amount) || 0
        }
      });

    } catch (error) {
      logger.error(`[AdminController] 获取分销统计失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取佣金设置
   * GET /api/admin/distribution/settings
   */
  async getDistributionSettings(req, res, next) {
    try {
      const settings = await db('distribution_settings').where({ id: 1 }).first();

      res.json({
        success: true,
        data: settings
      });

    } catch (error) {
      logger.error(`[AdminController] 获取佣金设置失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 更新佣金设置
   * PUT /api/admin/distribution/settings
   */
  async updateDistributionSettings(req, res, next) {
    try {
      const { commission_rate, freeze_days, min_withdrawal_amount, auto_approve } = req.body;

      const updateData = {};
      if (commission_rate !== undefined) updateData.commission_rate = commission_rate;
      if (freeze_days !== undefined) updateData.freeze_days = freeze_days;
      if (min_withdrawal_amount !== undefined) updateData.min_withdrawal_amount = min_withdrawal_amount;
      if (auto_approve !== undefined) updateData.auto_approve = auto_approve;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 6016, message: '没有需要更新的字段' }
        });
      }

      updateData.updated_at = new Date();

      await db('distribution_settings')
        .where({ id: 1 })
        .update(updateData);

      logger.info(`[AdminController] 佣金设置已更新:`, updateData);

      res.json({
        success: true,
        message: '设置已更新'
      });

    } catch (error) {
      logger.error(`[AdminController] 更新佣金设置失败: ${error.message}`, error);
      next(error);
    }
  }
}

module.exports = new AdminController();
