/**
 * REL-P2-CACHE-212: 前端缓存策略
 * 艹！配置数据必须缓存，减少请求提升性能！
 *
 * @author 老王
 */

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 缓存键名 */
  key: string;
  /** 缓存时间（毫秒），超过此时间认为过期 */
  ttl: number;
  /** 是否启用stale-while-revalidate（过期后先返回旧数据，后台更新） */
  swr?: boolean;
  /** 版本号（用于强制刷新） */
  version?: string;
}

/**
 * 缓存项
 */
export interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  version: string;
  ttl: number;
}

/**
 * 缓存策略类型
 */
export type CacheStrategy = 'memory' | 'localStorage' | 'sessionStorage';

/**
 * 内存缓存存储
 */
const memoryCache = new Map<string, CacheItem>();

/**
 * 缓存管理器
 */
export class CacheManager {
  private strategy: CacheStrategy;
  private globalVersion: string;

  constructor(strategy: CacheStrategy = 'memory', globalVersion: string = '1.0.0') {
    this.strategy = strategy;
    this.globalVersion = globalVersion;
  }

  /**
   * 获取缓存存储
   */
  private getStorage(): Storage | Map<string, CacheItem> {
    switch (this.strategy) {
      case 'localStorage':
        return typeof window !== 'undefined' ? window.localStorage : memoryCache;
      case 'sessionStorage':
        return typeof window !== 'undefined' ? window.sessionStorage : memoryCache;
      case 'memory':
      default:
        return memoryCache;
    }
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, config: Partial<CacheConfig> = {}): void {
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      version: config.version || this.globalVersion,
      ttl: config.ttl || 5 * 60 * 1000, // 默认5分钟
    };

    const storage = this.getStorage();

    if (storage instanceof Map) {
      storage.set(key, cacheItem);
    } else {
      try {
        storage.setItem(key, JSON.stringify(cacheItem));
      } catch (error) {
        console.error('[CacheManager] Failed to set cache:', error);
      }
    }
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): CacheItem<T> | null {
    const storage = this.getStorage();

    try {
      let cacheItem: CacheItem<T> | null = null;

      if (storage instanceof Map) {
        cacheItem = storage.get(key) as CacheItem<T> || null;
      } else {
        const item = storage.getItem(key);
        if (item) {
          cacheItem = JSON.parse(item) as CacheItem<T>;
        }
      }

      return cacheItem;
    } catch (error) {
      console.error('[CacheManager] Failed to get cache:', error);
      return null;
    }
  }

  /**
   * 检查缓存是否有效
   */
  isValid(key: string): boolean {
    const item = this.get(key);
    if (!item) return false;

    // 检查版本
    if (item.version !== this.globalVersion) {
      return false;
    }

    // 检查是否过期
    const isExpired = Date.now() - item.timestamp > item.ttl;
    return !isExpired;
  }

  /**
   * 检查缓存是否过期
   */
  isExpired(key: string): boolean {
    return !this.isValid(key);
  }

  /**
   * 删除缓存
   */
  remove(key: string): void {
    const storage = this.getStorage();

    if (storage instanceof Map) {
      storage.delete(key);
    } else {
      storage.removeItem(key);
    }
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    const storage = this.getStorage();

    if (storage instanceof Map) {
      storage.clear();
    } else {
      storage.clear();
    }
  }

  /**
   * 更新全局版本号（强制刷新所有缓存）
   */
  setGlobalVersion(version: string): void {
    this.globalVersion = version;
  }

  /**
   * 获取全局版本号
   */
  getGlobalVersion(): string {
    return this.globalVersion;
  }
}

/**
 * 全局缓存管理器实例
 */
export const globalCacheManager = new CacheManager('localStorage');

/**
 * SWR (Stale-While-Revalidate) 缓存Hook
 * 过期后先返回旧数据，后台更新新数据
 */
export async function fetchWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: Partial<CacheConfig> = {}
): Promise<T> {
  const manager = globalCacheManager;
  const cacheItem = manager.get<T>(key);

  // 如果缓存有效，直接返回
  if (cacheItem && manager.isValid(key)) {
    return cacheItem.data;
  }

  // 如果启用SWR且有过期缓存，先返回旧数据
  if (config.swr && cacheItem) {
    // 后台更新
    fetcher()
      .then((data) => {
        manager.set(key, data, config);
      })
      .catch((error) => {
        console.error('[SWR] Background fetch failed:', error);
      });

    // 立即返回旧数据
    return cacheItem.data;
  }

  // 否则，获取新数据
  const data = await fetcher();
  manager.set(key, data, config);
  return data;
}

/**
 * 配置缓存Hook
 * 专门用于配置数据，支持版本号和自动刷新
 */
export async function fetchConfigWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    version?: string;
    onVersionMismatch?: () => void;
  } = {}
): Promise<T> {
  const manager = globalCacheManager;
  const cacheItem = manager.get<T>(key);

  // 检查版本是否匹配
  if (cacheItem && options.version && cacheItem.version !== options.version) {
    console.log('[ConfigCache] Version mismatch, invalidating cache');
    manager.remove(key);

    // 触发版本不匹配回调
    if (options.onVersionMismatch) {
      options.onVersionMismatch();
    }
  }

  // 使用SWR策略获取数据
  return fetchWithSWR(key, fetcher, {
    key,
    ttl: options.ttl || 10 * 60 * 1000, // 默认10分钟
    swr: true,
    version: options.version,
  });
}

/**
 * 批量预加载缓存
 */
export async function prefetchCache<T>(
  items: Array<{ key: string; fetcher: () => Promise<T>; config?: Partial<CacheConfig> }>
): Promise<void> {
  await Promise.all(
    items.map(async ({ key, fetcher, config }) => {
      try {
        await fetchWithSWR(key, fetcher, config);
      } catch (error) {
        console.error(`[Prefetch] Failed to prefetch ${key}:`, error);
      }
    })
  );
}

/**
 * 缓存键生成器
 */
export const CacheKeys = {
  /** 模板列表 */
  templates: (category?: string) =>
    category ? `templates:${category}` : 'templates:all',

  /** 模板详情 */
  templateDetail: (id: string) => `template:${id}`,

  /** 筛选选项 */
  filters: (type: string) => `filters:${type}`,

  /** 菜单配置 */
  menu: () => 'menu',

  /** 用户配置 */
  userConfig: (userId: string) => `user:${userId}:config`,

  /** 系统配置 */
  systemConfig: (key: string) => `system:${key}`,

  /** Provider配置 */
  providers: () => 'providers',

  /** 分类列表 */
  categories: (type: string) => `categories:${type}`,
};

/**
 * 缓存装饰器（用于类方法）
 */
export function Cacheable(config: Partial<CacheConfig> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

      return fetchWithSWR(
        cacheKey,
        () => originalMethod.apply(this, args),
        config
      );
    };

    return descriptor;
  };
}

/**
 * 监听配置版本变化
 */
export function watchConfigVersion(
  versionKey: string = 'config:version',
  onVersionChange: (newVersion: string) => void
) {
  if (typeof window === 'undefined') return;

  // 定期检查版本
  const checkInterval = 60 * 1000; // 1分钟检查一次

  const check = async () => {
    try {
      const response = await fetch('/api/config/version');
      const { version } = await response.json();

      const currentVersion = globalCacheManager.getGlobalVersion();

      if (version !== currentVersion) {
        console.log(`[ConfigWatch] Version changed: ${currentVersion} -> ${version}`);
        globalCacheManager.setGlobalVersion(version);
        onVersionChange(version);

        // 清空所有缓存
        globalCacheManager.clear();
      }
    } catch (error) {
      console.error('[ConfigWatch] Failed to check version:', error);
    }
  };

  // 立即检查一次
  check();

  // 定期检查
  const intervalId = setInterval(check, checkInterval);

  // 返回清理函数
  return () => clearInterval(intervalId);
}

/**
 * React Hook: 使用缓存的数据
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: Partial<CacheConfig> = {}
) {
  // 这个Hook在React组件中使用
  // 这里只是提供基础实现，实际使用时需要配合useState/useEffect
  return {
    fetch: () => fetchWithSWR(key, fetcher, config),
    invalidate: () => globalCacheManager.remove(key),
    isValid: () => globalCacheManager.isValid(key),
  };
}

/**
 * 缓存统计信息
 */
export function getCacheStats(): {
  totalKeys: number;
  validKeys: number;
  expiredKeys: number;
  totalSize: number;
} {
  const storage = globalCacheManager['getStorage']();

  if (storage instanceof Map) {
    const keys = Array.from(storage.keys());
    return {
      totalKeys: keys.length,
      validKeys: keys.filter((key) => globalCacheManager.isValid(key)).length,
      expiredKeys: keys.filter((key) => globalCacheManager.isExpired(key)).length,
      totalSize: 0, // Map没有大小限制
    };
  } else {
    const keys = Object.keys(storage);
    const totalSize = keys.reduce((sum, key) => {
      const item = storage.getItem(key);
      return sum + (item ? item.length : 0);
    }, 0);

    return {
      totalKeys: keys.length,
      validKeys: keys.filter((key) => globalCacheManager.isValid(key)).length,
      expiredKeys: keys.filter((key) => globalCacheManager.isExpired(key)).length,
      totalSize,
    };
  }
}

/**
 * 导出所有工具
 */
export default {
  CacheManager,
  globalCacheManager,
  fetchWithSWR,
  fetchConfigWithCache,
  prefetchCache,
  CacheKeys,
  Cacheable,
  watchConfigVersion,
  useCachedData,
  getCacheStats,
};
