/**
 * 数据库优化服务 - TypeScript ESM版本
 * 艹！提供EXPLAIN分析、性能监控和优化建议
 */

import logger from '../utils/logger.js';
import dbMetrics from '../utils/db-metrics.js';
import type { MetricsReport, SlowQuery } from '../utils/db-metrics.js';
import { db } from '../config/database.js';

interface QueryAnalysis {
  sql: string;
  analysis: any;
  timestamp: Date;
  analysisTime: number;
}

interface IndexSuggestion {
  table: string;
  columns: string[];
  type: string;
  reason: string;
  priority: string;
}

/**
 * 数据库优化服务
 *
 * 提供EXPLAIN分析、性能监控和优化建议
 */
class DatabaseOptimizationService {
  private baselineQueries: Map<string, QueryAnalysis>;
  private analysisQueue: any[];
  private isAnalyzing: boolean;

  constructor() {
    this.baselineQueries = new Map();
    this.analysisQueue = [];
    this.isAnalyzing = false;
  }

  /**
   * 分析查询执行计划
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeQueryExecution(sql: string, params: any[] = []): Promise<any> {
    try {
      logger.info('[DB Optimization] 开始分析查询', {
        sql: this.sanitizeSQL(sql)
      });

      const startTime = Date.now();

      // 执行EXPLAIN
      const result = await dbMetrics.analyzeQuery(sql, params);

      const analysisTime = Date.now() - startTime;

      // 缓存分析结果
      const queryHash = this.hashQuery(sql);
      this.baselineQueries.set(queryHash, {
        sql: this.sanitizeSQL(sql),
        analysis: result,
        timestamp: new Date(),
        analysisTime
      });

      logger.info('[DB Optimization] 查询分析完成', {
        queryHash,
        analysisTime: `${analysisTime}ms`,
        performance: result.performance.level,
        recommendations: result.recommendations.length
      });

      return result;
    } catch (error) {
      logger.error('[DB Optimization] 查询分析失败', {
        sql: this.sanitizeSQL(sql),
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * 批量分析核心查询
   * @returns {Promise<Array>} 分析结果数组
   */
  async analyzeCoreQueries() {
    const coreQueries = [
      {
        name: '用户查询',
        sql: 'SELECT id, phone, isMember, quota_remaining FROM users WHERE id = ?',
        params: ['sample_user_id']
      },
      {
        name: '任务列表查询',
        sql: 'SELECT id, userId, status, type, created_at FROM tasks WHERE userId = ? ORDER BY created_at DESC LIMIT ?',
        params: ['sample_user_id', 10]
      },
      {
        name: '配额事务查询',
        sql: 'SELECT * FROM quota_transactions WHERE task_id = ? AND phase = ?',
        params: ['sample_task_id', 'reserved']
      },
      {
        name: '特征定义查询',
        sql: 'SELECT * FROM feature_definitions WHERE feature_id = ? AND is_enabled = ?',
        params: ['sample_feature', true]
      }
    ];

    const results = [];

    for (const query of coreQueries) {
      try {
        const analysis = await this.analyzeQueryExecution(query.sql, query.params);
        results.push({
          name: query.name,
          ...analysis,
          sql: query.sql
        });
      } catch (error) {
        logger.error(`[DB Optimization] ${query.name} 分析失败`, error);
        results.push({
          name: query.name,
          error: (error as Error).message,
          sql: this.sanitizeSQL(query.sql)
        });
      }
    }

    return results;
  }

  /**
   * 获取索引建议
   * @returns {Promise<Array>} 索引建议列表
   */
  async getIndexSuggestions(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];

    try {
      // 检查核心表的索引情况
      const tables = ['users', 'tasks', 'quota_transactions', 'feature_definitions'];

      for (const table of tables) {
        const indexes = await this.getTableIndexes(table);
        const tableSuggestions = this.generateIndexSuggestions(table, indexes);
        suggestions.push(...tableSuggestions);
      }
    } catch (error) {
      logger.error('[DB Optimization] 获取索引建议失败', error);
    }

    return suggestions;
  }

  /**
   * 获取表的索引信息
   * @param {string} tableName - 表名
   */
  async getTableIndexes(tableName: string): Promise<any[]> {
    try {
      const result = await db.raw(`
        SHOW INDEX FROM ${tableName}
      `);

      return result.map((row: any) => ({
        table: row.Table,
        nonUnique: row.Non_unique === 0,
        keyName: row.Key_name,
        seqInIndex: row.Seq_in_index,
        columnName: row.Column_name,
        collation: row.Collation,
        cardinality: row.Cardinality,
        subPart: row.Sub_part,
        packed: row.Packed,
        null: row.Null,
        indexType: row.Index_type,
        comment: row.Comment,
        indexComment: row.Index_comment,
        visible: row.Visible
      }));
    } catch (error) {
      logger.error(`[DB Optimization] 获取表 ${tableName} 索引失败`, error);
      return [];
    }
  }

  /**
   * 生成索引建议
   * @param {string} table - 表名
   * @param {Array} indexes - 现有索引
   */
  generateIndexSuggestions(table: string, indexes: any[]): IndexSuggestion[] {
    const suggestions: IndexSuggestion[] = [];
    const indexMap = new Map<string, string[]>();

    // 创建索引映射
    indexes.forEach((idx: any) => {
      if (!indexMap.has(idx.keyName)) {
        indexMap.set(idx.keyName, []);
      }
      const columns = indexMap.get(idx.keyName);
      if (columns) {
        columns.push(idx.columnName);
      }
    });

    // 建议的核心索引
    const recommendedIndexes = {
      users: [
        { columns: ['id'], type: 'PRIMARY', reason: '主键索引' },
        { columns: ['phone'], type: 'UNIQUE', reason: '登录查询' },
        { columns: ['isMember', 'quota_remaining'], type: 'INDEX', reason: '会员和配额查询' },
        { columns: ['created_at'], type: 'INDEX', reason: '时间排序' }
      ],
      tasks: [
        { columns: ['id'], type: 'PRIMARY', reason: '主键索引' },
        { columns: ['userId', 'created_at', 'id'], type: 'INDEX', reason: '用户任务列表' },
        { columns: ['userId', 'status'], type: 'INDEX', reason: '用户状态筛选' },
        { columns: ['status', 'created_at', 'id'], type: 'INDEX', reason: '状态时间排序' },
        { columns: ['feature_id'], type: 'INDEX', reason: '功能筛选' },
        { columns: ['vendorTaskId'], type: 'UNIQUE', reason: '外部任务ID唯一性' }
      ],
      quota_transactions: [
        { columns: ['id'], type: 'PRIMARY', reason: '主键索引' },
        { columns: ['task_id'], type: 'UNIQUE', reason: '任务唯一性' },
        { columns: ['user_id'], type: 'INDEX', reason: '用户配额查询' },
        { columns: ['phase'], type: 'INDEX', reason: '状态筛选' },
        { columns: ['user_id', 'phase'], type: 'INDEX', reason: '用户状态组合查询' },
        { columns: ['created_at'], type: 'INDEX', reason: '时间排序' }
      ],
      feature_definitions: [
        { columns: ['feature_id'], type: 'PRIMARY', reason: '主键索引' },
        { columns: ['is_enabled'], type: 'INDEX', reason: '启用状态筛选' },
        { columns: ['pipeline_schema_ref'], type: 'INDEX', reason: 'Schema引用' }
      ]
    };

    const recommended = (recommendedIndexes as any)[table] || [];

    recommended.forEach((rec: any) => {
      const exists = Array.from(indexMap.values()).some(
        (cols: string[]) =>
          cols.length === rec.columns.length && cols.every((col: string) => rec.columns.includes(col))
      );

      if (!exists) {
        suggestions.push({
          table,
          columns: rec.columns,
          type: rec.type,
          reason: rec.reason,
          priority: this.getIndexPriority(rec.type)
        });
      }
    });

    return suggestions;
  }

  /**
   * 获取索引优先级
   * @param {string} indexType - 索引类型
   */
  getIndexPriority(indexType: string): string {
    const priorities: Record<string, string> = {
      PRIMARY: 'high',
      UNIQUE: 'high',
      INDEX: 'medium'
    };
    return priorities[indexType] || 'low';
  }

  /**
   * 生成数据库性能报告
   * @returns {Promise<Object>} 性能报告
   */
  async generatePerformanceReport() {
    try {
      const startTime = Date.now();

      const [
        coreQueriesAnalysis,
        indexSuggestions,
        metricsReport,
        slowQueries
      ]: [any[], IndexSuggestion[], MetricsReport, SlowQuery[]] = await Promise.all([
        this.analyzeCoreQueries(),
        this.getIndexSuggestions(),
        Promise.resolve(dbMetrics.getMetricsReport()),
        Promise.resolve(this.getRecentSlowQueries())
      ]);

      const reportTime = Date.now() - startTime;

      const report = {
        timestamp: new Date(),
        generationTime: reportTime,
        summary: {
          coreQueriesCount: coreQueriesAnalysis.length,
          indexSuggestionsCount: indexSuggestions.length,
          slowQueriesCount: slowQueries.length,
          healthStatus: metricsReport.health.status
        },
        coreQueries: coreQueriesAnalysis,
        indexSuggestions,
        metrics: metricsReport,
        slowQueries,
        recommendations: this.generateOverallRecommendations(
          coreQueriesAnalysis,
          indexSuggestions,
          metricsReport
        )
      };

      logger.info('[DB Optimization] 性能报告生成完成', {
        reportTime: `${reportTime}ms`,
        coreQueries: report.summary.coreQueriesCount,
        indexSuggestions: report.summary.indexSuggestionsCount,
        slowQueries: report.summary.slowQueriesCount
      });

      return report;
    } catch (error) {
      logger.error('[DB Optimization] 生成性能报告失败', error);
      throw error;
    }
  }

  /**
   * 获取最近的慢查询
   */
  getRecentSlowQueries(): SlowQuery[] {
    return dbMetrics.getRecentSlowQueries(20);
  }

  /**
   * 生成整体优化建议
   */
  generateOverallRecommendations(queries: any[], indexes: any[], metrics: any): any[] {
    const recommendations = [];

    // 连接池建议
    if (Number(metrics.pool.utilization.replace('%', '')) > 80) {
      recommendations.push({
        category: 'connection-pool',
        priority: 'high',
        title: '连接池利用率过高',
        description: `当前连接池利用率为 ${metrics.pool.utilization}，建议增加连接池大小`,
        action: '增加 DATABASE_POOL_MAX 环境变量'
      });
    }

    // 慢查询建议
    if (metrics.performance.slowQueriesCount > 10) {
      recommendations.push({
        category: 'slow-queries',
        priority: 'high',
        title: '慢查询数量过多',
        description: `检测到 ${metrics.performance.slowQueriesCount} 个慢查询`,
        action: '检查并优化慢查询，添加适当索引'
      });
    }

    // 索引建议
    const highPriorityIndexes = indexes.filter((idx: any) => idx.priority === 'high');
    if (highPriorityIndexes.length > 0) {
      recommendations.push({
        category: 'indexes',
        priority: 'high',
        title: '缺少关键索引',
        description: `发现 ${highPriorityIndexes.length} 个高优先级索引建议`,
        action: '创建建议的索引以提升查询性能'
      });
    }

    return recommendations;
  }

  /**
   * 清理SQL语句中的敏感信息
   */
  sanitizeSQL(sql: string): string {
    return dbMetrics.publicSanitize(sql);
  }

  /**
   * 生成SQL哈希
   */
  hashQuery(sql: string): string {
    return String(dbMetrics.publicHash(sql));
  }

  /**
   * 执行定时分析任务
   */
  async scheduleAnalysis() {
    if (this.isAnalyzing) {
      return;
    }

    this.isAnalyzing = true;
    try {
      logger.info('[DB Optimization] 开始定时分析任务');

      const report = await this.generatePerformanceReport();

      // 这里可以将报告保存到文件或发送到监控系统
      logger.info('[DB Optimization] 定时分析完成', {
        healthStatus: report.summary.healthStatus,
        recommendationsCount: report.recommendations.length
      });
    } catch (error) {
      logger.error('[DB Optimization] 定时分析失败', error);
    } finally {
      this.isAnalyzing = false;
    }
  }
}

const dbOptimizationService = new DatabaseOptimizationService();

export default dbOptimizationService;
