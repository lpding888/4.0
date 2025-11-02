/**
 * Banners Repository
 * 艹，轮播图CRUD+排序！
 */

import db from '../db';

export interface Banner {
  id: number;
  title: string;
  image_url: string;
  link_url?: string;
  description?: string;
  sort_order: number;
  status: 'draft' | 'published' | 'expired';
  publish_at?: Date | null;
  expire_at?: Date | null;
  target_audience: 'all' | 'member' | 'vip';
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBannerInput {
  title: string;
  image_url: string;
  link_url?: string;
  description?: string;
  sort_order?: number;
  status?: 'draft' | 'published';
  publish_at?: Date | null;
  expire_at?: Date | null;
  target_audience?: 'all' | 'member' | 'vip';
  created_by?: number;
}

export async function createBanner(input: CreateBannerInput): Promise<Banner> {
  const [id] = await db('banners').insert({
    ...input,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  const created = await getBannerById(id);
  if (!created) throw new Error('创建轮播图后读取失败');

  console.log(`[BANNER] 轮播图创建成功: ${created.title} (ID: ${id})`);
  return created;
}

export async function getBannerById(id: number): Promise<Banner | null> {
  return await db('banners').where({ id }).first();
}

export async function listBanners(options: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<Banner[]> {
  const { status, limit = 50, offset = 0 } = options;

  let query = db('banners')
    .select('*')
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (status) query = query.where({ status });

  return await query;
}

export async function getActiveBanners(options: {
  target_audience?: 'all' | 'member' | 'vip';
}): Promise<Banner[]> {
  const { target_audience = 'all' } = options;

  let query = db('banners')
    .where({ status: 'published' })
    .where((builder) => {
      builder.whereNull('publish_at').orWhere('publish_at', '<=', db.fn.now());
    })
    .where((builder) => {
      builder.whereNull('expire_at').orWhere('expire_at', '>', db.fn.now());
    })
    .orderBy('sort_order', 'asc');

  if (target_audience !== 'all') {
    query = query.whereIn('target_audience', ['all', target_audience]);
  }

  return await query;
}

export async function updateBanner(
  id: number,
  updates: Partial<CreateBannerInput>
): Promise<Banner> {
  const affected = await db('banners')
    .where({ id })
    .update({ ...updates, updated_at: db.fn.now() });

  if (affected === 0) throw new Error(`轮播图不存在: ${id}`);

  const updated = await getBannerById(id);
  if (!updated) throw new Error('更新轮播图后读取失败');

  console.log(`[BANNER] 轮播图更新成功: ${updated.title}`);
  return updated;
}

/**
 * 批量更新排序
 * 艹，拖拽排序用这个！
 */
export async function updateBannersSortOrder(
  sortOrders: { id: number; sort_order: number }[]
): Promise<void> {
  const trx = await db.transaction();

  try {
    for (const { id, sort_order } of sortOrders) {
      await trx('banners').where({ id }).update({ sort_order, updated_at: db.fn.now() });
    }

    await trx.commit();
    console.log(`[BANNER] 批量更新排序成功: ${sortOrders.length}条`);
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

export async function deleteBanner(id: number): Promise<boolean> {
  const affected = await db('banners').where({ id }).delete();

  if (affected > 0) {
    console.log(`[BANNER] 轮播图删除成功: ${id}`);
    return true;
  }

  return false;
}
