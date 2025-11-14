import crypto from 'crypto';
import logger from '../utils/logger.js';
import { db } from '../config/database.js';
import cacheService from './cache.service.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';

type InviteCodeStatus = 'active' | 'used' | 'expired' | 'disabled';

type CountRow = {
  count?: string | number | bigint | null;
};

type GenerateCodesOptions = {
  count?: number;
  type?: string;
  maxUses?: number;
  validDays?: number;
  batchName?: string | null;
  description?: string | null;
  createdBy?: string;
};

type InviteCode = {
  id: string;
  code: string;
  type: string;
  status: InviteCodeStatus;
  creator_id: string | null;
  creator_type: string;
  max_uses: number;
  used_count: number;
  expires_at: Date | string;
  batch_id: string;
  inviter_id: string | null;
  invitee_id: string | null;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
  last_used_at?: Date | string;
};

type InviteCodeBatch = {
  id: string;
  batch_name: string;
  description: string;
  type: string;
  count: number;
  valid_days: number;
  max_uses_per_code: number;
  created_by: string;
  generation_config: Record<string, unknown>;
};

type UsageData = {
  inviteeId?: string | null;
  inviterId?: string | null;
  inviteeEmail?: string | null;
  inviteePhone?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

type UseInviteCodeResult = {
  success: boolean;
  inviteCode: {
    id: string;
    type: string;
    remainingUses: number;
  };
};

type GetCodesOptions = {
  status?: string;
  type?: string;
  creatorId?: string;
  inviterId?: string;
  inviteeId?: string;
  batchId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

type UserInviteStats = {
  user_id: string;
  total_invites: number;
  successful_invites: number;
  pending_invites: number;
  failed_invites: number;
  total_rewards: number;
  last_invite_date: string | null;
  monthly_stats: Record<string, unknown>;
  created_at?: Date | string;
  updated_at?: Date | string;
};

type InviteStats = {
  total: number;
  active: number;
  used: number;
  expired: number;
  disabled: number;
  byType: Record<string, number>;
  initialized: boolean;
  cachePrefix: string;
  cacheTTL: number;
};

const parseCount = (row?: CountRow): number => {
  if (!row || row.count === undefined || row.count === null) {
    return 0;
  }

  if (typeof row.count === 'number') {
    return row.count;
  }

  if (typeof row.count === 'bigint') {
    return Number(row.count);
  }

  const parsed = Number(row.count);
  return Number.isFinite(parsed) ? parsed : 0;
};

class InviteCodeService {
  private initialized = false;
  private readonly cachePrefix = 'invite_code:';
  private readonly cacheTTL = 300;
  private readonly codeLength = 8;
  private readonly codePattern = /^[A-Z0-9]+$/;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('[InviteCodeService] Initializing invite code service...');
    await db('invite_codes').select(1).first();
    await this.cleanupExpiredCodes();
    this.initialized = true;
    logger.info('[InviteCodeService] Invite code service initialized successfully');
  }

  generateCode(length: number = this.codeLength): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';

    for (let i = 0; i < length; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  }

  async generateInviteCodes(options: GenerateCodesOptions = {}): Promise<InviteCode[]> {
    const {
      count = 10,
      type = 'general',
      maxUses = 1,
      validDays = 30,
      batchName = null,
      description = null,
      createdBy = 'system'
    } = options;

    const codes: InviteCode[] = [];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validDays);

    const trx = await db.transaction();

    try {
      const [batch] = await trx('invite_code_batches')
        .insert({
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
        })
        .returning('*');

      for (let i = 0; i < count; i += 1) {
        let code: string;
        let attempts = 0;
        const maxAttempts = 10;

        do {
          code = this.generateCode();
          attempts += 1;
          if (attempts > maxAttempts) {
            throw new Error('Failed to generate unique invite code after multiple attempts');
          }
        } while (await this.isCodeExists(code));

        const [inviteCode] = await trx('invite_codes')
          .insert({
            code,
            type,
            status: 'active',
            creator_id: null,
            creator_type: 'system',
            max_uses: maxUses,
            used_count: 0,
            expires_at: expiresAt,
            batch_id: batch.id,
            created_by: createdBy,
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning('*');

        codes.push(inviteCode);
      }

      await trx.commit();
      logger.info(`[InviteCodeService] Generated ${codes.length} invite codes of type ${type}`);
      return codes;
    } catch (error) {
      await trx.rollback();
      logger.error('[InviteCodeService] Failed to generate invite codes:', error);
      throw AppError.fromError(error, ERROR_CODES.TASK_CREATION_FAILED);
    }
  }

  async isCodeExists(code: string): Promise<boolean> {
    const existing = await db('invite_codes').where('code', code).first();
    return Boolean(existing);
  }

  async validateInviteCode(code: string): Promise<InviteCode> {
    const normalizedCode = code.toUpperCase().trim();

    if (!this.codePattern.test(normalizedCode)) {
      throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
        code: normalizedCode,
        reason: 'INVALID_FORMAT'
      });
    }

    const cacheKey = `${this.cachePrefix}validate:${normalizedCode}`;
    const cachedData = await cacheService.get<InviteCode>(cacheKey);

    if (cachedData) {
      logger.debug(`[InviteCodeService] Cache hit for code ${normalizedCode}`);
      return cachedData;
    }

    const inviteCode = await db('invite_codes').where('code', normalizedCode).first();

    if (!inviteCode) {
      throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
        code: normalizedCode,
        reason: 'CODE_NOT_FOUND'
      });
    }

    if (inviteCode.status !== 'active') {
      throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
        code: normalizedCode,
        reason: 'CODE_NOT_ACTIVE',
        status: inviteCode.status
      });
    }

    if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
      throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
        code: normalizedCode,
        reason: 'CODE_EXPIRED'
      });
    }

    if (inviteCode.max_uses && inviteCode.used_count >= inviteCode.max_uses) {
      throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
        code: normalizedCode,
        reason: 'CODE_USED_UP'
      });
    }

    await cacheService.set<InviteCode>(cacheKey, inviteCode, { ttl: this.cacheTTL });
    return inviteCode;
  }

  async useInviteCode(code: string, usageData: UsageData = {}): Promise<UseInviteCodeResult> {
    const normalizedCode = code.toUpperCase().trim();

    return db.transaction(async (trx) => {
      const inviteCode = await trx('invite_codes')
        .where('code', normalizedCode)
        .forUpdate()
        .first();

      if (!inviteCode) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          code: normalizedCode,
          reason: 'CODE_NOT_FOUND'
        });
      }

      if (inviteCode.status !== 'active') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          code: normalizedCode,
          reason: 'CODE_NOT_ACTIVE',
          status: inviteCode.status
        });
      }

      if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
        await trx('invite_codes')
          .where('code', normalizedCode)
          .update({ status: 'expired', updated_at: new Date() });
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          code: normalizedCode,
          reason: 'CODE_EXPIRED'
        });
      }

      if (inviteCode.max_uses && inviteCode.used_count >= inviteCode.max_uses) {
        await trx('invite_codes')
          .where('code', normalizedCode)
          .update({ status: 'used', updated_at: new Date() });
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          code: normalizedCode,
          reason: 'CODE_USED_UP'
        });
      }

      const now = new Date();
      const inviteeId = usageData.inviteeId || null;
      const inviterId = usageData.inviterId || inviteCode.inviter_id || null;
      const inviteeEmail = usageData.inviteeEmail || null;
      const inviteePhone = usageData.inviteePhone || null;
      const ipAddress = usageData.ipAddress || null;
      const userAgent = usageData.userAgent || null;

      await trx('invite_usage_logs').insert({
        invite_code_id: inviteCode.id,
        invite_code: inviteCode.code,
        inviter_id: inviterId,
        invitee_id: inviteeId,
        invitee_email: inviteeEmail,
        invitee_phone: inviteePhone,
        status: 'pending',
        metadata: usageData.metadata || {},
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: now,
        updated_at: now
      });

      const newUsedCount = inviteCode.used_count + 1;
      const newStatus =
        inviteCode.max_uses && newUsedCount >= inviteCode.max_uses ? 'used' : inviteCode.status;

      await trx('invite_codes').where('code', normalizedCode).update({
        used_count: newUsedCount,
        status: newStatus,
        last_used_at: now,
        updated_at: now
      });

      if (inviterId) {
        await this.updateUserInviteStats(inviterId, 'success');
      }

      if (inviteeId) {
        await this.updateUserInviteStats(inviteeId, 'received');
      }

      await cacheService.delete(`${this.cachePrefix}validate:${normalizedCode}`);

      logger.info(`[InviteCodeService] Invite code used: ${normalizedCode} by ${inviteeId}`);

      return {
        success: true,
        inviteCode: {
          id: inviteCode.id,
          type: inviteCode.type,
          remainingUses: inviteCode.max_uses - newUsedCount
        }
      };
    });
  }

  async getInviteCodes(options: GetCodesOptions = {}): Promise<InviteCode[]> {
    const {
      status,
      type,
      creatorId,
      inviterId,
      inviteeId,
      batchId,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    let query = db('invite_codes')
      .select('*')
      .orderBy(
        sortBy === 'updated_at' ? 'updated_at' : 'created_at',
        sortOrder === 'asc' ? 'asc' : 'desc'
      );

    if (status) query = query.where('status', status);
    if (type) query = query.where('type', type);
    if (creatorId) query = query.where('creator_id', creatorId);
    if (inviterId) query = query.where('inviter_id', inviterId);
    if (inviteeId) query = query.where('invitee_id', inviteeId);
    if (batchId) query = query.where('batch_id', batchId);

    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);

    return query;
  }

  async updateUserInviteStats(
    userId: string,
    action: 'created' | 'success' | 'failed' | 'received'
  ): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    await db.transaction(async (trx) => {
      let stats = await trx('user_invite_stats').where('user_id', userId).first();

      if (!stats) {
        [stats] = await trx('user_invite_stats')
          .insert({
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
          })
          .returning('*');
      }

      const updates: Record<string, unknown> = { updated_at: now };

      switch (action) {
        case 'created':
          updates.total_invites = Number(stats.total_invites || 0) + 1;
          updates.pending_invites = Number(stats.pending_invites || 0) + 1;
          break;
        case 'success':
          updates.successful_invites = Number(stats.successful_invites || 0) + 1;
          updates.pending_invites = Math.max(0, Number(stats.pending_invites || 0) - 1);
          updates.last_invite_date = today;
          break;
        case 'failed':
          updates.failed_invites = Number(stats.failed_invites || 0) + 1;
          updates.pending_invites = Math.max(0, Number(stats.pending_invites || 0) - 1);
          break;
        case 'received':
          updates.last_invite_date = today;
          break;
        default:
          break;
      }

      await trx('user_invite_stats').where('user_id', userId).update(updates);
    });
  }

  async getUserInviteStats(userId: string): Promise<UserInviteStats> {
    const stats = await db('user_invite_stats').where('user_id', userId).first();
    return (
      stats ?? {
        user_id: userId,
        total_invites: 0,
        successful_invites: 0,
        pending_invites: 0,
        failed_invites: 0,
        total_rewards: 0,
        last_invite_date: null,
        monthly_stats: {}
      }
    );
  }

  async getInviteUsageLogs(
    options: InviteUsageLogOptions = {}
  ): Promise<Record<string, unknown>[]> {
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

    if (inviteCodeId) query = query.where('invite_usage_logs.invite_code_id', inviteCodeId);
    if (inviterId) query = query.where('invite_usage_logs.inviter_id', inviterId);
    if (inviteeId) query = query.where('invite_usage_logs.invitee_id', inviteeId);
    if (status) query = query.where('invite_usage_logs.status', status);

    const validSortFields = ['created_at', 'updated_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    query = query.orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc');

    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);

    return query;
  }

  async cleanupExpiredCodes(): Promise<void> {
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

  async disableInviteCode(code: string): Promise<boolean> {
    try {
      const normalizedCode = code.toUpperCase().trim();
      const result = await db('invite_codes').where('code', normalizedCode).update({
        status: 'disabled',
        updated_at: new Date()
      });

      if (result > 0) {
        await cacheService.delete(`${this.cachePrefix}validate:${normalizedCode}`);
        logger.info(`[InviteCodeService] Disabled invite code: ${normalizedCode}`);
      }

      return result > 0;
    } catch (error) {
      logger.error('[InviteCodeService] Failed to disable invite code:', error);
      return false;
    }
  }

  async getStats(): Promise<InviteStats> {
    try {
      const [totalCodes, activeCodes, usedCodes, expiredCodes, disabledCodes] = await Promise.all([
        db('invite_codes').count<CountRow[]>('*'),
        db('invite_codes').where('status', 'active').count<CountRow[]>('*'),
        db('invite_codes').where('status', 'used').count<CountRow[]>('*'),
        db('invite_codes').where('expires_at', '<', db.fn.now()).count<CountRow[]>('*'),
        db('invite_codes').where('status', 'disabled').count<CountRow[]>('*')
      ]);

      const statsByType = await db('invite_codes')
        .select('type')
        .count('* as count')
        .groupBy('type');

      return {
        total: parseCount(totalCodes[0]),
        active: parseCount(activeCodes[0]),
        used: parseCount(usedCodes[0]),
        expired: parseCount(expiredCodes[0]),
        disabled: parseCount(disabledCodes[0]),
        byType: statsByType.reduce<Record<string, number>>((acc, item) => {
          acc[item.type] = Number(item.count);
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

  async getInviteCodeStats(): Promise<InviteStats> {
    return this.getStats();
  }

  async close(): Promise<void> {
    this.initialized = false;
    logger.info('[InviteCodeService] Invite code service closed');
  }
}

type InviteUsageLogOptions = {
  inviteCodeId?: string;
  inviterId?: string;
  inviteeId?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

const inviteCodeService = new InviteCodeService();
export default inviteCodeService;
