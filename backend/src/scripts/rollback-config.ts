#!/usr/bin/env node
/**
 * 配置回滚CLI脚本
 * 艹，这个tm用于命令行快速回滚配置！
 *
 * 用法：
 * npm run rollback -- --snapshot-id=123
 * npm run rollback -- --list --type=provider
 * npm run rollback -- --create --type=provider --ref=test-001
 */

import {
  listSnapshots,
  rollbackToSnapshot,
  createSnapshot,
  getSnapshotById,
} from '../services/configSnapshot.service';
import db from '../db';

/**
 * 解析命令行参数
 */
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || 'true';
    }
  });

  return args;
}

/**
 * 列出快照
 */
async function listSnapshotsCommand(args: Record<string, string>): Promise<void> {
  const type = args.type;
  const ref = args.ref;
  const limit = parseInt(args.limit || '20');

  console.log('\n艹，正在查询快照...\n');

  const snapshots = await listSnapshots({
    config_type: type,
    config_ref: ref,
    limit,
  });

  if (snapshots.length === 0) {
    console.log('没有找到快照！');
    return;
  }

  console.log(`找到 ${snapshots.length} 个快照:\n`);

  snapshots.forEach((snapshot) => {
    console.log(`ID: ${snapshot.id}`);
    console.log(`名称: ${snapshot.snapshot_name}`);
    console.log(`类型: ${snapshot.config_type}`);
    if (snapshot.config_ref) {
      console.log(`引用: ${snapshot.config_ref}`);
    }
    if (snapshot.description) {
      console.log(`描述: ${snapshot.description}`);
    }
    console.log(`创建时间: ${snapshot.created_at}`);
    console.log(`是否已回滚: ${snapshot.is_rollback ? '是' : '否'}`);
    console.log('---');
  });
}

/**
 * 回滚到快照
 */
async function rollbackCommand(args: Record<string, string>): Promise<void> {
  const snapshotId = parseInt(args['snapshot-id']);

  if (!snapshotId) {
    console.error('艹，必须指定快照ID：--snapshot-id=123');
    process.exit(1);
  }

  console.log(`\n艹，正在回滚到快照 ${snapshotId}...\n`);

  // 1. 获取快照信息
  const snapshot = await getSnapshotById(snapshotId);
  if (!snapshot) {
    console.error(`快照不存在: ${snapshotId}`);
    process.exit(1);
  }

  console.log(`快照名称: ${snapshot.snapshot_name}`);
  console.log(`配置类型: ${snapshot.config_type}`);
  console.log(`配置引用: ${snapshot.config_ref || 'N/A'}`);
  console.log(`创建时间: ${snapshot.created_at}\n`);

  // 2. 确认回滚
  if (!args.yes) {
    console.log(
      '艹，这是个危险操作！请再次确认：添加 --yes 参数确认回滚\n'
    );
    console.log('命令示例：');
    console.log(`npm run rollback -- --snapshot-id=${snapshotId} --yes\n`);
    process.exit(0);
  }

  // 3. 执行回滚
  try {
    const result = await rollbackToSnapshot(snapshotId, 1); // 用户ID=1（管理员）

    console.log('\n艹，回滚成功！\n');
    console.log('回滚后的配置:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('\n艹，回滚失败:', error.message);
    process.exit(1);
  }
}

/**
 * 创建快照
 */
async function createSnapshotCommand(args: Record<string, string>): Promise<void> {
  const type = args.type;
  const ref = args.ref;
  const name = args.name;

  if (!type) {
    console.error('艹，必须指定配置类型：--type=provider');
    process.exit(1);
  }

  console.log('\n艹，正在创建快照...\n');

  // 根据类型读取当前配置
  let config_data: any;

  switch (type) {
    case 'provider':
      if (!ref) {
        console.error('艹，Provider类型必须指定引用：--ref=test-001');
        process.exit(1);
      }

      config_data = await db('provider_endpoints')
        .where({ provider_ref: ref })
        .first();

      if (!config_data) {
        console.error(`Provider不存在: ${ref}`);
        process.exit(1);
      }
      break;

    default:
      console.error(`不支持的配置类型: ${type}`);
      process.exit(1);
  }

  // 创建快照
  const snapshot = await createSnapshot({
    snapshot_name: name || `Manual: ${type}/${ref}`,
    description: '手动创建的快照',
    config_type: type,
    config_ref: ref,
    config_data,
    created_by: 1, // 管理员
  });

  console.log('\n艹，快照创建成功！\n');
  console.log(`快照ID: ${snapshot.id}`);
  console.log(`快照名称: ${snapshot.snapshot_name}`);
  console.log(`创建时间: ${snapshot.created_at}\n`);
}

/**
 * 显示帮助
 */
function showHelp(): void {
  console.log(`
艹，配置回滚CLI工具！

用法:
  npm run rollback -- [命令] [选项]

命令:
  --list              列出快照
  --create            创建快照
  --snapshot-id=<id>  回滚到指定快照

选项:
  --type=<type>       配置类型（provider/announcement/banner）
  --ref=<ref>         配置引用ID
  --name=<name>       快照名称
  --limit=<n>         列出快照的数量限制（默认20）
  --yes               确认执行回滚（危险操作）

示例:
  # 列出所有Provider快照
  npm run rollback -- --list --type=provider

  # 列出指定Provider的快照
  npm run rollback -- --list --type=provider --ref=test-001

  # 创建Provider快照
  npm run rollback -- --create --type=provider --ref=test-001 --name="生产环境备份"

  # 回滚到快照（需要确认）
  npm run rollback -- --snapshot-id=123
  npm run rollback -- --snapshot-id=123 --yes

  `);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = parseArgs();

  try {
    if (args.help || Object.keys(args).length === 0) {
      showHelp();
    } else if (args.list) {
      await listSnapshotsCommand(args);
    } else if (args.create) {
      await createSnapshotCommand(args);
    } else if (args['snapshot-id']) {
      await rollbackCommand(args);
    } else {
      showHelp();
    }
  } catch (error: any) {
    console.error('\n艹，执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await db.destroy();
  }
}

// 执行主函数
main();
