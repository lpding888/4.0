/**
 * Knex数据库连接实例
 * 艹，这个tm是全局单例，所有地方都用这个！
 */

import knex, { Knex } from 'knex';
import * as knexConfig from '../knexfile';

// 根据环境选择配置
const environment = process.env.NODE_ENV || 'development';

// 获取对应环境的配置
const config: Knex.Config = (knexConfig as any)[environment];

if (!config) {
  throw new Error(
    `艹！没有找到环境"${environment}"的数据库配置！检查knexfile.js`
  );
}

// 创建Knex实例
const db = knex(config);

// 导出默认实例
export default db;
