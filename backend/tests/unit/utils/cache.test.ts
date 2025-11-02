/**
 * Cache工具单元测试
 * 艹，测试两层缓存的读写逻辑！
 */

import { CacheManager } from '../../../src/utils/cache';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  }));
});

describe('CacheManager - 单元测试', () => {
  let cache: CacheManager;

  beforeEach(() => {
    // 创建新的缓存实例（不连接Redis）
    cache = new CacheManager({
      namespace: 'test',
      l1MaxSize: 100,
      l1DefaultTtl: 1000, // 1秒
      l2DefaultTtl: 60, // 60秒
      // 不传redisConfig，不初始化Redis
    });
  });

  afterEach(async () => {
    await cache.close();
  });

  describe('L1缓存（仅内存）', () => {
    test('应该成功写入和读取L1缓存', async () => {
      await cache.set('key1', 'value1');

      const value = await cache.get('key1');
      expect(value).toBe('value1');
    });

    test('应该支持对象类型', async () => {
      const obj = { name: '老王', age: 35 };
      await cache.set('user', obj);

      const cached = await cache.get('user');
      expect(cached).toEqual(obj);
    });

    test('应该支持数组类型', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cache.set('numbers', arr);

      const cached = await cache.get('numbers');
      expect(cached).toEqual(arr);
    });

    test('未命中应该返回null', async () => {
      const value = await cache.get('non-existent-key');
      expect(value).toBeNull();
    });

    test('应该支持删除缓存', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');

      const value = await cache.get('key1');
      expect(value).toBeNull();
    });

    test('应该支持清空所有缓存', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBeNull();
    });
  });

  describe('命名空间隔离', () => {
    test('不同namespace的缓存应该隔离', async () => {
      const cache1 = new CacheManager({ namespace: 'ns1' });
      const cache2 = new CacheManager({ namespace: 'ns2' });

      await cache1.set('key', 'value1');
      await cache2.set('key', 'value2');

      expect(await cache1.get('key')).toBe('value1');
      expect(await cache2.get('key')).toBe('value2');

      await cache1.close();
      await cache2.close();
    });
  });

  describe('缓存统计', () => {
    test('应该正确统计L1命中和未命中', async () => {
      await cache.set('key1', 'value1');

      // 第一次读取，L1命中
      await cache.get('key1');

      // 第二次读取，L1命中
      await cache.get('key1');

      // 读取不存在的key，L1未命中
      await cache.get('non-existent');

      const stats = cache.getStats();
      expect(stats.l1Hits).toBe(2);
      expect(stats.l1Misses).toBe(1);
    });

    test('应该正确计算命中率', async () => {
      await cache.set('key1', 'value1');

      // 3次L1命中
      await cache.get('key1');
      await cache.get('key1');
      await cache.get('key1');

      // 2次L1未命中
      await cache.get('key2');
      await cache.get('key3');

      const hitRate = cache.getHitRate();
      expect(hitRate.l1).toBe(3 / 5); // 60%
      expect(hitRate.overall).toBe(3 / 5); // 60%
    });

    test('应该支持重置统计信息', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.l1Hits).toBe(0);
      expect(stats.l1Misses).toBe(0);
    });

    test('应该正确统计缓存大小', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const stats = cache.getStats();
      expect(stats.l1Size).toBe(3);
    });
  });

  describe('边界情况', () => {
    test('应该处理null值', async () => {
      await cache.set('key', null);

      const value = await cache.get('key');
      expect(value).toBeNull();
    });

    test('应该处理undefined值', async () => {
      await cache.set('key', undefined);

      // undefined序列化后会变成null
      const value = await cache.get('key');
      expect(value).toBeNull();
    });

    test('应该处理空字符串', async () => {
      await cache.set('key', '');

      const value = await cache.get('key');
      expect(value).toBe('');
    });

    test('应该处理数字0', async () => {
      await cache.set('key', 0);

      const value = await cache.get('key');
      expect(value).toBe(0);
    });

    test('应该处理布尔值false', async () => {
      await cache.set('key', false);

      const value = await cache.get('key');
      expect(value).toBe(false);
    });

    test('应该处理大对象', async () => {
      const largeObj = {
        data: 'x'.repeat(10000), // 10KB字符串
        nested: {
          deep: {
            value: 123,
          },
        },
      };

      await cache.set('large', largeObj);

      const cached = await cache.get('large');
      expect(cached).toEqual(largeObj);
    });
  });

  describe('TTL过期', () => {
    test('过期的缓存应该自动清除', async () => {
      // 设置TTL为100ms
      const shortCache = new CacheManager({
        namespace: 'test-ttl',
        l1DefaultTtl: 100,
      });

      await shortCache.set('key', 'value');

      // 立即读取，应该命中
      expect(await shortCache.get('key')).toBe('value');

      // 等待150ms后，应该过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 应该返回null
      expect(await shortCache.get('key')).toBeNull();

      await shortCache.close();
    });
  });

  describe('LRU淘汰策略', () => {
    test('超过maxSize时应该淘汰最久未使用的条目', async () => {
      // 创建小容量缓存（最多3条）
      const smallCache = new CacheManager({
        namespace: 'test-lru',
        l1MaxSize: 3,
      });

      // 依次写入4个key
      await smallCache.set('key1', 'value1');
      await smallCache.set('key2', 'value2');
      await smallCache.set('key3', 'value3');

      // key1应该还在
      expect(await smallCache.get('key1')).toBe('value1');

      // 写入第4个key，应该淘汰最久未使用的（key2）
      await smallCache.set('key4', 'value4');

      // key2应该被淘汰
      expect(await smallCache.get('key2')).toBeNull();

      // 其他key应该还在
      expect(await smallCache.get('key1')).toBe('value1');
      expect(await smallCache.get('key3')).toBe('value3');
      expect(await smallCache.get('key4')).toBe('value4');

      await smallCache.close();
    });
  });
});
