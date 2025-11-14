/**
 * Import/Export Service
 * 艹，通用批量导入导出服务！
 * 支持CSV和JSON格式
 */

import * as textRepo from '../repositories/contentTexts.repo.js';
import type { CreateTextInput } from '../repositories/contentTexts.repo.js';
import * as announcementRepo from '../repositories/announcements.repo.js';
import * as bannerRepo from '../repositories/banners.repo.js';
import * as planRepo from '../repositories/membershipPlans.repo.js';
import * as benefitRepo from '../repositories/membershipBenefits.repo.js';

interface CSVRow {
  [key: string]: unknown;
}

const toStringSafe = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean')
    return String(value);
  return fallback;
};

const toNullableString = (value: unknown): string | null => {
  const normalized = toStringSafe(value, '');
  return normalized ? normalized : null;
};

const toNumberSafe = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return Boolean(value);
};

const toStatus = (value: unknown): 'active' | 'inactive' =>
  value === 'inactive' ? 'inactive' : 'active';

const toNullableDateString = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
  }
  return null;
};

/**
 * 内容文案导出对象
 */
export interface ContentTextExport extends CSVRow {
  page: string;
  section: string | null;
  key: string;
  language: string;
  value: string;
  description?: string;
  status: 'active' | 'inactive';
}

/**
 * 公告导出对象
 */
interface AnnouncementExport extends CSVRow {
  title: string;
  content: string;
  type: string;
  position: string;
  priority: number;
  status: string;
  publish_at?: string | null;
  expire_at?: string | null;
  target_audience?: string;
}

/**
 * 轮播图导出对象
 */
interface BannerExport extends CSVRow {
  title: string;
  image_url: string;
  link_url: string;
  description?: string;
  sort_order: number;
  status: string;
  publish_at?: string | null;
  expire_at?: string | null;
  target_audience?: string;
}

/**
 * 套餐导出对象
 */
interface PlanExport extends CSVRow {
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  duration_days: number;
  quota_uploads: number;
  quota_storage: number;
  quota_features: number;
  status: string;
  sort_order: number;
  is_default: boolean;
  is_popular: boolean;
}

/**
 * 权益导出对象
 */
interface BenefitExport extends CSVRow {
  name: string;
  key: string;
  description?: string;
  type: string;
  value: unknown;
  icon?: string;
  color?: string;
  status: string;
}

/**
 * 导入错误对象
 */
interface ImportError {
  error: string;
  [key: string]: unknown;
}

/**
 * 导入结果
 */
interface ImportResult {
  created: number;
  updated: number;
  errors: ImportError[];
}

/**
 * 导出选项
 */
interface ExportOptions {
  page?: string;
  language?: string;
  [key: string]: unknown;
}

// CSVRow 已提前定义

/**
 * 导出文案为JSON
 */
export async function exportContentTextsJSON(
  options?: ExportOptions
): Promise<ContentTextExport[]> {
  const texts = await textRepo.listTexts({
    page: options?.page,
    language: options?.language,
    limit: 10000 // 艹，大批量导出
  });

  return texts.map((t) => ({
    page: toStringSafe(t.page),
    section: t.section ?? null,
    key: toStringSafe(t.key),
    language: toStringSafe(t.language || 'zh-CN', 'zh-CN'),
    value: toStringSafe(t.value),
    description: t.description ? toStringSafe(t.description) : undefined,
    status: toStatus(t.status)
  }));
}

/**
 * 导出文案为CSV
 */
export function convertToCSV(data: CSVRow[], fields: string[]): string {
  // 艹，CSV头部
  const header = fields.join(',');

  // 艹，CSV行
  const rows = data.map((item) =>
    fields
      .map((field) => {
        const value = item[field] || '';
        // 转义双引号和换行符
        return `"${String(value).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      })
      .join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * 导出文案为CSV格式
 */
export async function exportContentTextsCSV(options?: {
  page?: string;
  language?: string;
}): Promise<string> {
  const data = await exportContentTextsJSON(options);
  const fields = ['page', 'section', 'key', 'language', 'value', 'description', 'status'];
  return convertToCSV(data, fields);
}

/**
 * 导入文案JSON
 */
export async function importContentTextsJSON(
  data: ContentTextExport[],
  updated_by?: number
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let created = 0;
  let updated = 0;

  const payload: CreateTextInput[] = data.map((item) => ({
    page: toStringSafe(item.page),
    section: item.section ?? null,
    key: toStringSafe(item.key),
    language: toStringSafe(item.language || 'zh-CN', 'zh-CN'),
    value: toStringSafe(item.value),
    description: item.description ? toStringSafe(item.description) : undefined,
    status: toStatus(item.status),
    created_by: updated_by
  }));

  try {
    const result = await textRepo.batchUpsertTexts(payload, updated_by);
    created = result.created;
    updated = result.updated;
  } catch (error: unknown) {
    const err = error as Error;
    errors.push({ error: err.message });
  }

  return { created, updated, errors };
}

/**
 * 解析CSV为JSON
 */
export function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  // 艹，解析头部
  const header = lines[0].split(',').map((h) => h.trim());

  // 艹，解析数据行
  const data: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // 简单CSV解析（不处理复杂的引号转义）
    const values = line.split(',').map((v) => v.trim().replace(/^"(.*)"$/, '$1'));

    const obj: CSVRow = {};
    header.forEach((key, index) => {
      obj[key] = values[index] || null;
    });

    data.push(obj);
  }

  return data;
}

/**
 * 导出公告为JSON
 */
export async function exportAnnouncementsJSON(): Promise<AnnouncementExport[]> {
  const announcements = await announcementRepo.listAnnouncements({
    limit: 10000
  });

  return announcements.map((a) => ({
    title: toStringSafe(a.title),
    content: toStringSafe(a.content),
    type: toStringSafe(a.type),
    position: toStringSafe(a.position),
    priority: toNumberSafe(a.priority),
    status: toStringSafe(a.status),
    publish_at: toNullableDateString(a.publish_at),
    expire_at: toNullableDateString(a.expire_at),
    target_audience: toNullableString(a.target_audience) ?? undefined
  }));
}

/**
 * 导出轮播图为JSON
 */
export async function exportBannersJSON(): Promise<BannerExport[]> {
  const banners = await bannerRepo.listBanners({
    limit: 10000
  });

  return banners.map((b) => ({
    title: toStringSafe(b.title),
    image_url: toStringSafe(b.image_url),
    link_url: toStringSafe(b.link_url, ''),
    description: b.description ? toStringSafe(b.description) : undefined,
    sort_order: toNumberSafe(b.sort_order),
    status: toStringSafe(b.status),
    publish_at: toNullableDateString(b.publish_at),
    expire_at: toNullableDateString(b.expire_at),
    target_audience: toNullableString(b.target_audience) ?? undefined
  }));
}

/**
 * 导出套餐为JSON
 */
export async function exportPlansJSON(): Promise<PlanExport[]> {
  const plans = await planRepo.listPlans({
    limit: 10000
  });

  return plans.map((p) => ({
    name: toStringSafe(p.name),
    slug: toStringSafe(p.slug),
    description: p.description ? toStringSafe(p.description) : undefined,
    price: toNumberSafe(p.price),
    currency: toStringSafe(p.currency),
    duration_days: toNumberSafe(p.duration_days),
    quota_uploads: toNumberSafe(p.quota_uploads, 0),
    quota_storage: toNumberSafe(p.quota_storage, 0),
    quota_features: toNumberSafe(p.quota_features, 0),
    status: toStringSafe(p.status),
    sort_order: toNumberSafe(p.sort_order, 0),
    is_default: toBoolean(p.is_default),
    is_popular: toBoolean(p.is_popular)
  }));
}

/**
 * 导出权益为JSON
 */
export async function exportBenefitsJSON(): Promise<BenefitExport[]> {
  const benefits = await benefitRepo.listBenefits({
    limit: 10000
  });

  return benefits.map((b) => ({
    name: toStringSafe(b.name),
    key: toStringSafe(b.key),
    description: b.description ? toStringSafe(b.description) : undefined,
    type: toStringSafe(b.type),
    value: b.value,
    icon: b.icon ? toStringSafe(b.icon) : undefined,
    color: b.color ? toStringSafe(b.color) : undefined,
    status: toStringSafe(b.status)
  }));
}

/**
 * 通用导出函数
 */
export async function exportEntity(
  entityType: string,
  format: 'json' | 'csv' = 'json',
  options?: ExportOptions
): Promise<
  | ContentTextExport[]
  | AnnouncementExport[]
  | BannerExport[]
  | PlanExport[]
  | BenefitExport[]
  | string
> {
  let data:
    | ContentTextExport[]
    | AnnouncementExport[]
    | BannerExport[]
    | PlanExport[]
    | BenefitExport[];

  switch (entityType) {
    case 'content_texts':
      data = await exportContentTextsJSON(options);
      break;
    case 'announcements':
      data = await exportAnnouncementsJSON();
      break;
    case 'banners':
      data = await exportBannersJSON();
      break;
    case 'plans':
      data = await exportPlansJSON();
      break;
    case 'benefits':
      data = await exportBenefitsJSON();
      break;
    default:
      throw new Error(`不支持的实体类型: ${entityType}`);
  }

  if (format === 'csv') {
    const csvData = data as CSVRow[];
    const fields = Object.keys(csvData[0] || {});
    return convertToCSV(csvData, fields);
  }

  return data;
}
