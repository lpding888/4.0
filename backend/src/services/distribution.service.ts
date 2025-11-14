import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import { generateId } from '../utils/generator.js';
import encryptionUtils from '../utils/encryption.js';
import type { Knex } from 'knex';

type AnyObject = Record<string, unknown>;

type CountRow = {
  count?: string | number | bigint | null;
};

type SumRow = {
  total?: string | number | bigint | null;
};

const toNumber = (value: string | number | bigint | null | undefined): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const parseCount = (row?: CountRow): number => toNumber(row?.count);
const parseTotal = (row?: SumRow): number => toNumber(row?.total);

const normalizeString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return fallback;
};

const maskPhone = (phone: unknown): string => {
  const normalized = normalizeString(phone);
  if (normalized.length < 7) return normalized;
  return normalized.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
};

type ReferralRow = {
  userId: string;
  phone: string | null;
  registeredAt: Date | string;
  hasPaid?: number | boolean | null;
  paidAt?: Date | string | null;
  commissionAmount?: string | number | bigint | null;
};

type CommissionRow = {
  id: string;
  orderId: string;
  phone: string | null;
  orderAmount?: string | number | bigint | null;
  commissionAmount?: string | number | bigint | null;
  status: string;
  createdAt: Date | string;
  settledAt?: Date | string | null;
};

type WithdrawalRow = {
  id: string;
  amount?: string | number | bigint | null;
  method: string | null;
  account_info: string | Record<string, unknown> | null;
  status: string;
  reject_reason?: string | null;
  created_at: Date | string;
  approved_at?: Date | string | null;
};

/**
 * 分销代理服务
 */
class DistributionService {
  /**
   * 生成唯一邀请码
   */
  async generateInviteCode() {
    let code;
    let exists = true;

    while (exists) {
      // 生成6位大写字母+数字邀请码
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const distributor = await db('distributors').where({ invite_code: code }).first();
      exists = !!distributor;
    }

    return code;
  }

  /**
   * 申请成为分销员
   */
  async applyDistributor(userId: string, applyData: AnyObject): Promise<AnyObject> {
    const { realName, idCard, contact, channel } = applyData;

    if (
      typeof realName !== 'string' ||
      typeof idCard !== 'string' ||
      typeof contact !== 'string' ||
      !realName.trim() ||
      !idCard.trim() ||
      !contact.trim()
    ) {
      throw {
        statusCode: 400,
        errorCode: 6000,
        message: '请填写完整的申请资料'
      };
    }

    // 检查用户是否存在
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      throw {
        statusCode: 404,
        errorCode: 6001,
        message: '用户不存在'
      };
    }

    // 检查是否已申请
    const existingDistributor = await db('distributors').where({ user_id: userId }).first();

    if (existingDistributor) {
      if (existingDistributor.status === 'pending') {
        throw {
          statusCode: 400,
          errorCode: 6002,
          message: '您的申请正在审核中'
        };
      } else if (existingDistributor.status === 'active') {
        throw {
          statusCode: 400,
          errorCode: 6003,
          message: '您已经是分销员'
        };
      } else if (existingDistributor.status === 'disabled') {
        throw {
          statusCode: 400,
          errorCode: 6004,
          message: '您的分销员资格已被禁用'
        };
      }
    }

    // 生成邀请码
    const inviteCode = await this.generateInviteCode();
    // 🔥 加密身份证号（法律合规）
    const encryptedIdCard = encryptionUtils.encryptIdCard(idCard);

    // 创建分销员记录
    const distributorId = generateId(8);
    await db('distributors').insert({
      id: distributorId,
      user_id: userId,
      real_name: realName,
      id_card: encryptedIdCard, // 🔥 存储加密后的身份证号
      contact,
      channel: typeof channel === 'string' ? channel : null,
      status: 'pending',
      invite_code: inviteCode,
      total_commission: 0,
      available_commission: 0,
      withdrawn_commission: 0,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info(`分销员申请提交: userId=${userId}, distributorId=${distributorId}`);

    return {
      distributorId,
      inviteCode,
      status: 'pending'
    };
  }

  /**
   * 绑定推荐关系（在事务中执行）
   */
  async bindReferralRelationship(
    trx: Knex.Transaction,
    referrerUserId: string,
    referredUserId: string
  ): Promise<string | null> {
    // 检查自己推荐自己
    if (referrerUserId === referredUserId) {
      logger.warn(`自己推荐自己,忽略: referrerUserId=${referrerUserId}`);
      return null;
    }

    // 查询推荐人是否是分销员
    const referrer = await trx('distributors')
      .where({ user_id: referrerUserId, status: 'active' })
      .first();

    if (!referrer) {
      logger.info(`推荐人不是分销员,不绑定关系: referrerUserId=${referrerUserId}`);
      return null;
    }

    // 检查被推荐人是否已有推荐关系
    const existingRelation = await trx('referral_relationships')
      .where({ referred_user_id: referredUserId })
      .first();

    if (existingRelation) {
      logger.info(`被推荐人已有推荐关系,不重复绑定: referredUserId=${referredUserId}`);
      return null;
    }

    // 创建推荐关系
    const relationId = generateId(8);
    await trx('referral_relationships').insert({
      id: relationId,
      referrer_user_id: referrerUserId,
      referred_user_id: referredUserId,
      referrer_distributor_id: referrer.id,
      created_at: new Date()
    });

    logger.info(
      `推荐关系绑定成功: relationId=${relationId}, referrerId=${referrerUserId}, referredId=${referredUserId}`
    );

    return relationId;
  }

  /**
   * 查询分销员状态（简单版本）
   */
  async getDistributorStatus(userId: string): Promise<AnyObject> {
    const distributor = await db('distributors').where({ user_id: userId }).first();

    if (!distributor) {
      return {
        isDistributor: false,
        status: null,
        inviteCode: null,
        inviteLink: null
      };
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
    const inviteLink = `${baseUrl}/register?ref=${distributor.user_id}`;

    return {
      isDistributor: true,
      status: distributor.status,
      inviteCode: distributor.invite_code,
      inviteLink: inviteLink,
      approvalTime: distributor.approval_time
    };
  }

  /**
   * 查询分销员详细信息（用户端）
   */
  async getDistributorDetail(userId: string): Promise<AnyObject> {
    const distributor = await db('distributors').where({ user_id: userId }).first();

    if (!distributor) {
      throw {
        statusCode: 404,
        errorCode: 6007,
        message: '您不是分销员'
      };
    }

    // 查询用户信息
    const user = await db('users')
      .where({ id: userId })
      .select('id', 'phone', 'created_at')
      .first();

    // 查询推荐用户总数
    const totalReferralsRow = (await db('referral_relationships')
      .where({ referrer_distributor_id: distributor.id })
      .count('id as count')
      .first()) as CountRow | undefined;

    // 查询已付费推荐用户数
    const paidReferralsRow = (await db('referral_relationships as rr')
      .join('orders as o', 'rr.referred_user_id', 'o.userId')
      .where({ 'rr.referrer_distributor_id': distributor.id, 'o.status': 'paid' })
      .countDistinct('rr.referred_user_id as count')
      .first()) as CountRow | undefined;

    // 查询冻结佣金
    const frozenCommissionRow = (await db('commissions')
      .where({ distributor_id: distributor.id, status: 'frozen' })
      .sum('commission_amount as total')
      .first()) as SumRow | undefined;

    // 查询待审核提现
    const pendingWithdrawalRow = (await db('withdrawals')
      .where({ distributor_id: distributor.id, status: 'pending' })
      .sum('amount as total')
      .first()) as SumRow | undefined;

    const totalReferrals = parseCount(totalReferralsRow);
    const paidReferrals = parseCount(paidReferralsRow);
    const frozenCommission = parseTotal(frozenCommissionRow);
    const pendingWithdrawal = parseTotal(pendingWithdrawalRow);

    const baseUrl = process.env.FRONTEND_URL || 'https://yourapp.com';
    const inviteLink = `${baseUrl}/register?ref=${distributor.user_id}`;

    return {
      // 基本信息
      id: distributor.id,
      userId: distributor.user_id,
      phone: user.phone,
      realName: distributor.real_name,
      contact: distributor.contact,
      channel: distributor.channel,
      status: distributor.status,
      inviteCode: distributor.invite_code,
      inviteLink: inviteLink,

      // 申请与审核信息
      appliedAt: distributor.created_at,
      approvalTime: distributor.approval_time,

      // 推广数据
      totalReferrals,
      paidReferrals,

      // 佣金数据
      totalCommission: toNumber(distributor.total_commission),
      availableCommission: toNumber(distributor.available_commission),
      frozenCommission,
      withdrawnCommission: toNumber(distributor.withdrawn_commission),
      pendingWithdrawal
    };
  }

  /**
   * 获取分销中心数据概览
   */
  async getDashboard(userId: string): Promise<AnyObject> {
    // 查询分销员信息
    const distributor = await db('distributors').where({ user_id: userId }).first();

    if (!distributor || distributor.status !== 'active') {
      throw {
        statusCode: 403,
        errorCode: 6005,
        message: '您不是活跃的分销员'
      };
    }

    // 查询推荐用户总数
    const totalReferralsRow = (await db('referral_relationships')
      .where({ referrer_distributor_id: distributor.id })
      .count('id as count')
      .first()) as CountRow | undefined;

    // 查询已付费推荐用户数
    const paidReferralsRow = (await db('referral_relationships as rr')
      .join('orders as o', 'rr.referred_user_id', 'o.userId')
      .where({ 'rr.referrer_distributor_id': distributor.id, 'o.status': 'paid' })
      .countDistinct('rr.referred_user_id as count')
      .first()) as CountRow | undefined;

    // 查询冻结佣金
    const frozenCommissionRow = (await db('commissions')
      .where({ distributor_id: distributor.id, status: 'frozen' })
      .sum('commission_amount as total')
      .first()) as SumRow | undefined;

    return {
      totalReferrals: parseCount(totalReferralsRow),
      paidReferrals: parseCount(paidReferralsRow),
      totalCommission: toNumber(distributor.total_commission),
      availableCommission: toNumber(distributor.available_commission),
      frozenCommission: parseTotal(frozenCommissionRow),
      withdrawnCommission: toNumber(distributor.withdrawn_commission)
    };
  }

  /**
   * 获取推广用户列表
   */
  async getReferrals(
    userId: string,
    {
      status = 'all',
      limit = 20,
      offset = 0
    }: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<AnyObject> {
    const distributor = await db('distributors').where({ user_id: userId }).first();

    if (!distributor || distributor.status !== 'active') {
      throw {
        statusCode: 403,
        errorCode: 6005,
        message: '您不是活跃的分销员'
      };
    }

    // 构建查询
    let query = db('referral_relationships as rr')
      .join('users as u', 'rr.referred_user_id', 'u.id')
      .leftJoin('orders as o', function () {
        this.on('u.id', 'o.userId').andOn('o.status', db.raw('?', ['paid']));
      })
      .leftJoin('commissions as c', function () {
        this.on('rr.referred_user_id', 'c.referred_user_id').andOn(
          'c.distributor_id',
          db.raw('?', [distributor.id])
        );
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
    const totalResult = await countQuery.count<{ count: number }>('* as count').first();
    const total = Number(totalResult?.count ?? 0);

    // 分页查询
    const referrals = (await query
      .orderBy('rr.created_at', 'desc')
      .limit(limit)
      .offset(offset)) as ReferralRow[];

    // 脱敏手机号
    const formattedReferrals = referrals.map((r) => ({
      userId: r.userId as string,
      phone: maskPhone(r.phone),
      registeredAt: r.registeredAt,
      hasPaid: Boolean(r.hasPaid),
      paidAt: r.paidAt,
      commissionAmount: toNumber(r.commissionAmount)
    }));

    return {
      referrals: formattedReferrals,
      total
    };
  }

  /**
   * 获取佣金明细
   */
  async getCommissions(
    userId: string,
    {
      status = 'all',
      limit = 20,
      offset = 0
    }: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<AnyObject> {
    const distributor = await db('distributors').where({ user_id: userId }).first();

    if (!distributor || distributor.status !== 'active') {
      throw {
        statusCode: 403,
        errorCode: 6005,
        message: '您不是活跃的分销员'
      };
    }

    // 构建查询
    let query = db('commissions as c')
      .join('users as u', 'c.referred_user_id', 'u.id')
      .where('c.distributor_id', distributor.id)
      .select(
        'c.id',
        'c.order_id as orderId',
        'u.phone',
        'c.order_amount as orderAmount',
        'c.commission_amount as commissionAmount',
        'c.status',
        'c.created_at as createdAt',
        'c.settled_at as settledAt'
      );

    // 状态过滤
    if (status !== 'all') {
      query = query.where('c.status', String(status));
    }

    // 获取总数
    const totalRow = (await query.clone().count('* as count').first()) as CountRow | undefined;

    // 分页查询
    const commissions = (await query
      .orderBy('c.created_at', 'desc')
      .limit(limit)
      .offset(offset)) as CommissionRow[];

    // 脱敏手机号
    const formattedCommissions = commissions.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      referredUserPhone: maskPhone(c.phone),
      orderAmount: toNumber(c.orderAmount),
      commissionAmount: toNumber(c.commissionAmount),
      status: c.status,
      createdAt: c.createdAt,
      settledAt: c.settledAt
    }));

    return {
      commissions: formattedCommissions,
      total: parseCount(totalRow)
    };
  }

  /**
   * 申请提现（使用行锁+事务）
   */
  async createWithdrawal(userId: string, withdrawalData: AnyObject): Promise<string> {
    const { amount, method, accountInfo } = withdrawalData;
    const numericAmount = Number(amount);

    // 校验金额格式
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw {
        statusCode: 400,
        errorCode: 6006,
        message: '提现金额无效'
      };
    }

    return await db.transaction(async (trx) => {
      // 使用行锁查询分销员
      const distributor = await trx('distributors').where({ user_id: userId }).forUpdate().first();

      if (!distributor) {
        throw {
          statusCode: 403,
          errorCode: 6007,
          message: '您不是分销员'
        };
      }

      if (distributor.status !== 'active') {
        throw {
          statusCode: 403,
          errorCode: 6008,
          message: '您的分销员资格已被禁用'
        };
      }

      // 获取最低提现金额配置
      const settings = await trx('distribution_settings').where({ id: 1 }).first();
      const minAmount = settings?.min_withdrawal_amount || 100;

      if (numericAmount < minAmount) {
        throw {
          statusCode: 400,
          errorCode: 6009,
          message: `提现金额不能低于¥${minAmount}`
        };
      }

      // 检查可提现余额
      if (distributor.available_commission < numericAmount) {
        throw {
          statusCode: 400,
          errorCode: 6010,
          message: `可提现余额不足(当前¥${distributor.available_commission})`
        };
      }

      // 扣除可提现余额
      await trx('distributors')
        .where({ id: distributor.id })
        .decrement('available_commission', numericAmount);

      // 创建提现记录
      const withdrawalId = generateId(8);
      const accountInfoPayload =
        typeof accountInfo === 'string' ? accountInfo : JSON.stringify(accountInfo ?? {});

      await trx('withdrawals').insert({
        id: withdrawalId,
        distributor_id: distributor.id,
        amount: numericAmount,
        method,
        account_info: accountInfoPayload,
        status: 'pending',
        created_at: new Date()
      });

      logger.info(`提现申请创建成功: withdrawalId=${withdrawalId}, amount=${numericAmount}`);

      return withdrawalId;
    });
  }

  /**
   * 获取提现记录
   */
  async getWithdrawals(
    userId: string,
    { limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}
  ): Promise<AnyObject> {
    const distributor = await db('distributors').where({ user_id: userId }).first();

    if (!distributor || distributor.status !== 'active') {
      throw {
        statusCode: 403,
        errorCode: 6005,
        message: '您不是活跃的分销员'
      };
    }

    // 查询提现记录
    const withdrawals = (await db('withdrawals')
      .where({ distributor_id: distributor.id })
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)) as WithdrawalRow[];

    // 获取总数
    const totalRow = (await db('withdrawals')
      .where({ distributor_id: distributor.id })
      .count('id as count')
      .first()) as CountRow | undefined;

    // 格式化结果
    const formattedWithdrawals = withdrawals.map((w) => ({
      id: w.id,
      amount: toNumber(w.amount),
      method: normalizeString(w.method),
      accountInfo:
        typeof w.account_info === 'string' ? JSON.parse(w.account_info) : (w.account_info ?? null),
      status: w.status,
      rejectReason: w.reject_reason,
      createdAt: w.created_at,
      approvedAt: w.approved_at
    }));

    return {
      withdrawals: formattedWithdrawals,
      total: parseCount(totalRow)
    };
  }
}

const distributionService = new DistributionService();

export default distributionService;
