const db = require('../config/database');
const logger = require('../utils/logger');
const { generateId } = require('../utils/generator');

/**
 * 佣金计算与结算服务
 */
class CommissionService {
  /**
   * 计算并创建佣金记录（首单计佣）
   */
  async calculateAndCreateCommission(trx, userId, orderId, orderAmount) {
    try {
      // 1. 检查是否是该用户首次购买
      const orderCount = await trx('orders')
        .where({ userId, status: 'paid' })
        .count('id as count')
        .first();

      if (orderCount.count > 1) {
        logger.info(`不是首单,不计佣: userId=${userId}, orderId=${orderId}`);
        return null;
      }

      // 2. 查询推荐关系
      const relation = await trx('referral_relationships')
        .where({ referred_user_id: userId })
        .first();

      if (!relation) {
        logger.info(`没有推荐人,不计佣: userId=${userId}`);
        return null;
      }

      // 3. 查询分销员信息
      const distributor = await trx('distributors')
        .where({ id: relation.referrer_distributor_id })
        .first();

      if (!distributor || distributor.status !== 'active') {
        logger.info(`分销员不存在或已禁用,不计佣: distributorId=${relation.referrer_distributor_id}`);
        return null;
      }

      // 4. 获取佣金比例（从系统设置）
      const settings = await trx('distribution_settings')
        .where({ id: 1 })
        .first();
      const commissionRate = settings?.commission_rate || 15; // 默认15%

      // 5. 计算佣金金额
      const commissionAmount = parseFloat(
        (orderAmount * commissionRate / 100).toFixed(2)
      );

      // 6. 计算冻结截止时间（默认7天）
      const freezeDays = settings?.freeze_days || 7;
      const freezeUntil = new Date();
      freezeUntil.setDate(freezeUntil.getDate() + freezeDays);

      // 7. 创建佣金记录（防止重复计佣:唯一索引）
      const commissionId = generateId(8);
      try {
        await trx('commissions').insert({
          id: commissionId,
          distributor_id: distributor.id,
          order_id: orderId,
          referred_user_id: userId,
          order_amount: orderAmount,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          status: 'frozen',
          freeze_until: freezeUntil,
          created_at: new Date()
        });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          logger.warn(`订单已计佣,跳过: orderId=${orderId}`);
          return null;
        }
        throw error;
      }

      // 8. 更新分销员累计佣金
      await trx('distributors')
        .where({ id: distributor.id })
        .increment('total_commission', commissionAmount);

      logger.info(`佣金计算成功: commissionId=${commissionId}, amount=${commissionAmount}, freezeUntil=${freezeUntil}`);

      return commissionId;
    } catch (error) {
      logger.error(`佣金计算失败: userId=${userId}, orderId=${orderId}, error=${error.message}`);
      throw error;
    }
  }

  /**
   * 解冻佣金（定时任务调用）
   */
  async unfreezeCommissions() {
    try {
      await db.transaction(async (trx) => {
        // 使用行锁查询冻结期已结束的佣金（防止并发重复解冻）
        const frozenCommissions = await trx('commissions')
          .where({ status: 'frozen' })
          .where('freeze_until', '<=', new Date())
          .forUpdate()
          .select('*');

        if (frozenCommissions.length === 0) {
          logger.info('没有需要解冻的佣金');
          return;
        }

        for (const commission of frozenCommissions) {
          // 🔥 使用行锁查询分销员（防止并发更新冲突）
          const distributor = await trx('distributors')
            .where({ id: commission.distributor_id })
            .forUpdate()
            .first();

          if (!distributor) {
            logger.error(`分销员不存在,跳过解冻: distributorId=${commission.distributor_id}`);
            continue;
          }

          // 更新佣金状态为可提现
          await trx('commissions')
            .where({ id: commission.id })
            .update({
              status: 'available',
              settled_at: new Date()
            });

          // 增加分销员可提现余额（已有行锁保护）
          await trx('distributors')
            .where({ id: commission.distributor_id })
            .increment('available_commission', commission.commission_amount);

          logger.info(`佣金解冻: commissionId=${commission.id}, amount=${commission.commission_amount}`);
        }

        logger.info(`✓ 解冻佣金${frozenCommissions.length}条`);
      });
    } catch (error) {
      logger.error(`解冻佣金失败: error=${error.message}`);
      throw error;
    }
  }

  /**
   * 取消冻结佣金（订单退款时调用）
   */
  async cancelFrozenCommission(trx, orderId) {
    try {
      // 查询该订单的佣金记录
      const commission = await trx('commissions')
        .where({ order_id: orderId, status: 'frozen' })
        .first();

      if (!commission) {
        logger.info(`订单无冻结佣金,跳过: orderId=${orderId}`);
        return null;
      }

      // 更新佣金状态为已取消
      await trx('commissions')
        .where({ id: commission.id })
        .update({
          status: 'cancelled',
          settled_at: new Date()
        });

      // 扣除分销员累计佣金
      await trx('distributors')
        .where({ id: commission.distributor_id })
        .decrement('total_commission', commission.commission_amount);

      logger.info(`佣金取消: commissionId=${commission.id}, orderId=${orderId}`);

      return commission.id;
    } catch (error) {
      logger.error(`取消佣金失败: orderId=${orderId}, error=${error.message}`);
      throw error;
    }
  }
}

module.exports = new CommissionService();
