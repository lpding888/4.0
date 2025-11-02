/**
 * 简易内存缓存工具
 * 艹，这个tm用于axios请求缓存和去重！
 *
 * 功能：
 * 1. TTL缓存机制（默认30秒）
 * 2. 请求去重（inflight tracking）
 * 3. 自动清理过期数据
 *
 * @author 老王
 */

/**
 * 缓存条目
 */
interface CacheEntry<T = any> {
  data: T;
  expireAt: number; // Unix timestamp (ms)
}

/**
 * 请求缓存存储
 * 艹，Key格式: `${method}:${url}:${JSON.stringify(params)}`
 */
const requestCacheMap = new Map<string, CacheEntry>();

/**
 * 正在进行的请求（用于去重）
 * 艹，同一个key的请求不会发两次！
 */
const inflightRequests = new Map<string, Promise<any>>();

/**
 * 默认TTL（毫秒）
 * 艹，30秒足够了，太长了数据会不准！
 */
export const DEFAULT_CACHE_TTL = 30 * 1000; // 30s

/**
 * 设置请求缓存
 * 艹，存储API响应结果！
 *
 * @param key - 缓存key（通常是请求的唯一标识）
 * @param data - 要缓存的数据
 * @param ttlMs - 缓存过期时间（毫秒），默认30秒
 */
export function setRequestCache<T = any>(
  key: string,
  data: T,
  ttlMs: number = DEFAULT_CACHE_TTL
): void {
  const expireAt = Date.now() + ttlMs;
  requestCacheMap.set(key, { data, expireAt });
}

/**
 * 获取请求缓存
 * 艹，返回缓存数据，过期了就返回null！
 *
 * @param key - 缓存key
 * @returns 缓存的数据，如果不存在或已过期则返回null
 */
export function getRequestCache<T = any>(key: string): T | null {
  const entry = requestCacheMap.get(key);

  if (!entry) {
    return null; // 艹，没缓存
  }

  // 艹，检查是否过期
  if (Date.now() > entry.expireAt) {
    requestCacheMap.delete(key); // 艹，过期了就删掉
    return null;
  }

  return entry.data as T;
}

/**
 * 清除指定key的缓存
 * 艹，手动清理缓存用的！
 *
 * @param key - 缓存key
 * @returns 是否成功删除
 */
export function clearRequestCache(key: string): boolean {
  return requestCacheMap.delete(key);
}

/**
 * 清除所有缓存
 * 艹，危险操作，慎用！
 */
export function clearAllRequestCache(): void {
  requestCacheMap.clear();
}

/**
 * 清理所有过期的缓存
 * 艹，定期调用可以释放内存！
 *
 * @returns 清理的数量
 */
export function cleanExpiredCache(): number {
  const now = Date.now();
  let cleaned = 0;

  requestCacheMap.forEach((entry, key) => {
    if (now > entry.expireAt) {
      requestCacheMap.delete(key);
      cleaned++;
    }
  });

  return cleaned;
}

/**
 * 获取正在进行的请求
 * 艹，用于请求去重！
 *
 * @param key - 请求key
 * @returns 正在进行的Promise，如果没有则返回null
 */
export function getInflight<T = any>(key: string): Promise<T> | null {
  return (inflightRequests.get(key) as Promise<T>) || null;
}

/**
 * 设置正在进行的请求
 * 艹，发起请求前调用，防止重复请求！
 *
 * @param key - 请求key
 * @param promise - 请求Promise
 */
export function setInflight<T = any>(key: string, promise: Promise<T>): void {
  inflightRequests.set(key, promise);
}

/**
 * 删除正在进行的请求记录
 * 艹，请求完成后调用！
 *
 * @param key - 请求key
 * @returns 是否成功删除
 */
export function deleteInflight(key: string): boolean {
  return inflightRequests.delete(key);
}

/**
 * 生成缓存key
 * 艹，统一生成缓存key的工具函数！
 *
 * @param method - HTTP方法（GET, POST等）
 * @param url - 请求URL
 * @param params - 请求参数（可选）
 * @returns 缓存key
 */
export function generateCacheKey(
  method: string,
  url: string,
  params?: Record<string, any>
): string {
  const paramsStr = params ? JSON.stringify(params) : '';
  return `${method.toUpperCase()}:${url}:${paramsStr}`;
}

/**
 * 获取缓存统计信息
 * 艹，调试用的，看看缓存命中情况！
 *
 * @returns 缓存统计
 */
export function getCacheStats(): {
  totalEntries: number;
  expiredEntries: number;
  inflightRequests: number;
  cacheSize: number; // 预估内存占用（字节）
} {
  const now = Date.now();
  let expiredCount = 0;

  requestCacheMap.forEach((entry) => {
    if (now > entry.expireAt) {
      expiredCount++;
    }
  });

  // 艹，粗略估算内存占用
  const cacheSize = Array.from(requestCacheMap.values()).reduce((sum, entry) => {
    const dataSize = JSON.stringify(entry.data).length;
    return sum + dataSize;
  }, 0);

  return {
    totalEntries: requestCacheMap.size,
    expiredEntries: expiredCount,
    inflightRequests: inflightRequests.size,
    cacheSize,
  };
}

/**
 * 启动定期清理任务
 * 艹，每5分钟清理一次过期缓存！
 *
 * @param intervalMs - 清理间隔（毫秒），默认5分钟
 * @returns 清理任务的定时器ID
 */
export function startCacheCleanup(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  return setInterval(() => {
    const cleaned = cleanExpiredCache();
    if (cleaned > 0) {
      console.log(`[Cache] 艹，清理了 ${cleaned} 个过期缓存条目`);
    }
  }, intervalMs);
}

/**
 * 停止定期清理任务
 * 艹，清理定时器用的！
 *
 * @param timerId - 定时器ID
 */
export function stopCacheCleanup(timerId: NodeJS.Timeout): void {
  clearInterval(timerId);
}
