/**
 * Audit Logger Service
 * 艹，审计日志服务！便捷记录方法
 */

import * as auditRepo from '../repositories/auditLogs.repo';
import { Request } from 'express';

/**
 * 从Request提取用户信息和IP
 */
function extractRequestInfo(req?: Request) {
  return {
    user_id: (req as any)?.user?.id,
    user_name: (req as any)?.user?.name || (req as any)?.user?.email,
    ip_address: req?.ip || req?.connection?.remoteAddress,
    user_agent: req?.get('user-agent'),
  };
}

/**
 * 记录创建操作
 */
export async function logCreate(params: {
  entity_type: string;
  entity_id: number;
  req?: Request;
  changes?: any;
  reason?: string;
}): Promise<void> {
  const { entity_type, entity_id, req, changes, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'create',
    changes,
    reason,
    ...extractRequestInfo(req),
  });
}

/**
 * 记录更新操作
 */
export async function logUpdate(params: {
  entity_type: string;
  entity_id: number;
  req?: Request;
  changes?: any;
  reason?: string;
}): Promise<void> {
  const { entity_type, entity_id, req, changes, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'update',
    changes,
    reason,
    ...extractRequestInfo(req),
  });
}

/**
 * 记录删除操作
 */
export async function logDelete(params: {
  entity_type: string;
  entity_id: number;
  req?: Request;
  changes?: any;
  reason?: string;
}): Promise<void> {
  const { entity_type, entity_id, req, changes, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'delete',
    changes,
    reason,
    ...extractRequestInfo(req),
  });
}

/**
 * 记录发布操作
 */
export async function logPublish(params: {
  entity_type: string;
  entity_id: number;
  req?: Request;
  reason?: string;
}): Promise<void> {
  const { entity_type, entity_id, req, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'publish',
    reason,
    ...extractRequestInfo(req),
  });
}

/**
 * 记录下线操作
 */
export async function logUnpublish(params: {
  entity_type: string;
  entity_id: number;
  req?: Request;
  reason?: string;
}): Promise<void> {
  const { entity_type, entity_id, req, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'unpublish',
    reason,
    ...extractRequestInfo(req),
  });
}

/**
 * 记录审核通过操作
 */
export async function logApprove(params: {
  entity_type: string;
  entity_id: number;
  req?: Request;
  reason?: string;
}): Promise<void> {
  const { entity_type, entity_id, req, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'approve',
    reason,
    ...extractRequestInfo(req),
  });
}

/**
 * 记录审核拒绝操作
 */
export async function logReject(params: {
  entity_type: string;
  entity_id: number;
  req?: Request;
  reason?: string;
}): Promise<void> {
  const { entity_type, entity_id, req, reason } = params;

  await auditRepo.createAuditLog({
    entity_type,
    entity_id,
    action: 'reject',
    reason,
    ...extractRequestInfo(req),
  });
}
