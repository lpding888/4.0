/**
 * Content Texts Repository
 * 艹，多语言文案配置CRUD！
 */

import { db } from '../config/database.js';
import type { Knex } from 'knex';

export interface ContentText {
  id: number;
  page: string;
  section?: string | null;
  key: string;
  language: string;
  value: string;
  description?: string;
  status: 'active' | 'inactive';
  version: number;
  created_by?: number;
  updated_by?: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTextInput {
  page: string;
  section?: string | null;
  key: string;
  language?: string;
  value: string;
  description?: string;
  status?: 'active' | 'inactive';
  created_by?: number;
}

/**
 * 创建文案
 */
export async function createText(input: CreateTextInput): Promise<ContentText> {
  const inserted = (await db<ContentText>('content_texts').insert({
    ...input,
    language: input.language || 'zh-CN',
    created_at: db.fn.now(),
    updated_at: db.fn.now()
  })) as number[];

  const [id] = inserted;

  const created = await getTextById(id);
  if (!created) throw new Error('创建文案后读取失败');

  console.log(`[TEXT] 文案创建成功: ${created.page}/${created.key} (${created.language})`);
  return created;
}

/**
 * 根据ID获取文案
 */
export async function getTextById(id: number): Promise<ContentText | null> {
  const result = await db<ContentText>('content_texts').where({ id }).first();
  return result ?? null;
}

/**
 * 获取特定文案
 */
export async function getText(params: {
  page: string;
  section?: string | null;
  key: string;
  language?: string;
}): Promise<ContentText | null> {
  const { page, section, key, language = 'zh-CN' } = params;

  let query = db<ContentText>('content_texts').where({
    page,
    key,
    language,
    status: 'active'
  });

  if (section !== undefined) {
    query = section === null ? query.whereNull('section') : query.where('section', section);
  }

  const result = await query.first();
  return result ?? null;
}

/**
 * 批量获取页面文案（前台使用）
 * 返回格式：{ section: { key: value } } 或 { key: value }（无section）
 */
export async function getPageTexts(params: {
  page: string;
  language?: string;
}): Promise<Record<string, unknown>> {
  const { page, language = 'zh-CN' } = params;

  const texts = await db<ContentText>('content_texts')
    .where({ page, language, status: 'active' })
    .select('section', 'key', 'value');

  // 艹，组织成层级结构
  const result: Record<string, unknown> = {};

  for (const text of texts) {
    if (text.section) {
      if (!result[text.section]) result[text.section] = {};
      const sectionGroup = result[text.section] as Record<string, unknown>;
      sectionGroup[text.key] = text.value;
    } else {
      result[text.key] = text.value;
    }
  }

  return result;
}

/**
 * 列出文案（管理端）
 */
export async function listTexts(options: {
  page?: string;
  section?: string;
  language?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ContentText[]> {
  const { page, section, language, status, limit = 50, offset = 0 } = options;

  let query = db<ContentText>('content_texts')
    .select('*')
    .orderBy('page', 'asc')
    .orderBy('section', 'asc')
    .orderBy('key', 'asc')
    .orderBy('language', 'asc')
    .limit(limit)
    .offset(offset);

  if (page) query = query.where('page', page);
  if (section !== undefined) {
    query = section === '' ? query.whereNull('section') : query.where('section', section);
  }
  if (language) query = query.where('language', language);
  if (status) query = query.where('status', status);

  return await query;
}

/**
 * 更新文案
 */
export async function updateText(
  id: number,
  updates: Partial<CreateTextInput> & { updated_by?: number }
): Promise<ContentText> {
  const affected = await db<ContentText>('content_texts')
    .where({ id })
    .update({
      ...updates,
      // 每次更新version+1
      version: db.raw('version + 1'),
      updated_at: db.fn.now()
    });

  if (affected === 0) throw new Error(`文案不存在: ${id}`);

  const updated = await getTextById(id);
  if (!updated) throw new Error('更新文案后读取失败');

  console.log(`[TEXT] 文案更新成功: ${updated.page}/${updated.key}`);
  return updated;
}

/**
 * 删除文案
 */
export async function deleteText(id: number): Promise<boolean> {
  const affected = await db<ContentText>('content_texts').where({ id }).delete();

  if (affected > 0) {
    console.log(`[TEXT] 文案删除成功: ${id}`);
    return true;
  }

  return false;
}

/**
 * 批量导入/更新文案
 * 艹，upsert操作！存在则更新，不存在则插入
 */
export async function batchUpsertTexts(
  texts: CreateTextInput[],
  updated_by?: number
): Promise<{ created: number; updated: number }> {
  const trx = await db.transaction();
  let created = 0;
  let updated = 0;

  try {
    for (const text of texts) {
      // 检查是否存在
      const existing = await trx<ContentText>('content_texts')
        .where({
          page: text.page,
          section: text.section || null,
          key: text.key,
          language: text.language || 'zh-CN'
        })
        .first();

      if (existing) {
        // 更新
        await trx<ContentText>('content_texts')
          .where({ id: existing.id })
          .update({
            value: text.value,
            description: text.description,
            status: text.status || 'active',
            updated_by,
            version: db.raw('version + 1'),
            updated_at: db.fn.now()
          });
        updated++;
      } else {
        // 插入
        await trx<ContentText>('content_texts').insert({
          ...text,
          language: text.language || 'zh-CN',
          created_by: updated_by,
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
        created++;
      }
    }

    await trx.commit();
    console.log(`[TEXT] 批量导入成功: 创建${created}条, 更新${updated}条`);
    return { created, updated };
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}
