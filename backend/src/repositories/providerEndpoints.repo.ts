/**
 * Provider Endpoints Repository
 * 艹，这个仓储层负责Provider端点的CRUD，并自动加解密敏感字段！
 *
 * 敏感字段加密策略：
 * - credentials_encrypted: 始终加密存储
 * - 读取时自动解密（可选缓存到内存）
 */

import db from '../db';
import { encryptFields, decryptFields } from '../utils/crypto';

/**
 * Provider端点接口
 */
export interface ProviderEndpoint {
  provider_ref: string;
  provider_name: string;
  endpoint_url: string;
  credentials_encrypted: any; // 加密后的凭证（存储时是字符串，读取后是对象）
  auth_type: string;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Provider端点输入（创建/更新时使用）
 */
export interface ProviderEndpointInput {
  provider_ref: string;
  provider_name: string;
  endpoint_url: string;
  credentials: any; // 明文凭证（会被自动加密）
  auth_type: string;
}

/**
 * 敏感字段列表（白名单）
 * 艹，只有这些字段会被加密！
 */
const SENSITIVE_FIELDS = ['credentials_encrypted'];

/**
 * 内存缓存（短时缓存解密后的凭证，减少解密开销）
 * TTL: 5分钟
 */
interface CacheEntry {
  data: ProviderEndpoint;
  expireAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 从缓存中获取Provider端点
 * @param providerRef - Provider引用ID
 * @returns Provider端点或null
 */
function getFromCache(providerRef: string): ProviderEndpoint | null {
  const entry = cache.get(providerRef);

  if (!entry) {
    return null;
  }

  // 检查是否过期
  if (Date.now() > entry.expireAt) {
    cache.delete(providerRef);
    return null;
  }

  return entry.data;
}

/**
 * 将Provider端点存入缓存
 * @param providerRef - Provider引用ID
 * @param data - Provider端点数据
 */
function setCache(providerRef: string, data: ProviderEndpoint): void {
  cache.set(providerRef, {
    data,
    expireAt: Date.now() + CACHE_TTL,
  });
}

/**
 * 清除缓存
 * @param providerRef - Provider引用ID（可选，不传则清除所有）
 */
function clearCache(providerRef?: string): void {
  if (providerRef) {
    cache.delete(providerRef);
  } else {
    cache.clear();
  }
}

/**
 * 创建Provider端点
 * @param input - Provider端点输入
 * @returns 创建的Provider端点
 */
export async function createProviderEndpoint(
  input: ProviderEndpointInput
): Promise<ProviderEndpoint> {
  const { provider_ref, provider_name, endpoint_url, credentials, auth_type } =
    input;

  // 艹，加密凭证字段
  const encrypted = encryptFields(
    { credentials_encrypted: credentials },
    SENSITIVE_FIELDS
  );

  // 插入数据库
  await db('provider_endpoints').insert({
    provider_ref,
    provider_name,
    endpoint_url,
    credentials_encrypted: encrypted.credentials_encrypted,
    auth_type,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  console.log(`[REPO] Provider端点创建成功: ${provider_ref}`);

  // 读取并返回（会自动解密）
  const created = await getProviderEndpoint(provider_ref);
  if (!created) {
    throw new Error('创建Provider端点后读取失败');
  }

  return created;
}

/**
 * 根据provider_ref获取Provider端点
 * @param providerRef - Provider引用ID
 * @param useCache - 是否使用缓存（默认true）
 * @returns Provider端点或null
 */
export async function getProviderEndpoint(
  providerRef: string,
  useCache: boolean = true
): Promise<ProviderEndpoint | null> {
  // 尝试从缓存读取
  if (useCache) {
    const cached = getFromCache(providerRef);
    if (cached) {
      console.log(`[REPO] Provider端点缓存命中: ${providerRef}`);
      return cached;
    }
  }

  // 从数据库读取
  const row = await db('provider_endpoints')
    .where({ provider_ref: providerRef })
    .first();

  if (!row) {
    return null;
  }

  // 解密敏感字段
  const decrypted = decryptFields(row, SENSITIVE_FIELDS) as ProviderEndpoint;

  // 存入缓存
  setCache(providerRef, decrypted);

  return decrypted;
}

/**
 * 列出所有Provider端点
 * @param options - 查询选项
 * @returns Provider端点列表
 */
export async function listProviderEndpoints(options: {
  limit?: number;
  offset?: number;
  authType?: string;
}): Promise<ProviderEndpoint[]> {
  const { limit = 100, offset = 0, authType } = options;

  let query = db('provider_endpoints').select('*').limit(limit).offset(offset);

  // 可选过滤：按auth_type
  if (authType) {
    query = query.where({ auth_type: authType });
  }

  const rows = await query;

  // 艹，批量解密（性能考虑，不使用缓存）
  return rows.map((row) => decryptFields(row, SENSITIVE_FIELDS)) as ProviderEndpoint[];
}

/**
 * 更新Provider端点
 * @param providerRef - Provider引用ID
 * @param updates - 要更新的字段
 * @returns 更新后的Provider端点
 */
export async function updateProviderEndpoint(
  providerRef: string,
  updates: Partial<ProviderEndpointInput>
): Promise<ProviderEndpoint> {
  const updateData: any = {
    updated_at: db.fn.now(),
  };

  // 处理普通字段
  if (updates.provider_name !== undefined) {
    updateData.provider_name = updates.provider_name;
  }
  if (updates.endpoint_url !== undefined) {
    updateData.endpoint_url = updates.endpoint_url;
  }
  if (updates.auth_type !== undefined) {
    updateData.auth_type = updates.auth_type;
  }

  // 处理敏感字段（加密）
  if (updates.credentials !== undefined) {
    const encrypted = encryptFields(
      { credentials_encrypted: updates.credentials },
      SENSITIVE_FIELDS
    );
    updateData.credentials_encrypted = encrypted.credentials_encrypted;
  }

  // 更新数据库
  const affected = await db('provider_endpoints')
    .where({ provider_ref: providerRef })
    .update(updateData);

  if (affected === 0) {
    throw new Error(`Provider端点不存在: ${providerRef}`);
  }

  console.log(`[REPO] Provider端点更新成功: ${providerRef}`);

  // 清除缓存
  clearCache(providerRef);

  // 读取并返回
  const updated = await getProviderEndpoint(providerRef, false);
  if (!updated) {
    throw new Error('更新Provider端点后读取失败');
  }

  return updated;
}

/**
 * 删除Provider端点
 * @param providerRef - Provider引用ID
 * @returns 是否成功删除
 */
export async function deleteProviderEndpoint(
  providerRef: string
): Promise<boolean> {
  const affected = await db('provider_endpoints')
    .where({ provider_ref: providerRef })
    .delete();

  if (affected > 0) {
    console.log(`[REPO] Provider端点删除成功: ${providerRef}`);
    clearCache(providerRef);
    return true;
  }

  return false;
}

/**
 * 检查Provider端点是否存在
 * @param providerRef - Provider引用ID
 * @returns 是否存在
 */
export async function providerEndpointExists(
  providerRef: string
): Promise<boolean> {
  const count = await db('provider_endpoints')
    .where({ provider_ref: providerRef })
    .count('* as count')
    .first();

  return count && (count as any).count > 0;
}

/**
 * 清空所有Provider端点缓存
 * 艹，密钥轮换后需要调用这个！
 */
export function clearAllCache(): void {
  console.log('[REPO] 清空所有Provider端点缓存');
  clearCache();
}
