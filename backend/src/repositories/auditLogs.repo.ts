/**
 * Audit Logs Repository
 * 艹，审计日志CRUD！
 */

import db from '../db';

export interface AuditLog {
  id: number;
  entity_type: string;
  entity_id?: number;
  action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish' | 'approve' | 'reject';
  user_id?: number;
  user_name?: string;
  changes?: any;
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface CreateAuditLogInput {
  entity_type: string;
  entity_id?: number;
  action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish' | 'approve' | 'reject';
  user_id?: number;
  user_name?: string;
  changes?: any;
  reason?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * 创建审计日志
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
  const [id] = await db('audit_logs').insert({
    ...input,
    created_at: db.fn.now(),
  });

  const created = await getAuditLogById(id);
  if (!created) throw new Error('创建审计日志后读取失败');

  console.log(`[AUDIT] 日志记录: ${input.entity_type}/${input.entity_id} ${input.action}`);
  return created;
}

/**
 * 根据ID获取审计日志
 */
export async function getAuditLogById(id: number): Promise<AuditLog | null> {
  return await db('audit_logs').where({ id }).first();
}

/**
 * 列出审计日志
 */
export async function listAuditLogs(options: {
  entity_type?: string;
  entity_id?: number;
  user_id?: number;
  action?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}): Promise<AuditLog[]> {
  const { entity_type, entity_id, user_id, action, start_date, end_date, limit = 50, offset = 0 } =
    options;

  let query = db('audit_logs')
    .select('*')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (entity_type) query = query.where({ entity_type });
  if (entity_id) query = query.where({ entity_id });
  if (user_id) query = query.where({ user_id });
  if (action) query = query.where({ action });
  if (start_date) query = query.where('created_at', '>=', start_date);
  if (end_date) query = query.where('created_at', '<=', end_date);

  return await query;
}

/**
 * 获取实体的操作历史
 */
export async function getEntityHistory(
  entity_type: string,
  entity_id: number
): Promise<AuditLog[]> {
  return await db('audit_logs')
    .where({ entity_type, entity_id })
    .orderBy('created_at', 'desc');
}

/**
 * 获取用户操作历史
 */
export async function getUserHistory(user_id: number, limit = 100): Promise<AuditLog[]> {
  return await db('audit_logs')
    .where({ user_id })
    .orderBy('created_at', 'desc')
    .limit(limit);
}

/**
 * 统计操作数量
 */
export async function countAuditLogs(options: {
  entity_type?: string;
  user_id?: number;
  action?: string;
  start_date?: Date;
  end_date?: Date;
}): Promise<number> {
  const { entity_type, user_id, action, start_date, end_date } = options;

  let query = db('audit_logs').count('* as count');

  if (entity_type) query = query.where({ entity_type });
  if (user_id) query = query.where({ user_id });
  if (action) query = query.where({ action });
  if (start_date) query = query.where('created_at', '>=', start_date);
  if (end_date) query = query.where('created_at', '<=', end_date);

  const result = await query.first();
  return parseInt(result?.count as string) || 0;
}
