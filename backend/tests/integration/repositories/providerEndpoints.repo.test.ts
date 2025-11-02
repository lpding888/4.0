/**
 * ProviderEndpoints Repository 集成测试
 * 艹，这个tm必须端到端验证加密流程！
 * 测试覆盖：CRUD完整流程/加密存储/解密读取/缓存机制
 */

import db from '../../../src/db';
import {
  createProviderEndpoint,
  getProviderEndpoint,
  updateProviderEndpoint,
  deleteProviderEndpoint,
  providerEndpointExists,
  clearAllCache,
  ProviderEndpointInput,
} from '../../../src/repositories/providerEndpoints.repo';

describe('ProviderEndpoints Repository - 集成测试', () => {
  // 测试用Provider端点
  const testProviderInput: ProviderEndpointInput = {
    provider_ref: 'test-provider-001',
    provider_name: '测试Provider',
    endpoint_url: 'https://api.example.com',
    credentials: {
      apiKey: 'super-secret-key-123',
      apiSecret: 'super-secret-456',
    },
    auth_type: 'api_key',
  };

  beforeAll(() => {
    // 确保测试环境有MASTER_KEY
    if (!process.env.MASTER_KEY) {
      const testKey = Buffer.from('test-master-key-32-bytes-long!').toString(
        'base64'
      );
      process.env.MASTER_KEY = testKey;
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    await db('provider_endpoints')
      .where('provider_ref', 'like', 'test-provider-%')
      .delete();

    // 清空缓存
    clearAllCache();
  });

  afterAll(async () => {
    // 清理所有测试数据
    await db('provider_endpoints')
      .where('provider_ref', 'like', 'test-provider-%')
      .delete();

    // 关闭数据库连接
    await db.destroy();
  });

  describe('创建Provider端点', () => {
    test('应该成功创建并加密存储凭证', async () => {
      const created = await createProviderEndpoint(testProviderInput);

      // 验证返回的数据
      expect(created.provider_ref).toBe(testProviderInput.provider_ref);
      expect(created.provider_name).toBe(testProviderInput.provider_name);
      expect(created.endpoint_url).toBe(testProviderInput.endpoint_url);
      expect(created.auth_type).toBe(testProviderInput.auth_type);

      // 艹，返回的凭证应该是解密后的对象
      expect(created.credentials_encrypted).toEqual(
        testProviderInput.credentials
      );

      // 验证数据库中存储的是加密数据
      const rawRow = await db('provider_endpoints')
        .where({ provider_ref: testProviderInput.provider_ref })
        .first();

      expect(rawRow).toBeDefined();
      // 艹，数据库中应该是加密的JSON字符串
      expect(typeof rawRow.credentials_encrypted).toBe('string');
      expect(rawRow.credentials_encrypted).toContain('ciphertext');
      expect(rawRow.credentials_encrypted).toContain('iv');
      expect(rawRow.credentials_encrypted).toContain('authTag');

      // 明文凭证不应该出现在数据库中
      expect(rawRow.credentials_encrypted).not.toContain('super-secret-key');
    });

    test('应该拒绝创建重复的provider_ref', async () => {
      await createProviderEndpoint(testProviderInput);

      // 尝试创建相同的provider_ref
      await expect(createProviderEndpoint(testProviderInput)).rejects.toThrow();
    });
  });

  describe('读取Provider端点', () => {
    test('应该成功读取并自动解密凭证', async () => {
      await createProviderEndpoint(testProviderInput);

      const retrieved = await getProviderEndpoint(
        testProviderInput.provider_ref
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved?.provider_ref).toBe(testProviderInput.provider_ref);
      expect(retrieved?.credentials_encrypted).toEqual(
        testProviderInput.credentials
      );
    });

    test('不存在的Provider应该返回null', async () => {
      const retrieved = await getProviderEndpoint('non-existent-provider');
      expect(retrieved).toBeNull();
    });

    test('缓存机制应该正常工作', async () => {
      await createProviderEndpoint(testProviderInput);

      // 第一次读取（从数据库）
      const first = await getProviderEndpoint(testProviderInput.provider_ref);
      expect(first).not.toBeNull();

      // 第二次读取（应该命中缓存）
      const second = await getProviderEndpoint(testProviderInput.provider_ref);
      expect(second).not.toBeNull();

      // 数据应该一致
      expect(second?.credentials_encrypted).toEqual(
        first?.credentials_encrypted
      );
    });

    test('useCache=false应该跳过缓存', async () => {
      await createProviderEndpoint(testProviderInput);

      // 先读一次让缓存生效
      await getProviderEndpoint(testProviderInput.provider_ref, true);

      // 强制从数据库读取
      const retrieved = await getProviderEndpoint(
        testProviderInput.provider_ref,
        false
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved?.credentials_encrypted).toEqual(
        testProviderInput.credentials
      );
    });
  });

  describe('更新Provider端点', () => {
    test('应该成功更新普通字段', async () => {
      await createProviderEndpoint(testProviderInput);

      const updated = await updateProviderEndpoint(
        testProviderInput.provider_ref,
        {
          provider_name: '更新后的名字',
          endpoint_url: 'https://new-api.example.com',
        }
      );

      expect(updated.provider_name).toBe('更新后的名字');
      expect(updated.endpoint_url).toBe('https://new-api.example.com');
      // 凭证不应该改变
      expect(updated.credentials_encrypted).toEqual(
        testProviderInput.credentials
      );
    });

    test('应该成功更新凭证并重新加密', async () => {
      await createProviderEndpoint(testProviderInput);

      const newCredentials = {
        apiKey: 'new-secret-key-789',
        apiSecret: 'new-secret-999',
      };

      const updated = await updateProviderEndpoint(
        testProviderInput.provider_ref,
        {
          credentials: newCredentials,
        }
      );

      expect(updated.credentials_encrypted).toEqual(newCredentials);

      // 验证数据库中存储的是新凭证的加密版本
      const rawRow = await db('provider_endpoints')
        .where({ provider_ref: testProviderInput.provider_ref })
        .first();

      expect(rawRow.credentials_encrypted).not.toContain('super-secret-key');
      expect(rawRow.credentials_encrypted).not.toContain('new-secret-key'); // 明文不应该出现
    });

    test('更新不存在的Provider应该抛出错误', async () => {
      await expect(
        updateProviderEndpoint('non-existent-provider', {
          provider_name: 'Test',
        })
      ).rejects.toThrow('Provider端点不存在');
    });

    test('更新后缓存应该被清除', async () => {
      await createProviderEndpoint(testProviderInput);

      // 先读一次让缓存生效
      await getProviderEndpoint(testProviderInput.provider_ref);

      // 更新
      await updateProviderEndpoint(testProviderInput.provider_ref, {
        provider_name: '更新后的名字',
      });

      // 再次读取应该从数据库读取（缓存已清除）
      const retrieved = await getProviderEndpoint(
        testProviderInput.provider_ref
      );
      expect(retrieved?.provider_name).toBe('更新后的名字');
    });
  });

  describe('删除Provider端点', () => {
    test('应该成功删除Provider', async () => {
      await createProviderEndpoint(testProviderInput);

      const result = await deleteProviderEndpoint(testProviderInput.provider_ref);
      expect(result).toBe(true);

      // 验证已删除
      const retrieved = await getProviderEndpoint(
        testProviderInput.provider_ref
      );
      expect(retrieved).toBeNull();
    });

    test('删除不存在的Provider应该返回false', async () => {
      const result = await deleteProviderEndpoint('non-existent-provider');
      expect(result).toBe(false);
    });

    test('删除后缓存应该被清除', async () => {
      await createProviderEndpoint(testProviderInput);

      // 先读一次让缓存生效
      await getProviderEndpoint(testProviderInput.provider_ref);

      // 删除
      await deleteProviderEndpoint(testProviderInput.provider_ref);

      // 再次读取应该返回null（缓存已清除）
      const retrieved = await getProviderEndpoint(
        testProviderInput.provider_ref
      );
      expect(retrieved).toBeNull();
    });
  });

  describe('检查Provider存在性', () => {
    test('存在的Provider应该返回true', async () => {
      await createProviderEndpoint(testProviderInput);

      const exists = await providerEndpointExists(
        testProviderInput.provider_ref
      );
      expect(exists).toBe(true);
    });

    test('不存在的Provider应该返回false', async () => {
      const exists = await providerEndpointExists('non-existent-provider');
      expect(exists).toBe(false);
    });
  });

  describe('数据安全性验证', () => {
    test('数据库中不应该存储明文凭证', async () => {
      const sensitiveData = {
        password: 'my-super-secret-password',
        apiKey: 'sk-1234567890abcdef',
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIICXAIBAAK...',
      };

      const input: ProviderEndpointInput = {
        ...testProviderInput,
        provider_ref: 'test-provider-security',
        credentials: sensitiveData,
      };

      await createProviderEndpoint(input);

      // 直接查询数据库
      const rawRow = await db('provider_endpoints')
        .where({ provider_ref: input.provider_ref })
        .first();

      // 艹，所有明文都不应该出现在数据库中！
      const encryptedStr = rawRow.credentials_encrypted;
      expect(encryptedStr).not.toContain('my-super-secret-password');
      expect(encryptedStr).not.toContain('sk-1234567890abcdef');
      expect(encryptedStr).not.toContain('BEGIN RSA PRIVATE KEY');

      // 但应该能正确解密
      const retrieved = await getProviderEndpoint(input.provider_ref);
      expect(retrieved?.credentials_encrypted).toEqual(sensitiveData);
    });

    test('篡改数据库中的加密数据应该导致解密失败', async () => {
      await createProviderEndpoint(testProviderInput);

      // 篡改数据库中的加密数据
      await db('provider_endpoints')
        .where({ provider_ref: testProviderInput.provider_ref })
        .update({
          credentials_encrypted: 'tampered-data-not-valid-json',
        });

      // 尝试读取应该返回原始（损坏的）数据或抛出错误
      const retrieved = await getProviderEndpoint(
        testProviderInput.provider_ref
      );

      // 艹，解密失败时应该保留原始数据（防止数据丢失）
      expect(retrieved?.credentials_encrypted).toBe('tampered-data-not-valid-json');
    });
  });

  describe('完整CRUD流程', () => {
    test('应该完整执行创建-读取-更新-删除流程', async () => {
      // 1. 创建
      const created = await createProviderEndpoint({
        provider_ref: 'test-provider-crud',
        provider_name: 'CRUD测试Provider',
        endpoint_url: 'https://crud-test.example.com',
        credentials: { key: 'value1' },
        auth_type: 'bearer',
      });

      expect(created.provider_ref).toBe('test-provider-crud');
      expect(created.credentials_encrypted).toEqual({ key: 'value1' });

      // 2. 读取
      const retrieved = await getProviderEndpoint('test-provider-crud');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.provider_name).toBe('CRUD测试Provider');

      // 3. 更新
      const updated = await updateProviderEndpoint('test-provider-crud', {
        provider_name: 'CRUD测试Provider（已更新）',
        credentials: { key: 'value2' },
      });

      expect(updated.provider_name).toBe('CRUD测试Provider（已更新）');
      expect(updated.credentials_encrypted).toEqual({ key: 'value2' });

      // 4. 验证更新
      const retrievedAfterUpdate = await getProviderEndpoint(
        'test-provider-crud'
      );
      expect(retrievedAfterUpdate?.credentials_encrypted).toEqual({
        key: 'value2',
      });

      // 5. 删除
      const deleted = await deleteProviderEndpoint('test-provider-crud');
      expect(deleted).toBe(true);

      // 6. 验证删除
      const retrievedAfterDelete = await getProviderEndpoint(
        'test-provider-crud'
      );
      expect(retrievedAfterDelete).toBeNull();

      const existsAfterDelete = await providerEndpointExists(
        'test-provider-crud'
      );
      expect(existsAfterDelete).toBe(false);
    });
  });
});
