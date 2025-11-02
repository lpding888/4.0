/**
 * Membership Plans Repository
 * 艹，会员套餐CRUD+权益关联！
 */

import db from '../db';

export interface MembershipPlan {
  id: number;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  duration_days: number;
  quota_uploads?: number | null;
  quota_storage?: number | null;
  quota_features?: any;
  status: 'active' | 'inactive' | 'archived';
  sort_order: number;
  is_default: boolean;
  is_popular: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PlanWithBenefits extends MembershipPlan {
  benefits: Array<{
    id: number;
    name: string;
    key: string;
    description?: string;
    type: string;
    value?: string;
    custom_value?: string;
    icon?: string;
    color?: string;
    sort_order: number;
  }>;
}

export interface CreatePlanInput {
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency?: string;
  duration_days: number;
  quota_uploads?: number | null;
  quota_storage?: number | null;
  quota_features?: any;
  status?: 'active' | 'inactive';
  sort_order?: number;
  is_default?: boolean;
  is_popular?: boolean;
}

/**
 * 创建套餐
 */
export async function createPlan(input: CreatePlanInput): Promise<MembershipPlan> {
  const [id] = await db('membership_plans').insert({
    ...input,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  const created = await getPlanById(id);
  if (!created) throw new Error('创建套餐后读取失败');

  console.log(`[PLAN] 套餐创建成功: ${created.name} (ID: ${id})`);
  return created;
}

/**
 * 根据ID获取套餐
 */
export async function getPlanById(id: number): Promise<MembershipPlan | null> {
  return await db('membership_plans').where({ id }).first();
}

/**
 * 根据slug获取套餐
 */
export async function getPlanBySlug(slug: string): Promise<MembershipPlan | null> {
  return await db('membership_plans').where({ slug }).first();
}

/**
 * 获取套餐及其权益
 */
export async function getPlanWithBenefits(id: number): Promise<PlanWithBenefits | null> {
  const plan = await getPlanById(id);
  if (!plan) return null;

  // 获取关联的权益
  const benefits = await db('plan_benefits as pb')
    .join('membership_benefits as mb', 'pb.benefit_id', 'mb.id')
    .where('pb.plan_id', id)
    .where('mb.status', 'active')
    .select(
      'mb.id',
      'mb.name',
      'mb.key',
      'mb.description',
      'mb.type',
      'mb.value',
      'pb.custom_value',
      'mb.icon',
      'mb.color',
      'pb.sort_order'
    )
    .orderBy('pb.sort_order', 'asc');

  return { ...plan, benefits };
}

/**
 * 列出套餐
 */
export async function listPlans(options: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<MembershipPlan[]> {
  const { status, limit = 50, offset = 0 } = options;

  let query = db('membership_plans')
    .select('*')
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (status) query = query.where({ status });

  return await query;
}

/**
 * 获取激活的套餐（前台展示用）
 */
export async function getActivePlans(): Promise<PlanWithBenefits[]> {
  const plans = await db('membership_plans')
    .where({ status: 'active' })
    .orderBy('sort_order', 'asc');

  // 批量加载权益
  const plansWithBenefits: PlanWithBenefits[] = [];
  for (const plan of plans) {
    const withBenefits = await getPlanWithBenefits(plan.id);
    if (withBenefits) plansWithBenefits.push(withBenefits);
  }

  return plansWithBenefits;
}

/**
 * 更新套餐
 */
export async function updatePlan(
  id: number,
  updates: Partial<CreatePlanInput>
): Promise<MembershipPlan> {
  const affected = await db('membership_plans')
    .where({ id })
    .update({ ...updates, updated_at: db.fn.now() });

  if (affected === 0) throw new Error(`套餐不存在: ${id}`);

  const updated = await getPlanById(id);
  if (!updated) throw new Error('更新套餐后读取失败');

  console.log(`[PLAN] 套餐更新成功: ${updated.name}`);
  return updated;
}

/**
 * 删除套餐
 */
export async function deletePlan(id: number): Promise<boolean> {
  const affected = await db('membership_plans').where({ id }).delete();

  if (affected > 0) {
    console.log(`[PLAN] 套餐删除成功: ${id}`);
    return true;
  }

  return false;
}

/**
 * 给套餐添加权益
 */
export async function addBenefitToPlan(options: {
  plan_id: number;
  benefit_id: number;
  custom_value?: string;
  sort_order?: number;
}): Promise<void> {
  await db('plan_benefits').insert({
    ...options,
    created_at: db.fn.now(),
  });

  console.log(`[PLAN] 权益添加成功: Plan ${options.plan_id} <- Benefit ${options.benefit_id}`);
}

/**
 * 从套餐移除权益
 */
export async function removeBenefitFromPlan(plan_id: number, benefit_id: number): Promise<boolean> {
  const affected = await db('plan_benefits').where({ plan_id, benefit_id }).delete();

  if (affected > 0) {
    console.log(`[PLAN] 权益移除成功: Plan ${plan_id} <- Benefit ${benefit_id}`);
    return true;
  }

  return false;
}

/**
 * 批量设置套餐权益
 * 艹，先删后加！
 */
export async function setBenefitsForPlan(
  plan_id: number,
  benefits: Array<{ benefit_id: number; custom_value?: string; sort_order?: number }>
): Promise<void> {
  const trx = await db.transaction();

  try {
    // 删除现有权益
    await trx('plan_benefits').where({ plan_id }).delete();

    // 批量插入新权益
    if (benefits.length > 0) {
      await trx('plan_benefits').insert(
        benefits.map((b) => ({
          plan_id,
          ...b,
          created_at: db.fn.now(),
        }))
      );
    }

    await trx.commit();
    console.log(`[PLAN] 套餐权益批量设置成功: Plan ${plan_id}, ${benefits.length}个权益`);
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}
