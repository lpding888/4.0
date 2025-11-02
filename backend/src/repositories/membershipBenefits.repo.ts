/**
 * Membership Benefits Repository
 * 艹，会员权益CRUD！
 */

import db from '../db';

export interface MembershipBenefit {
  id: number;
  name: string;
  key: string;
  description?: string;
  type: 'feature' | 'quota' | 'service' | 'discount';
  value?: string;
  icon?: string;
  color?: string;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

export interface CreateBenefitInput {
  name: string;
  key: string;
  description?: string;
  type: 'feature' | 'quota' | 'service' | 'discount';
  value?: string;
  icon?: string;
  color?: string;
  status?: 'active' | 'inactive';
}

/**
 * 创建权益
 */
export async function createBenefit(input: CreateBenefitInput): Promise<MembershipBenefit> {
  const [id] = await db('membership_benefits').insert({
    ...input,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  const created = await getBenefitById(id);
  if (!created) throw new Error('创建权益后读取失败');

  console.log(`[BENEFIT] 权益创建成功: ${created.name} (ID: ${id})`);
  return created;
}

/**
 * 根据ID获取权益
 */
export async function getBenefitById(id: number): Promise<MembershipBenefit | null> {
  return await db('membership_benefits').where({ id }).first();
}

/**
 * 根据key获取权益
 */
export async function getBenefitByKey(key: string): Promise<MembershipBenefit | null> {
  return await db('membership_benefits').where({ key }).first();
}

/**
 * 列出权益
 */
export async function listBenefits(options: {
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<MembershipBenefit[]> {
  const { type, status, limit = 50, offset = 0 } = options;

  let query = db('membership_benefits')
    .select('*')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (type) query = query.where({ type });
  if (status) query = query.where({ status });

  return await query;
}

/**
 * 获取激活的权益（前台使用）
 */
export async function getActiveBenefits(options?: { type?: string }): Promise<MembershipBenefit[]> {
  let query = db('membership_benefits').where({ status: 'active' }).orderBy('created_at', 'desc');

  if (options?.type) {
    query = query.where({ type: options.type });
  }

  return await query;
}

/**
 * 更新权益
 */
export async function updateBenefit(
  id: number,
  updates: Partial<CreateBenefitInput>
): Promise<MembershipBenefit> {
  const affected = await db('membership_benefits')
    .where({ id })
    .update({ ...updates, updated_at: db.fn.now() });

  if (affected === 0) throw new Error(`权益不存在: ${id}`);

  const updated = await getBenefitById(id);
  if (!updated) throw new Error('更新权益后读取失败');

  console.log(`[BENEFIT] 权益更新成功: ${updated.name}`);
  return updated;
}

/**
 * 删除权益
 */
export async function deleteBenefit(id: number): Promise<boolean> {
  const affected = await db('membership_benefits').where({ id }).delete();

  if (affected > 0) {
    console.log(`[BENEFIT] 权益删除成功: ${id}`);
    return true;
  }

  return false;
}
