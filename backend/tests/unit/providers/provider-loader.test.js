/**
 * ProviderLoader 单元测试
 * 艹，这些测试必须全部通过，否则老王我睡不着！
 */

// 注册 ts-node 以支持 TypeScript 导入
require('ts-node/register');

const { ProviderLoader } = require('../../../src/providers/provider-loader');
const { ProviderError, ProviderErrorCode } = require('../../../src/providers/types');

describe('ProviderLoader - 单元测试', () => {
  let loader;

  beforeEach(() => {
    // 每个测试前创建新的 ProviderLoader 实例
    loader = new ProviderLoader();
  });

  afterEach(() => {
    // 每个测试后清理缓存
    loader.clearCache();
  });

  describe('白名单机制测试', () => {
    test('应该成功加载白名单中的Provider（GENERIC_HTTP）', async () => {
      const provider = await loader.loadProvider('GENERIC_HTTP');

      expect(provider).toBeDefined();
      expect(provider.name).toBe('Generic HTTP Provider'); // 人类可读的名称，不是白名单key
      expect(typeof provider.execute).toBe('function');
    });

    test('应该拒绝非白名单的Provider并抛出ERR_PROVIDER_NOT_ALLOWED', async () => {
      try {
        await loader.loadProvider('MALICIOUS_PROVIDER');
        // 艹，如果没抛错就是测试失败！
        fail('应该抛出ProviderError');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect(error.code).toBe(ProviderErrorCode.ERR_PROVIDER_NOT_ALLOWED);
        expect(error.message).toContain('不在白名单中');
        expect(error.details.handlerKey).toBe('MALICIOUS_PROVIDER');
      }
    });

    test('应该返回所有允许的Provider类型', () => {
      const allowedProviders = loader.getAllowedProviders();

      expect(Array.isArray(allowedProviders)).toBe(true);
      expect(allowedProviders).toContain('GENERIC_HTTP');
      expect(allowedProviders).toContain('TENCENT_CI');
      expect(allowedProviders).toContain('RUNNINGHUB');
      expect(allowedProviders).toContain('SCF');
      expect(allowedProviders.length).toBeGreaterThanOrEqual(4);
    });

    test('isAllowed应该正确判断Provider是否在白名单', () => {
      expect(loader.isAllowed('GENERIC_HTTP')).toBe(true);
      expect(loader.isAllowed('MALICIOUS_PROVIDER')).toBe(false);
      expect(loader.isAllowed('RANDOM_KEY')).toBe(false);
    });
  });

  describe('缓存机制测试', () => {
    test('首次加载应该实例化Provider并缓存', async () => {
      const stats1 = loader.getStats();
      expect(stats1.cacheSize).toBe(0);
      expect(stats1.loadCount).toBe(0);

      const provider = await loader.loadProvider('GENERIC_HTTP');

      const stats2 = loader.getStats();
      expect(stats2.cacheSize).toBe(1);
      expect(stats2.loadCount).toBe(1);
      expect(stats2.cachedProviders).toContain('GENERIC_HTTP');
      expect(provider).toBeDefined();
    });

    test('二次加载应该命中缓存而不重复实例化', async () => {
      // 首次加载
      const provider1 = await loader.loadProvider('GENERIC_HTTP');
      const stats1 = loader.getStats();
      expect(stats1.loadCount).toBe(1);
      expect(stats1.cacheHitCount).toBe(0);

      // 二次加载（应该命中缓存）
      const provider2 = await loader.loadProvider('GENERIC_HTTP');
      const stats2 = loader.getStats();
      expect(stats2.loadCount).toBe(1); // 不应该增加
      expect(stats2.cacheHitCount).toBe(1); // 应该增加

      // 艹，两次返回的应该是同一个实例！
      expect(provider1).toBe(provider2);
    });

    test('clearCache应该清空所有缓存', async () => {
      await loader.loadProvider('GENERIC_HTTP');
      expect(loader.getStats().cacheSize).toBe(1);

      loader.clearCache();

      expect(loader.getStats().cacheSize).toBe(0);
      expect(loader.getStats().cachedProviders).toEqual([]);
    });

    test('clearCacheForProvider应该清除指定Provider的缓存', async () => {
      await loader.loadProvider('GENERIC_HTTP');
      expect(loader.getStats().cacheSize).toBe(1);

      loader.clearCacheForProvider('GENERIC_HTTP');

      expect(loader.getStats().cacheSize).toBe(0);

      // 再次加载应该重新实例化（loadCount增加）
      const stats1 = loader.getStats();
      const loadCountBefore = stats1.loadCount;

      await loader.loadProvider('GENERIC_HTTP');

      const stats2 = loader.getStats();
      expect(stats2.loadCount).toBe(loadCountBefore + 1);
    });
  });

  describe('错误处理测试', () => {
    test('应该正确统计错误次数', async () => {
      const stats1 = loader.getStats();
      expect(stats1.errorCount).toBe(0);

      // 触发非法handlerKey错误
      try {
        await loader.loadProvider('INVALID_KEY');
      } catch (error) {
        // 预期错误
      }

      const stats2 = loader.getStats();
      expect(stats2.errorCount).toBe(1);
    });

    test('空handlerKey应该抛出错误', async () => {
      try {
        await loader.loadProvider('');
        fail('应该抛出ProviderError');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect(error.code).toBe(ProviderErrorCode.ERR_PROVIDER_NOT_ALLOWED);
      }
    });

    test('null/undefined handlerKey应该抛出错误', async () => {
      try {
        await loader.loadProvider(null);
        fail('应该抛出ProviderError');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
      }

      try {
        await loader.loadProvider(undefined);
        fail('应该抛出ProviderError');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
      }
    });
  });

  describe('统计信息测试', () => {
    test('getStats应该返回完整的统计信息', async () => {
      const stats = loader.getStats();

      expect(stats).toHaveProperty('loadCount');
      expect(stats).toHaveProperty('cacheHitCount');
      expect(stats).toHaveProperty('errorCount');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('cachedProviders');

      expect(typeof stats.loadCount).toBe('number');
      expect(typeof stats.cacheHitCount).toBe('number');
      expect(typeof stats.errorCount).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
      expect(Array.isArray(stats.cachedProviders)).toBe(true);
    });

    test('统计信息应该正确累计', async () => {
      // 加载3次Provider（2次命中缓存）
      await loader.loadProvider('GENERIC_HTTP'); // loadCount=1
      await loader.loadProvider('GENERIC_HTTP'); // cacheHitCount=1
      await loader.loadProvider('GENERIC_HTTP'); // cacheHitCount=2

      // 触发1次错误
      try {
        await loader.loadProvider('INVALID');
      } catch (error) {
        // 预期错误
      }

      const stats = loader.getStats();
      expect(stats.loadCount).toBe(1);
      expect(stats.cacheHitCount).toBe(2);
      expect(stats.errorCount).toBe(1);
      expect(stats.cacheSize).toBe(1);
    });
  });
});

describe('GenericHttpProvider - 单元测试', () => {
  let provider;

  beforeEach(async () => {
    const loader = new ProviderLoader();
    provider = await loader.loadProvider('GENERIC_HTTP');
  });

  test('Provider应该有正确的name属性', () => {
    expect(provider.name).toBe('Generic HTTP Provider'); // 人类可读的名称
  });

  test('Provider应该实现execute方法', () => {
    expect(typeof provider.execute).toBe('function');
  });

  test('Provider应该实现healthCheck方法', () => {
    expect(typeof provider.healthCheck).toBe('function');
  });

  test('healthCheck应该返回boolean', async () => {
    const result = await provider.healthCheck();
    expect(typeof result).toBe('boolean');
  });
});
