const distributionService = require('../services/distribution.service');
const logger = require('../utils/logger');

/**
 * 分销代理控制器
 */
class DistributionController {
  constructor() {
    // 绑定this，确保方法在express router中正确工作
    this.apply = this.apply.bind(this);
    this.getStatus = this.getStatus.bind(this);
    this.getDetail = this.getDetail.bind(this);
    this.getDashboard = this.getDashboard.bind(this);
    this.getReferrals = this.getReferrals.bind(this);
    this.getCommissions = this.getCommissions.bind(this);
    this.getWithdrawals = this.getWithdrawals.bind(this);
    this.createWithdrawal = this.createWithdrawal.bind(this);
  }

  /**
   * 申请成为分销员
   * POST /api/distribution/apply
   */
  async apply(req, res, next) {
    try {
      const userId = req.userId;
      const { realName, idCard, contact, channel } = req.body;

      // 参数验证
      if (!realName || !idCard || !contact) {
        return res.status(400).json({
          success: false,
          error: {
            code: 6000,
            message: '请填写完整的申请资料'
          }
        });
      }

      const result = await distributionService.applyDistributor(userId, {
        realName,
        idCard,
        contact,
        channel
      });

      res.json({
        success: true,
        data: result,
        message: '申请已提交，请等待审核'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 查询分销员状态
   * GET /api/distribution/status
   */
  async getStatus(req, res, next) {
    try {
      const userId = req.userId;
      const status = await distributionService.getDistributorStatus(userId);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 查询分销员详细信息
   * GET /api/distribution/detail
   */
  async getDetail(req, res, next) {
    try {
      const userId = req.userId;
      const detail = await distributionService.getDistributorDetail(userId);

      res.json({
        success: true,
        data: detail
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 分销中心数据概览
   * GET /api/distribution/dashboard
   */
  async getDashboard(req, res, next) {
    try {
      const userId = req.userId;
      const dashboard = await distributionService.getDashboard(userId);

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 推广用户列表
   * GET /api/distribution/referrals
   */
  async getReferrals(req, res, next) {
    try {
      const userId = req.userId;
      const { status = 'all', limit = 20, offset = 0 } = req.query;

      const result = await distributionService.getReferrals(userId, {
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 佣金明细
   * GET /api/distribution/commissions
   */
  async getCommissions(req, res, next) {
    try {
      const userId = req.userId;
      const { status = 'all', limit = 20, offset = 0 } = req.query;

      const result = await distributionService.getCommissions(userId, {
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 提现记录
   * GET /api/distribution/withdrawals
   */
  async getWithdrawals(req, res, next) {
    try {
      const userId = req.userId;
      const { limit = 20, offset = 0 } = req.query;

      const result = await distributionService.getWithdrawals(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 申请提现
   * POST /api/distribution/withdraw
   */
  async createWithdrawal(req, res, next) {
    try {
      const userId = req.userId;
      const { amount, method, accountInfo } = req.body;

      // 参数验证
      if (!amount || !method || !accountInfo) {
        return res.status(400).json({
          success: false,
          error: {
            code: 6000,
            message: '请填写完整的提现信息'
          }
        });
      }

      const withdrawalId = await distributionService.createWithdrawal(userId, {
        amount: parseFloat(amount),
        method,
        accountInfo
      });

      res.json({
        success: true,
        data: { withdrawalId },
        message: '提现申请已提交，请等待审核'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DistributionController();
