/**
 * 配置快照服务
 * 艹，这个tm负责配置的快照创建和回滚！
 */

import db from '../db';

/**
 * 配置快照接口
 */
export interface ConfigSnapshot {
  id: number;
  snapshot_name: string;
  description?: string;
  config_type: string;
  config_ref?: string;
  config_data: any;
  created_by?: number;
  created_at: Date;
  is_rollback: boolean;
  rollback_from_id?: number;
}

/**
 * 创建快照输入
 */
export interface CreateSnapshotInput {
  snapshot_name: string;
  description?: string;
  config_type: string;
  config_ref?: string;
  config_data: any;
  created_by?: number;
}

/**
 * 创建配置快照
 * @param input - 快照输入
 * @returns 创建的快照
 */
export async function createSnapshot(
  input: CreateSnapshotInput
): Promise<ConfigSnapshot> {
  const {
    snapshot_name,
    description,
    config_type,
    config_ref,
    config_data,
    created_by,
  } = input;

  const [id] = await db('config_snapshots').insert({
    snapshot_name,
    description,
    config_type,
    config_ref,
    config_data: JSON.stringify(config_data),
    created_by,
    created_at: db.fn.now(),
    is_rollback: false,
  });

  console.log(`[SNAPSHOT] 快照创建成功: ${snapshot_name} (ID: ${id})`);

  const snapshot = await getSnapshotById(id);
  if (!snapshot) {
    throw new Error('创建快照后读取失败');
  }

  return snapshot;
}

/**
 * 根据ID获取快照
 * @param id - 快照ID
 * @returns 快照或null
 */
export async function getSnapshotById(id: number): Promise<ConfigSnapshot | null> {
  const row = await db('config_snapshots').where({ id }).first();

  if (!row) {
    return null;
  }

  return {
    ...row,
    config_data: JSON.parse(row.config_data),
  };
}

/**
 * 列出快照
 * @param options - 查询选项
 * @returns 快照列表
 */
export async function listSnapshots(options: {
  config_type?: string;
  config_ref?: string;
  limit?: number;
  offset?: number;
}): Promise<ConfigSnapshot[]> {
  const { config_type, config_ref, limit = 50, offset = 0 } = options;

  let query = db('config_snapshots')
    .select('*')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (config_type) {
    query = query.where({ config_type });
  }

  if (config_ref) {
    query = query.where({ config_ref });
  }

  const rows = await query;

  return rows.map((row) => ({
    ...row,
    config_data: JSON.parse(row.config_data),
  }));
}

/**
 * 回滚到指定快照
 * @param snapshotId - 快照ID
 * @param userId - 操作用户ID
 * @returns 回滚后的配置数据
 */
export async function rollbackToSnapshot(
  snapshotId: number,
  userId?: number
): Promise<any> {
  // 1. 获取快照
  const snapshot = await getSnapshotById(snapshotId);
  if (!snapshot) {
    throw new Error(`快照不存在: ${snapshotId}`);
  }

  console.log(`[SNAPSHOT] 开始回滚到快照: ${snapshot.snapshot_name}`);

  // 2. 根据配置类型执行回滚
  let result: any;

  switch (snapshot.config_type) {
    case 'provider':
      // 艹，回滚Provider配置
      result = await rollbackProviderConfig(snapshot);
      break;

    case 'announcement':
      // 回滚公告配置
      result = await rollbackAnnouncementConfig(snapshot);
      break;

    case 'banner':
      // 回滚轮播图配置
      result = await rollbackBannerConfig(snapshot);
      break;

    default:
      throw new Error(`不支持的配置类型: ${snapshot.config_type}`);
  }

  // 3. 创建回滚记录快照
  await createSnapshot({
    snapshot_name: `[回滚] ${snapshot.snapshot_name}`,
    description: `从快照ID ${snapshotId} 回滚`,
    config_type: snapshot.config_type,
    config_ref: snapshot.config_ref,
    config_data: result,
    created_by: userId,
  });

  // 4. 标记原快照为已回滚
  await db('config_snapshots').where({ id: snapshotId }).update({
    is_rollback: true,
  });

  console.log(`[SNAPSHOT] 回滚成功: ${snapshot.snapshot_name}`);

  return result;
}

/**
 * 回滚Provider配置
 */
async function rollbackProviderConfig(snapshot: ConfigSnapshot): Promise<any> {
  const { config_ref, config_data } = snapshot;

  if (!config_ref) {
    throw new Error('Provider配置缺少config_ref');
  }

  // 艹，这里应该调用providerEndpoints.repo的更新方法
  // 但为了避免循环依赖，暂时直接操作数据库
  const affected = await db('provider_endpoints')
    .where({ provider_ref: config_ref })
    .update({
      provider_name: config_data.provider_name,
      endpoint_url: config_data.endpoint_url,
      credentials_encrypted: config_data.credentials_encrypted,
      auth_type: config_data.auth_type,
      updated_at: db.fn.now(),
    });

  if (affected === 0) {
    throw new Error(`Provider不存在: ${config_ref}`);
  }

  return config_data;
}

/**
 * 回滚公告配置
 */
async function rollbackAnnouncementConfig(
  snapshot: ConfigSnapshot
): Promise<any> {
  // TODO: 实现公告回滚（CMS-401实现后集成）
  console.log('[SNAPSHOT] 公告回滚功能待实现');
  return snapshot.config_data;
}

/**
 * 回滚轮播图配置
 */
async function rollbackBannerConfig(snapshot: ConfigSnapshot): Promise<any> {
  // TODO: 实现轮播图回滚（CMS-402实现后集成）
  console.log('[SNAPSHOT] 轮播图回滚功能待实现');
  return snapshot.config_data;
}

/**
 * 删除快照
 * @param id - 快照ID
 * @returns 是否成功删除
 */
export async function deleteSnapshot(id: number): Promise<boolean> {
  const affected = await db('config_snapshots').where({ id }).delete();

  if (affected > 0) {
    console.log(`[SNAPSHOT] 快照删除成功: ${id}`);
    return true;
  }

  return false;
}

/**
 * 自动创建Provider配置快照（在更新前调用）
 * @param providerRef - Provider引用ID
 * @param userId - 操作用户ID
 */
export async function autoSnapshotProvider(
  providerRef: string,
  userId?: number
): Promise<void> {
  // 读取当前配置
  const currentConfig = await db('provider_endpoints')
    .where({ provider_ref: providerRef })
    .first();

  if (!currentConfig) {
    return;
  }

  // 创建快照
  await createSnapshot({
    snapshot_name: `Auto: ${currentConfig.provider_name}`,
    description: '自动快照（更新前）',
    config_type: 'provider',
    config_ref: providerRef,
    config_data: currentConfig,
    created_by: userId,
  });

  console.log(`[SNAPSHOT] 已自动创建Provider快照: ${providerRef}`);
}
