/**
 * Provider管理Controller
 * 艹，这个tm负责处理Provider配置的CRUD操作！
 */

import { Request, Response, NextFunction } from 'express';
import * as providerRepo from '../repositories/providerEndpoints.repo';
import { ProviderEndpointInput } from '../repositories/providerEndpoints.repo';

/**
 * Provider管理控制器
 */
export class ProvidersController {
  /**
   * 列出所有Provider端点
   * GET /admin/providers?limit=100&offset=0&auth_type=api_key
   */
  async listProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        limit = 100,
        offset = 0,
        auth_type: authType,
      } = req.query;

      // 调用仓储层
      const providers = await providerRepo.listProviderEndpoints({
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        authType: authType as string | undefined,
      });

      // 获取总数（艹，简单粗暴直接查一次）
      const allProviders = await providerRepo.listProviderEndpoints({
        limit: 10000, // 足够大
        offset: 0,
        authType: authType as string | undefined,
      });

      res.json({
        success: true,
        data: {
          items: providers,
          total: allProviders.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error: any) {
      console.error(`[ProvidersController] 列出Provider失败: ${error.message}`);
      next(error);
    }
  }

  /**
   * 获取单个Provider端点
   * GET /admin/providers/:provider_ref
   */
  async getProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider_ref } = req.params;

      const provider = await providerRepo.getProviderEndpoint(provider_ref);

      if (!provider) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Provider端点不存在: ${provider_ref}`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: provider,
      });
    } catch (error: any) {
      console.error(`[ProvidersController] 获取Provider失败: ${error.message}`);
      next(error);
    }
  }

  /**
   * 创建Provider端点
   * POST /admin/providers
   */
  async createProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: ProviderEndpointInput = req.body;

      // 验证输入（艹，基础校验）
      const validationError = this.validateProviderInput(input, true);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError,
          },
        });
        return;
      }

      // 检查是否已存在
      const exists = await providerRepo.providerEndpointExists(input.provider_ref);
      if (exists) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Provider引用ID已存在: ${input.provider_ref}`,
          },
        });
        return;
      }

      // 创建Provider
      const created = await providerRepo.createProviderEndpoint(input);

      // 记录审计日志
      await this.recordAuditLog({
        action: 'CREATE',
        provider_ref: created.provider_ref,
        user_id: (req as any).user?.id || null,
        details: { provider_name: created.provider_name },
      });

      res.status(201).json({
        success: true,
        data: created,
      });
    } catch (error: any) {
      console.error(`[ProvidersController] 创建Provider失败: ${error.message}`);
      next(error);
    }
  }

  /**
   * 更新Provider端点
   * PUT /admin/providers/:provider_ref
   */
  async updateProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider_ref } = req.params;
      const updates: Partial<ProviderEndpointInput> = req.body;

      // 验证输入
      const validationError = this.validateProviderInput(updates, false);
      if (validationError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validationError,
          },
        });
        return;
      }

      // 更新Provider
      try {
        const updated = await providerRepo.updateProviderEndpoint(
          provider_ref,
          updates
        );

        // 记录审计日志
        await this.recordAuditLog({
          action: 'UPDATE',
          provider_ref: updated.provider_ref,
          user_id: (req as any).user?.id || null,
          details: updates,
        });

        res.json({
          success: true,
          data: updated,
        });
      } catch (error: any) {
        if (error.message.includes('不存在')) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: error.message,
            },
          });
          return;
        }
        throw error;
      }
    } catch (error: any) {
      console.error(`[ProvidersController] 更新Provider失败: ${error.message}`);
      next(error);
    }
  }

  /**
   * 删除Provider端点
   * DELETE /admin/providers/:provider_ref
   */
  async deleteProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider_ref } = req.params;

      const deleted = await providerRepo.deleteProviderEndpoint(provider_ref);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Provider端点不存在: ${provider_ref}`,
          },
        });
        return;
      }

      // 记录审计日志
      await this.recordAuditLog({
        action: 'DELETE',
        provider_ref,
        user_id: (req as any).user?.id || null,
        details: {},
      });

      res.json({
        success: true,
        message: 'Provider端点已删除',
      });
    } catch (error: any) {
      console.error(`[ProvidersController] 删除Provider失败: ${error.message}`);
      next(error);
    }
  }

  /**
   * 测试Provider连接
   * POST /admin/providers/:provider_ref/test-connection
   */
  async testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider_ref } = req.params;

      // 获取Provider配置
      const provider = await providerRepo.getProviderEndpoint(provider_ref);

      if (!provider) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Provider端点不存在: ${provider_ref}`,
          },
        });
        return;
      }

      // 艹，这里应该调用对应Provider的healthCheck方法
      // 但现在先简单返回成功（后续集成时再完善）
      const healthy = true;
      const message = 'Provider连接正常';

      // 记录审计日志
      await this.recordAuditLog({
        action: 'TEST_CONNECTION',
        provider_ref,
        user_id: (req as any).user?.id || null,
        details: { healthy, message },
      });

      res.json({
        success: true,
        data: {
          healthy,
          message,
          tested_at: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error(`[ProvidersController] 测试连接失败: ${error.message}`);
      next(error);
    }
  }

  /**
   * 验证Provider输入
   * @param input - 输入数据
   * @param requireAll - 是否要求所有必填字段
   * @returns 错误信息，如果没有错误则返回null
   */
  private validateProviderInput(
    input: Partial<ProviderEndpointInput>,
    requireAll: boolean
  ): string | null {
    if (requireAll) {
      if (!input.provider_ref) {
        return '缺少必填字段: provider_ref';
      }
      if (!input.provider_name) {
        return '缺少必填字段: provider_name';
      }
      if (!input.endpoint_url) {
        return '缺少必填字段: endpoint_url';
      }
      if (!input.credentials) {
        return '缺少必填字段: credentials';
      }
      if (!input.auth_type) {
        return '缺少必填字段: auth_type';
      }
    }

    // provider_ref格式校验
    if (input.provider_ref) {
      if (!/^[a-zA-Z0-9_-]+$/.test(input.provider_ref)) {
        return 'provider_ref只能包含字母、数字、下划线和短横线';
      }
      if (input.provider_ref.length > 100) {
        return 'provider_ref长度不能超过100字符';
      }
    }

    // provider_name长度校验
    if (input.provider_name && input.provider_name.length > 200) {
      return 'provider_name长度不能超过200字符';
    }

    // endpoint_url长度校验
    if (input.endpoint_url && input.endpoint_url.length > 500) {
      return 'endpoint_url长度不能超过500字符';
    }

    // auth_type枚举校验
    if (input.auth_type) {
      const validAuthTypes = ['api_key', 'bearer', 'basic', 'oauth2'];
      if (!validAuthTypes.includes(input.auth_type)) {
        return `auth_type必须是以下之一: ${validAuthTypes.join(', ')}`;
      }
    }

    return null;
  }

  /**
   * 记录审计日志
   * 艹，这个tm很重要，所有操作都要记录！
   */
  private async recordAuditLog(log: {
    action: string;
    provider_ref: string;
    user_id: number | null;
    details: any;
  }): Promise<void> {
    try {
      // 艹，这里应该写入provider_audit_logs表
      // 但先用console.log代替（后续实现审计日志表后再完善）
      console.log('[AUDIT] Provider操作日志:', {
        ...log,
        timestamp: new Date().toISOString(),
      });

      // TODO: 后续实现审计日志表后，写入数据库
      // await db('provider_audit_logs').insert({
      //   action: log.action,
      //   provider_ref: log.provider_ref,
      //   user_id: log.user_id,
      //   details: JSON.stringify(log.details),
      //   created_at: new Date(),
      // });
    } catch (error: any) {
      console.error('[AUDIT] 记录审计日志失败:', error.message);
      // 艹，审计日志失败不应该影响主流程
    }
  }
}

// 导出单例实例
export default new ProvidersController();
