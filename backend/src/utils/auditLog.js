const db = require('../config/database');
const shortid = require('shortid');
const logger = require('./logger');

/**
 * 审计日志工具类
 * 用于记录敏感操作，如提现审核、分销员审核等
 */
class AuditLog {
  /**
   * 记录审计日志
   * @param {Object} params - 日志参数
   * @param {string} params.adminId - 管理员ID
   * @param {string} params.action - 操作类型
   * @param {string} params.resourceType - 资源类型
   * @param {string} params.resourceId - 资源ID
   * @param {Object} params.details - 操作详情
   * @param {string} params.ip - IP地址
   * @param {string} params.userAgent - User Agent
   */
  async log({ adminId, action, resourceType, resourceId, details, ip, userAgent }) {
    try {
      const logId = shortid.generate();
      
      await db('audit_logs').insert({
        id: logId,
        admin_id: adminId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details: details ? JSON.stringify(details) : null,
        ip: ip || null,
        user_agent: userAgent || null,
        created_at: new Date()
      });

      logger.info(
        '[AuditLog] 记录审计日志: ' +
        'action=' + action + ', ' +
        'resource=' + resourceType + '/' + resourceId + ', ' +
        'admin=' + adminId
      );

      return logId;
    } catch (error) {
      logger.error('[AuditLog] 记录审计日志失败: ' + error.message);
      // 审计日志失败不应阻塞业务，只记录错误
    }
  }

  /**
   * 记录提现审核通过
   */
  async logWithdrawalApprove(adminId, withdrawalId, amount, distributorId, req) {
    return this.log({
      adminId,
      action: 'withdrawal_approve',
      resourceType: 'withdrawal',
      resourceId: withdrawalId,
      details: {
        amount,
        distributorId,
        timestamp: new Date().toISOString()
      },
      ip: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get?.('user-agent')
    });
  }

  /**
   * 记录提现审核拒绝
   */
  async logWithdrawalReject(adminId, withdrawalId, amount, distributorId, rejectReason, req) {
    return this.log({
      adminId,
      action: 'withdrawal_reject',
      resourceType: 'withdrawal',
      resourceId: withdrawalId,
      details: {
        amount,
        distributorId,
        rejectReason,
        timestamp: new Date().toISOString()
      },
      ip: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get?.('user-agent')
    });
  }

  /**
   * 记录分销员审核通过
   */
  async logDistributorApprove(adminId, distributorId, userId, req) {
    return this.log({
      adminId,
      action: 'distributor_approve',
      resourceType: 'distributor',
      resourceId: distributorId,
      details: {
        userId,
        timestamp: new Date().toISOString()
      },
      ip: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get?.('user-agent')
    });
  }

  /**
   * 记录分销员禁用
   */
  async logDistributorDisable(adminId, distributorId, userId, reason, req) {
    return this.log({
      adminId,
      action: 'distributor_disable',
      resourceType: 'distributor',
      resourceId: distributorId,
      details: {
        userId,
        reason,
        timestamp: new Date().toISOString()
      },
      ip: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get?.('user-agent')
    });
  }
}

module.exports = new AuditLog();
