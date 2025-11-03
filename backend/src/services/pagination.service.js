const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * 游标分页服务
 *
 * 提供高性能的数据库分页查询功能，支持：
 * - 游标分页（基于索引的高效分页）
 * - 传统LIMIT/OFFSET分页
 * - 智能排序和过滤
 * - 多种排序策略
 */
class PaginationService {
  constructor() {
    this.defaultLimit = 20;
    this.maxLimit = 100;
    this.defaultOrder = 'desc';
  }

  /**
   * 游标分页查询
   * @param {Object} options - 分页选项
   * @param {string} options.table - 表名
   * @param {Array} options.columns - 查询列
   * @param {Object} options.where - WHERE条件
   * @param {Array} options.orderBy - 排序字段 [{column, direction}]
   * @param {string} options.cursor - 游标（上次的最后一个值）
   * @param {number} options.limit - 每页数量
   * @param {Array} options.joins - JOIN条件
   * @returns {Promise<Object>} 分页结果
   */
  async cursorPaginate(options) {
    const {
      table,
      columns = ['*'],
      where = {},
      orderBy = [{ column: 'created_at', direction: 'desc' }, { column: 'id', direction: 'desc' }],
      cursor,
      limit = this.defaultLimit,
      joins = []
    } = options;

    try {
      // 参数验证
      const validatedLimit = Math.min(Math.max(limit, 1), this.maxLimit);

      // 构建基础查询
      let query = db(table).select(columns);

      // 添加JOIN
      joins.forEach(join => {
        if (join.type === 'inner') {
          query = query.innerJoin(join.table, join.first, join.operator, join.second);
        } else if (join.type === 'left') {
          query = query.leftJoin(join.table, join.first, join.operator, join.second);
        }
      });

      // 添加WHERE条件
      Object.keys(where).forEach(key => {
        if (where[key] !== null && where[key] !== undefined) {
          if (Array.isArray(where[key])) {
            query = query.whereIn(key, where[key]);
          } else {
            query = query.where(key, where[key]);
          }
        }
      });

      // 添加游标条件
      if (cursor) {
        query = this.buildCursorCondition(query, orderBy, cursor);
      }

      // 添加排序
      orderBy.forEach(order => {
        query = query.orderBy(order.column, order.direction || this.defaultOrder);
      });

      // 限制数量
      query = query.limit(validatedLimit + 1); // +1 用于判断是否有下一页

      // 执行查询
      const startTime = Date.now();
      const results = await query;
      const queryTime = Date.now() - startTime;

      // 判断是否有下一页
      const hasNextPage = results.length > validatedLimit;
      if (hasNextPage) {
        results.pop(); // 移除多查询的一条记录
      }

      // 生成下一页游标
      let nextCursor = null;
      if (hasNextPage && results.length > 0) {
        nextCursor = this.buildCursor(results[results.length - 1], orderBy);
      }

      // 构建分页信息
      const pageInfo = {
        hasNextPage,
        hasPreviousPage: !!cursor,
        startCursor: results.length > 0 ? this.buildCursor(results[0], orderBy) : null,
        endCursor: results.length > 0 ? this.buildCursor(results[results.length - 1], orderBy) : null,
        nextCursor,
        limit: validatedLimit,
        totalCount: results.length
      };

      logger.debug(`[PaginationService] 游标分页查询完成`, {
        table,
        limit: validatedLimit,
        resultCount: results.length,
        hasNextPage,
        queryTime: `${queryTime}ms`,
        hasCursor: !!cursor
      });

      return {
        data: results,
        pageInfo,
        paginationType: 'cursor'
      };

    } catch (error) {
      logger.error(`[PaginationService] 游标分页查询失败`, {
        table,
        error: error.message,
        options
      });
      throw error;
    }
  }

  /**
   * 传统LIMIT/OFFSET分页查询
   * @param {Object} options - 分页选项
   * @param {string} options.table - 表名
   * @param {Array} options.columns - 查询列
   * @param {Object} options.where - WHERE条件
   * @param {Array} options.orderBy - 排序字段
   * @param {number} options.page - 页码（从1开始）
   * @param {number} options.limit - 每页数量
   * @param {Array} options.joins - JOIN条件
   * @returns {Promise<Object>} 分页结果
   */
  async offsetPaginate(options) {
    const {
      table,
      columns = ['*'],
      where = {},
      orderBy = [{ column: 'created_at', direction: 'desc' }],
      page = 1,
      limit = this.defaultLimit,
      joins = []
    } = options;

    try {
      // 参数验证
      const validatedPage = Math.max(page, 1);
      const validatedLimit = Math.min(Math.max(limit, 1), this.maxLimit);
      const offset = (validatedPage - 1) * validatedLimit;

      // 构建计数查询
      let countQuery = db(table);
      joins.forEach(join => {
        if (join.type === 'inner') {
          countQuery = countQuery.innerJoin(join.table, join.first, join.operator, join.second);
        } else if (join.type === 'left') {
          countQuery = countQuery.leftJoin(join.table, join.first, join.operator, join.second);
        }
      });

      Object.keys(where).forEach(key => {
        if (where[key] !== null && where[key] !== undefined) {
          if (Array.isArray(where[key])) {
            countQuery = countQuery.whereIn(key, where[key]);
          } else {
            countQuery = countQuery.where(key, where[key]);
          }
        }
      });

      const totalCount = await countQuery.count('* as total').first();

      // 构建数据查询
      let dataQuery = db(table).select(columns);

      joins.forEach(join => {
        if (join.type === 'inner') {
          dataQuery = dataQuery.innerJoin(join.table, join.first, join.operator, join.second);
        } else if (join.type === 'left') {
          dataQuery = dataQuery.leftJoin(join.table, join.first, join.operator, join.second);
        }
      });

      Object.keys(where).forEach(key => {
        if (where[key] !== null && where[key] !== undefined) {
          if (Array.isArray(where[key])) {
            dataQuery = dataQuery.whereIn(key, where[key]);
          } else {
            dataQuery = dataQuery.where(key, where[key]);
          }
        }
      });

      orderBy.forEach(order => {
        dataQuery = dataQuery.orderBy(order.column, order.direction || this.defaultOrder);
      });

      dataQuery = dataQuery.limit(validatedLimit).offset(offset);

      // 执行查询
      const startTime = Date.now();
      const [results] = await Promise.all([dataQuery]);
      const queryTime = Date.now() - startTime;

      // 计算分页信息
      const totalItems = parseInt(totalCount.total) || 0;
      const totalPages = Math.ceil(totalItems / validatedLimit);
      const hasNextPage = validatedPage < totalPages;
      const hasPreviousPage = validatedPage > 1;

      const pageInfo = {
        currentPage: validatedPage,
        totalPages,
        totalItems,
        hasNextPage,
        hasPreviousPage,
        limit: validatedLimit,
        offset,
        itemCount: results.length
      };

      logger.debug(`[PaginationService] OFFSET分页查询完成`, {
        table,
        page: validatedPage,
        limit: validatedLimit,
        totalItems,
        totalPages,
        queryTime: `${queryTime}ms`
      });

      return {
        data: results,
        pageInfo,
        paginationType: 'offset'
      };

    } catch (error) {
      logger.error(`[PaginationService] OFFSET分页查询失败`, {
        table,
        error: error.message,
        options
      });
      throw error;
    }
  }

  /**
   * 构建游标条件
   * @param {Object} query - Knex查询对象
   * @param {Array} orderBy - 排序字段
   * @param {string} cursor - 游标值
   * @returns {Object} 查询对象
   */
  buildCursorCondition(query, orderBy, cursor) {
    const cursorData = this.parseCursor(cursor);

    if (!cursorData || orderBy.length === 0) {
      return query;
    }

    // 构建游标条件：WHERE (col1, col2, ...) > (val1, val2, ...)
    const conditions = [];
    const bindings = [];

    for (let i = 0; i < orderBy.length; i++) {
      const order = orderBy[i];
      const column = order.column;
      const direction = order.direction || this.defaultOrder;
      const value = cursorData[column];

      if (value === undefined) {
        continue;
      }

      const operator = direction === 'desc' ? '<' : '>';

      if (i === 0) {
        // 第一个排序字段
        conditions.push(`${column} ${operator} ?`);
        bindings.push(value);
      } else {
        // 后续排序字段需要复合条件
        let prevConditions = '';
        let prevBindings = [];

        for (let j = 0; j < i; j++) {
          const prevOrder = orderBy[j];
          const prevColumn = prevOrder.column;
          const prevValue = cursorData[prevColumn];

          if (prevValue !== undefined) {
            if (prevConditions) {
              prevConditions += ' AND ';
            }
            prevConditions += `${prevColumn} = ?`;
            prevBindings.push(prevValue);
          }
        }

        if (prevConditions) {
          conditions.push(`(${prevConditions} AND ${column} ${operator} ?)`);
          bindings.push(...prevBindings, value);
        } else {
          conditions.push(`${column} ${operator} ?`);
          bindings.push(value);
        }
      }
    }

    if (conditions.length > 0) {
      query = query.whereRaw(`(${conditions.join(' OR ')})`, bindings);
    }

    return query;
  }

  /**
   * 构建游标
   * @param {Object} row - 数据行
   * @param {Array} orderBy - 排序字段
   * @returns {string} Base64编码的游标
   */
  buildCursor(row, orderBy) {
    const cursorData = {};

    orderBy.forEach(order => {
      const column = order.column;
      if (row[column] !== undefined && row[column] !== null) {
        cursorData[column] = row[column];
      }
    });

    const cursorJson = JSON.stringify(cursorData);
    return Buffer.from(cursorJson).toString('base64');
  }

  /**
   * 解析游标
   * @param {string} cursor - Base64编码的游标
   * @returns {Object} 游标数据
   */
  parseCursor(cursor) {
    try {
      const cursorJson = Buffer.from(cursor, 'base64').toString('utf8');
      return JSON.parse(cursorJson);
    } catch (error) {
      logger.warn(`[PaginationService] 游标解析失败: ${cursor}`, error);
      return null;
    }
  }

  /**
   * 用户任务列表分页（游标分页）
   * @param {string} userId - 用户ID
   * @param {Object} options - 分页选项
   * @returns {Promise<Object>} 分页结果
   */
  async getUserTasks(userId, options = {}) {
    return this.cursorPaginate({
      table: 'tasks',
      columns: ['id', 'userId', 'type', 'status', 'created_at', 'completed_at', 'resultUrls'],
      where: { userId },
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  /**
   * 任务列表分页（后台管理）
   * @param {Object} filters - 过滤条件
   * @param {Object} options - 分页选项
   * @returns {Promise<Object>} 分页结果
   */
  async getTaskList(filters = {}, options = {}) {
    const where = {};

    // 构建过滤条件
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }

    return this.offsetPaginate({
      table: 'tasks',
      columns: ['id', 'userId', 'type', 'status', 'created_at', 'completed_at'],
      where,
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  /**
   * 配额事务分页查询
   * @param {string} userId - 用户ID（可选）
   * @param {Object} filters - 过滤条件
   * @param {Object} options - 分页选项
   * @returns {Promise<Object>} 分页结果
   */
  async getQuotaTransactions(userId = null, filters = {}, options = {}) {
    const where = {};

    if (userId) {
      where.user_id = userId;
    }
    if (filters.phase) {
      where.phase = filters.phase;
    }

    return this.offsetPaginate({
      table: 'quota_transactions',
      columns: ['id', 'task_id', 'user_id', 'amount', 'phase', 'created_at'],
      where,
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  /**
   * 搜索功能（全文搜索分页）
   * @param {string} searchTerm - 搜索词
   * @param {Object} options - 分页选项
   * @returns {Promise<Object>} 分页结果
   */
  async searchTasks(searchTerm, options = {}) {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.getTaskList({}, options);
    }

    const where = function() {
      this.where('tasks.type', 'like', `%${searchTerm}%`)
          .orWhere('tasks.status', 'like', `%${searchTerm}%`)
          .orWhere('tasks.errorReason', 'like', `%${searchTerm}%`);
    };

    return this.offsetPaginate({
      table: 'tasks',
      columns: ['id', 'userId', 'type', 'status', 'created_at', 'errorReason'],
      where,
      orderBy: [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ],
      ...options
    });
  }

  /**
   * 获取索引使用统计
   * @returns {Promise<Array>} 索引使用情况
   */
  async getIndexUsageStats() {
    try {
      const stats = await db.raw('SELECT * FROM v_index_usage');
      return stats[0] || [];
    } catch (error) {
      logger.error('[PaginationService] 获取索引统计失败', error);
      return [];
    }
  }

  /**
   * 分析查询性能
   * @param {string} table - 表名
   * @param {Object} where - WHERE条件
   * @param {Array} orderBy - 排序字段
   * @returns {Promise<Object>} EXPLAIN分析结果
   */
  async analyzeQuery(table, where = {}, orderBy = []) {
    try {
      let query = db(table).select('*');

      // 添加WHERE条件
      Object.keys(where).forEach(key => {
        if (where[key] !== null && where[key] !== undefined) {
          query = query.where(key, where[key]);
        }
      });

      // 添加排序
      orderBy.forEach(order => {
        query = query.orderBy(order.column, order.direction || 'desc');
      });

      // 获取查询SQL
      const sql = query.toSQL();
      const explainSql = `EXPLAIN ${sql.sql}`;

      // 执行EXPLAIN
      const explainResult = await db.raw(explainSql, sql.bindings);

      logger.debug('[PaginationService] 查询分析完成', {
        table,
        where,
        orderBy,
        explainPlan: explainResult[0]
      });

      return {
        sql: sql.sql,
        bindings: sql.bindings,
        explain: explainResult[0]
      };

    } catch (error) {
      logger.error('[PaginationService] 查询分析失败', {
        table,
        where,
        orderBy,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new PaginationService();