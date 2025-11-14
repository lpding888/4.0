/**
 * 统一响应格式工具
 * 艹，TypeScript版本，不偷懒！
 */

export interface SuccessResponse<T = unknown> {
  success: true;
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  code: number;
  error: string;
  message: string;
  details: unknown;
  timestamp: string;
}

export interface PaginationInfo {
  current: number;
  total: number;
  pageSize: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = unknown> {
  success: true;
  code: number;
  message: string;
  data: {
    items: T[];
    pagination: PaginationInfo;
  };
  timestamp: string;
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T = unknown>(
  data?: T,
  message: string = '操作成功',
  code: number = 200
): SuccessResponse<T | null> {
  const payload = (data === undefined ? null : data) as T | null;
  return {
    success: true,
    code,
    message,
    data: payload,
    timestamp: new Date().toISOString()
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  error: string,
  message: string = '操作失败',
  details: unknown = null,
  code: number = 400
): ErrorResponse {
  return {
    success: false,
    code,
    error,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T = unknown>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  message: string = '获取数据成功'
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    code: 200,
    message,
    data: {
      items,
      pagination: {
        current: page,
        total: totalPages,
        pageSize: limit,
        totalCount: total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    },
    timestamp: new Date().toISOString()
  };
}
