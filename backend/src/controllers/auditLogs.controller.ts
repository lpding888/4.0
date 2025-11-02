/**
 * Audit Logs Controller
 * 艹，审计日志查询控制器！
 */

import { Request, Response, NextFunction } from 'express';
import * as auditRepo from '../repositories/auditLogs.repo';

export class AuditLogsController {
  /**
   * 列出审计日志（管理端）
   */
  async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        entity_type,
        entity_id,
        user_id,
        action,
        start_date,
        end_date,
        limit = 50,
        offset = 0,
      } = req.query;

      const logs = await auditRepo.listAuditLogs({
        entity_type: entity_type as string,
        entity_id: entity_id ? parseInt(entity_id as string) : undefined,
        user_id: user_id ? parseInt(user_id as string) : undefined,
        action: action as string,
        start_date: start_date ? new Date(start_date as string) : undefined,
        end_date: end_date ? new Date(end_date as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      // 获取总数
      const total = await auditRepo.countAuditLogs({
        entity_type: entity_type as string,
        user_id: user_id ? parseInt(user_id as string) : undefined,
        action: action as string,
        start_date: start_date ? new Date(start_date as string) : undefined,
        end_date: end_date ? new Date(end_date as string) : undefined,
      });

      res.json({
        success: true,
        data: {
          items: logs,
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error: any) {
      console.error('[AuditLogsController] 列出审计日志失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取实体操作历史
   */
  async getEntityHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entity_type, entity_id } = req.params;

      const history = await auditRepo.getEntityHistory(entity_type, parseInt(entity_id));

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      console.error('[AuditLogsController] 获取实体历史失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取用户操作历史
   */
  async getUserHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id } = req.params;
      const { limit } = req.query;

      const history = await auditRepo.getUserHistory(
        parseInt(user_id),
        limit ? parseInt(limit as string) : 100
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error: any) {
      console.error('[AuditLogsController] 获取用户历史失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取单条审计日志
   */
  async getAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const log = await auditRepo.getAuditLogById(id);

      if (!log) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '审计日志不存在' },
        });
        return;
      }

      res.json({ success: true, data: log });
    } catch (error: any) {
      console.error('[AuditLogsController] 获取审计日志失败:', error.message);
      next(error);
    }
  }
}

export default new AuditLogsController();
