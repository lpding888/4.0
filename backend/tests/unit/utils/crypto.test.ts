/**
 * Crypto工具单元测试
 * 艹，加密必须万无一失！
 * 测试覆盖：加解密/篡改检测/错误key/密钥轮换
 */

import {
  encrypt,
  decrypt,
  encryptFields,
  decryptFields,
  generateMasterKey,
  addKeyVersion,
  getCurrentKeyVersion,
  reencrypt,
  EncryptedData,
} from '../../../src/utils/crypto';

describe('Crypto Utils - 单元测试', () => {
  // 保存原始环境变量
  const originalMasterKey = process.env.MASTER_KEY;

  beforeAll(() => {
    // 设置测试用密钥（Base64编码的32字节）
    const testKey = Buffer.from('test-master-key-32-bytes-long!').toString(
      'base64'
    );
    process.env.MASTER_KEY = testKey;
  });

  afterAll(() => {
    // 恢复原始环境变量
    if (originalMasterKey) {
      process.env.MASTER_KEY = originalMasterKey;
    } else {
      delete process.env.MASTER_KEY;
    }
  });

  describe('基本加解密', () => {
    test('应该成功加密和解密字符串', () => {
      const plaintext = '这是老王的秘密';
      const encrypted = encrypt(plaintext);

      // 加密结果应该包含必要字段
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('keyVersion');

      // 密文不应该等于明文
      expect(encrypted.ciphertext).not.toBe(plaintext);

      // 解密应该还原明文
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('应该成功加密和解密对象', () => {
      const plainObj = {
        username: '老王',
        password: 'super-secret-123',
        apiKey: 'sk-xxx-yyy-zzz',
      };

      const encrypted = encrypt(plainObj);
      const decrypted = decrypt(encrypted);

      // 解密后应该还原为JSON字符串
      const decryptedObj = JSON.parse(decrypted);
      expect(decryptedObj).toEqual(plainObj);
    });

    test('每次加密应该产生不同的密文（随机IV）', () => {
      const plaintext = '相同的明文';

      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // 艹，IV不同导致密文不同（即使明文相同）
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

      // 但解密后应该相同
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    test('应该处理空字符串', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('应该处理长文本', () => {
      const plaintext = 'A'.repeat(10000); // 10KB文本
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test('应该处理特殊字符', () => {
      const plaintext = '艹！这tm有\n换行\t制表符和😀emoji';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('篡改检测', () => {
    test('篡改密文应该导致解密失败', () => {
      const plaintext = '重要数据';
      const encrypted = encrypt(plaintext);

      // 篡改密文
      const tampered: EncryptedData = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -1) + 'X', // 修改最后一个字符
      };

      // 艹，解密应该失败
      expect(() => decrypt(tampered)).toThrow('解密失败');
      expect(() => decrypt(tampered)).toThrow('篡改');
    });

    test('篡改IV应该导致解密失败', () => {
      const plaintext = '重要数据';
      const encrypted = encrypt(plaintext);

      // 篡改IV
      const tampered: EncryptedData = {
        ...encrypted,
        iv: Buffer.from('tampered-iv-1234').toString('base64'),
      };

      expect(() => decrypt(tampered)).toThrow();
    });

    test('篡改authTag应该导致解密失败', () => {
      const plaintext = '重要数据';
      const encrypted = encrypt(plaintext);

      // 篡改authTag
      const tampered: EncryptedData = {
        ...encrypted,
        authTag: Buffer.from('tampered-auth-tag').toString('base64'),
      };

      // 艹，GCM应该检测到authTag不匹配
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe('错误密钥', () => {
    test('使用不存在的密钥版本应该失败', () => {
      const plaintext = '测试数据';
      const encrypted = encrypt(plaintext);

      // 修改为不存在的密钥版本
      const invalidVersion: EncryptedData = {
        ...encrypted,
        keyVersion: 9999,
      };

      expect(() => decrypt(invalidVersion)).toThrow('密钥版本9999不存在');
    });

    test('使用错误的密钥版本应该解密失败', () => {
      // 添加第二个密钥版本
      const newKey = generateMasterKey();
      addKeyVersion(2, newKey);

      // 用密钥版本1加密
      const plaintext = '测试数据';
      const encrypted = encrypt(plaintext, 1);

      // 尝试用密钥版本2解密（错误的密钥）
      const wrongKey: EncryptedData = {
        ...encrypted,
        keyVersion: 2,
      };

      expect(() => decrypt(wrongKey)).toThrow();
    });
  });

  describe('密钥版本管理', () => {
    test('应该返回当前密钥版本', () => {
      const version = getCurrentKeyVersion();
      expect(typeof version).toBe('number');
      expect(version).toBeGreaterThan(0);
    });

    test('应该支持添加新密钥版本', () => {
      const newKey = generateMasterKey();
      addKeyVersion(10, newKey);

      // 用新密钥加密
      const plaintext = '新密钥测试';
      const encrypted = encrypt(plaintext, 10);

      expect(encrypted.keyVersion).toBe(10);

      // 解密应该成功
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('生成的主密钥应该是有效的Base64', () => {
      const newKey = generateMasterKey();

      // 应该能解码为32字节Buffer
      const keyBuffer = Buffer.from(newKey, 'base64');
      expect(keyBuffer.length).toBe(32);
    });
  });

  describe('密钥轮换', () => {
    test('应该能用新密钥重新加密数据', () => {
      // 添加新密钥版本
      const newKey = generateMasterKey();
      addKeyVersion(20, newKey);

      // 用旧密钥加密
      const plaintext = '需要轮换的数据';
      const oldEncrypted = encrypt(plaintext, 1);

      expect(oldEncrypted.keyVersion).toBe(1);

      // 重新加密到新密钥
      const newEncrypted = reencrypt(oldEncrypted, 20);

      expect(newEncrypted.keyVersion).toBe(20);
      expect(newEncrypted.ciphertext).not.toBe(oldEncrypted.ciphertext);

      // 用新密钥解密应该成功
      const decrypted = decrypt(newEncrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('重新加密应该保持数据完整性', () => {
      const newKey = generateMasterKey();
      addKeyVersion(21, newKey);

      const plainObj = {
        username: '老王',
        password: 'secret-123',
        metadata: { role: 'admin', level: 5 },
      };

      // 用旧密钥加密
      const oldEncrypted = encrypt(plainObj, 1);

      // 重新加密
      const newEncrypted = reencrypt(oldEncrypted, 21);

      // 解密并验证
      const decrypted = JSON.parse(decrypt(newEncrypted));
      expect(decrypted).toEqual(plainObj);
    });
  });

  describe('字段级加密', () => {
    test('应该加密对象中的敏感字段', () => {
      const obj = {
        id: 123,
        name: '老王',
        password: 'super-secret',
        apiKey: 'sk-xxx-yyy',
        email: 'laowang@example.com',
      };

      const sensitiveFields = ['password', 'apiKey'];
      const encrypted = encryptFields(obj, sensitiveFields);

      // 非敏感字段应该保持不变
      expect(encrypted.id).toBe(obj.id);
      expect(encrypted.name).toBe(obj.name);
      expect(encrypted.email).toBe(obj.email);

      // 敏感字段应该被加密（变成JSON字符串）
      expect(encrypted.password).not.toBe(obj.password);
      expect(typeof encrypted.password).toBe('string');
      expect(encrypted.password).toContain('ciphertext');

      expect(encrypted.apiKey).not.toBe(obj.apiKey);
      expect(typeof encrypted.apiKey).toBe('string');
    });

    test('应该解密对象中的敏感字段', () => {
      const obj = {
        id: 123,
        name: '老王',
        password: 'super-secret',
        apiKey: 'sk-xxx-yyy',
      };

      const sensitiveFields = ['password', 'apiKey'];

      // 加密
      const encrypted = encryptFields(obj, sensitiveFields);

      // 解密
      const decrypted = decryptFields(encrypted, sensitiveFields);

      // 应该完全还原
      expect(decrypted).toEqual(obj);
    });

    test('应该处理不存在的敏感字段', () => {
      const obj = {
        id: 123,
        name: '老王',
      };

      const sensitiveFields = ['password', 'apiKey']; // 这些字段不存在

      const encrypted = encryptFields(obj, sensitiveFields);
      const decrypted = decryptFields(encrypted, sensitiveFields);

      // 应该不报错，原样返回
      expect(decrypted).toEqual(obj);
    });

    test('应该处理null和undefined字段', () => {
      const obj = {
        id: 123,
        password: null,
        apiKey: undefined,
      };

      const sensitiveFields = ['password', 'apiKey'];

      const encrypted = encryptFields(obj, sensitiveFields);
      const decrypted = decryptFields(encrypted, sensitiveFields);

      expect(decrypted.password).toBeNull();
      expect(decrypted.apiKey).toBeUndefined();
    });

    test('应该处理对象类型的敏感字段', () => {
      const obj = {
        id: 123,
        credentials: {
          username: '老王',
          password: 'secret',
          apiKey: 'sk-xxx',
        },
      };

      const sensitiveFields = ['credentials'];

      const encrypted = encryptFields(obj, sensitiveFields);
      const decrypted = decryptFields(encrypted, sensitiveFields);

      // 艹，对象应该完整还原
      expect(decrypted.credentials).toEqual(obj.credentials);
    });
  });

  describe('边界情况', () => {
    test('应该处理超长字段名', () => {
      const longFieldName = 'a'.repeat(1000);
      const obj = {
        [longFieldName]: 'value',
      };

      const encrypted = encryptFields(obj, [longFieldName]);
      const decrypted = decryptFields(encrypted, [longFieldName]);

      expect(decrypted[longFieldName]).toBe('value');
    });

    test('解密损坏的加密数据应该优雅失败', () => {
      const obj = {
        password: 'invalid-encrypted-data-not-json',
      };

      const sensitiveFields = ['password'];

      // 直接解密应该失败，但不崩溃
      const decrypted = decryptFields(obj, sensitiveFields);

      // 应该保留原始（损坏的）数据
      expect(decrypted.password).toBe(obj.password);
    });

    test('空敏感字段列表应该不加密任何字段', () => {
      const obj = {
        password: 'secret',
        apiKey: 'sk-xxx',
      };

      const encrypted = encryptFields(obj, []);
      expect(encrypted).toEqual(obj);
    });
  });
});
