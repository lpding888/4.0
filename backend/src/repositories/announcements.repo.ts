/**
 * Announcements Repository
 * 艹，这个tm负责公告的CRUD操作！
 */

import db from '../db';

/**
 * 公告接口
 */
export interface Announcement {
  id: number;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  position: 'top' | 'modal' | 'banner';
  priority: number;
  status: 'draft' | 'published' | 'expired';
  publish_at?: Date | null;
  expire_at?: Date | null;
  target_audience: 'all' | 'member' | 'vip';
  closable: boolean;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建公告输入
 */
export interface CreateAnnouncementInput {
  title: string;
  content: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  position?: 'top' | 'modal' | 'banner';
  priority?: number;
  status?: 'draft' | 'published';
  publish_at?: Date | null;
  expire_at?: Date | null;
  target_audience?: 'all' | 'member' | 'vip';
  closable?: boolean;
  created_by?: number;
}

/**
 * 创建公告
 */
export async function createAnnouncement(
  input: CreateAnnouncementInput
): Promise<Announcement> {
  const [id] = await db('announcements').insert({
    ...input,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  const created = await getAnnouncementById(id);
  if (!created) {
    throw new Error('创建公告后读取失败');
  }

  console.log(`[ANNOUNCEMENT] 公告创建成功: ${created.title} (ID: ${id})`);
  return created;
}

/**
 * 根据ID获取公告
 */
export async function getAnnouncementById(
  id: number
): Promise<Announcement | null> {
  return await db('announcements').where({ id }).first();
}

/**
 * 列出公告
 */
export async function listAnnouncements(options: {
  status?: string;
  position?: string;
  limit?: number;
  offset?: number;
  includeExpired?: boolean;
}): Promise<Announcement[]> {
  const {
    status,
    position,
    limit = 50,
    offset = 0,
    includeExpired = false,
  } = options;

  let query = db('announcements')
    .select('*')
    .orderBy('priority', 'desc')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (status) {
    query = query.where({ status });
  }

  if (position) {
    query = query.where({ position });
  }

  // 艹，默认不返回已过期的
  if (!includeExpired) {
    query = query.where((builder) => {
      builder
        .whereNull('expire_at')
        .orWhere('expire_at', '>', db.fn.now());
    });
  }

  return await query;
}

/**
 * 获取当前有效的公告（前台使用）
 */
export async function getActiveAnnouncements(options: {
  position?: string;
  target_audience?: 'all' | 'member' | 'vip';
}): Promise<Announcement[]> {
  const { position, target_audience = 'all' } = options;

  let query = db('announcements')
    .where({ status: 'published' })
    .where((builder) => {
      // 艹，已到发布时间或没有设置发布时间
      builder.whereNull('publish_at').orWhere('publish_at', '<=', db.fn.now());
    })
    .where((builder) => {
      // 艹，未过期或没有设置过期时间
      builder.whereNull('expire_at').orWhere('expire_at', '>', db.fn.now());
    })
    .orderBy('priority', 'desc')
    .orderBy('created_at', 'desc');

  if (position) {
    query = query.where({ position });
  }

  // 艹，受众过滤（all可以看到所有）
  if (target_audience !== 'all') {
    query = query.whereIn('target_audience', ['all', target_audience]);
  }

  return await query;
}

/**
 * 更新公告
 */
export async function updateAnnouncement(
  id: number,
  updates: Partial<CreateAnnouncementInput>
): Promise<Announcement> {
  const affected = await db('announcements')
    .where({ id })
    .update({
      ...updates,
      updated_at: db.fn.now(),
    });

  if (affected === 0) {
    throw new Error(`公告不存在: ${id}`);
  }

  const updated = await getAnnouncementById(id);
  if (!updated) {
    throw new Error('更新公告后读取失败');
  }

  console.log(`[ANNOUNCEMENT] 公告更新成功: ${updated.title}`);
  return updated;
}

/**
 * 删除公告
 */
export async function deleteAnnouncement(id: number): Promise<boolean> {
  const affected = await db('announcements').where({ id }).delete();

  if (affected > 0) {
    console.log(`[ANNOUNCEMENT] 公告删除成功: ${id}`);
    return true;
  }

  return false;
}

/**
 * 批量更新过期状态（定时任务使用）
 */
export async function updateExpiredAnnouncements(): Promise<number> {
  const affected = await db('announcements')
    .where({ status: 'published' })
    .where('expire_at', '<=', db.fn.now())
    .update({
      status: 'expired',
      updated_at: db.fn.now(),
    });

  if (affected > 0) {
    console.log(`[ANNOUNCEMENT] 更新${affected}个过期公告`);
  }

  return affected;
}

/**
 * 批量发布到期的公告（定时任务使用）
 */
export async function publishScheduledAnnouncements(): Promise<number> {
  const affected = await db('announcements')
    .where({ status: 'draft' })
    .whereNotNull('publish_at')
    .where('publish_at', '<=', db.fn.now())
    .update({
      status: 'published',
      updated_at: db.fn.now(),
    });

  if (affected > 0) {
    console.log(`[ANNOUNCEMENT] 发布${affected}个定时公告`);
  }

  return affected;
}
