/**
 * 凭证加密工具（AES-256-GCM）
 * 艹，这个tm必须安全！明文凭证绝不落库！
 *
 * 功能：
 * - AES-256-GCM加密/解密
 * - 密钥版本管理与轮换
 * - 篡改检测（GCM自带认证）
 * - 随机IV（每次加密都不同）
 */

import crypto from 'crypto';

/**
 * 加密算法配置
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM推荐12字节IV
const AUTH_TAG_LENGTH = 16; // GCM认证标签16字节
const KEY_LENGTH = 32; // AES-256需要32字节key

/**
 * 密钥版本配置
 * 艹，支持密钥轮换，旧密钥保留用于解密历史数据
 */
interface KeyVersion {
  version: number;
  key: Buffer;
  createdAt: Date;
}

/**
 * 加密结果
 */
export interface EncryptedData {
  /** 密文（Base64编码） */
  ciphertext: string;
  /** 初始化向量（Base64编码） */
  iv: string;
  /** 认证标签（Base64编码） */
  authTag: string;
  /** 密钥版本号 */
  keyVersion: number;
}

/**
 * 密钥管理器
 * 艹，这个类管理所有密钥版本
 */
class KeyManager {
  private keys: Map<number, KeyVersion> = new Map();
  private currentVersion: number = 1;

  constructor() {
    // 从环境变量读取主密钥
    this.loadMasterKey();
  }

  /**
   * 从环境变量加载主密钥
   * 格式：MASTER_KEY=base64编码的32字节密钥
   */
  private loadMasterKey(): void {
    const masterKeyEnv = process.env.MASTER_KEY;

    if (!masterKeyEnv) {
      // 艹，开发环境生成临时密钥（生产环境必须配置！）
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          '生产环境必须配置MASTER_KEY环境变量！这tm是安全红线！'
        );
      }

      console.warn(
        '[CRYPTO] 警告：未配置MASTER_KEY，使用临时密钥（仅用于开发）'
      );
      const tempKey = crypto.randomBytes(KEY_LENGTH);
      this.addKey(1, tempKey);
      return;
    }

    try {
      // 解析Base64编码的密钥
      const keyBuffer = Buffer.from(masterKeyEnv, 'base64');

      if (keyBuffer.length !== KEY_LENGTH) {
        throw new Error(
          `MASTER_KEY长度错误：期望${KEY_LENGTH}字节，实际${keyBuffer.length}字节`
        );
      }

      this.addKey(1, keyBuffer);
      console.log('[CRYPTO] 主密钥加载成功 (版本: 1)');
    } catch (error: any) {
      throw new Error(`加载MASTER_KEY失败: ${error.message}`);
    }
  }

  /**
   * 添加密钥版本
   * @param version - 版本号
   * @param key - 密钥Buffer
   */
  public addKey(version: number, key: Buffer): void {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`密钥长度必须是${KEY_LENGTH}字节`);
    }

    this.keys.set(version, {
      version,
      key,
      createdAt: new Date(),
    });

    // 更新当前版本
    if (version > this.currentVersion) {
      this.currentVersion = version;
    }
  }

  /**
   * 获取当前密钥
   */
  public getCurrentKey(): { version: number; key: Buffer } {
    const keyVersion = this.keys.get(this.currentVersion);
    if (!keyVersion) {
      throw new Error('当前密钥不存在！这tm不应该发生！');
    }
    return { version: keyVersion.version, key: keyVersion.key };
  }

  /**
   * 根据版本号获取密钥
   * @param version - 版本号
   */
  public getKey(version: number): Buffer {
    const keyVersion = this.keys.get(version);
    if (!keyVersion) {
      throw new Error(`密钥版本${version}不存在！可能需要配置历史密钥`);
    }
    return keyVersion.key;
  }

  /**
   * 获取所有密钥版本列表
   */
  public getVersions(): number[] {
    return Array.from(this.keys.keys()).sort((a, b) => b - a);
  }
}

// 全局密钥管理器实例
const keyManager = new KeyManager();

/**
 * 加密数据
 * @param plaintext - 明文（字符串或对象）
 * @param keyVersion - 密钥版本（可选，默认使用当前版本）
 * @returns EncryptedData - 加密结果
 */
export function encrypt(
  plaintext: string | object,
  keyVersion?: number
): EncryptedData {
  // 转换为字符串
  const plaintextStr =
    typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);

  // 获取密钥
  const { version, key } =
    keyVersion !== undefined
      ? { version: keyVersion, key: keyManager.getKey(keyVersion) }
      : keyManager.getCurrentKey();

  // 生成随机IV（艹，每次加密都不同，增强安全性）
  const iv = crypto.randomBytes(IV_LENGTH);

  // 创建加密器
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // 加密
  let ciphertext = cipher.update(plaintextStr, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  // 获取认证标签（GCM模式）
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyVersion: version,
  };
}

/**
 * 解密数据
 * @param encryptedData - 加密数据
 * @returns string - 明文
 * @throws Error - 解密失败或数据被篡改
 */
export function decrypt(encryptedData: EncryptedData): string {
  const { ciphertext, iv, authTag, keyVersion } = encryptedData;

  // 获取对应版本的密钥
  let key: Buffer;
  try {
    key = keyManager.getKey(keyVersion);
  } catch (error: any) {
    throw new Error(
      `解密失败：密钥版本${keyVersion}不存在。${error.message}`
    );
  }

  // 转换Base64为Buffer
  const ivBuffer = Buffer.from(iv, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');

  // 创建解密器
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);

  // 设置认证标签（艹，这个tm很重要，用于验证数据完整性）
  decipher.setAuthTag(authTagBuffer);

  try {
    // 解密
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch (error: any) {
    // 艹，GCM解密失败通常意味着数据被篡改或密钥错误
    throw new Error(
      `解密失败：数据可能被篡改或密钥错误。${error.message}`
    );
  }
}

/**
 * 加密对象中的敏感字段
 * @param obj - 原始对象
 * @param sensitiveFields - 敏感字段列表（白名单）
 * @returns 加密后的对象
 */
export function encryptFields(
  obj: Record<string, any>,
  sensitiveFields: string[]
): Record<string, any> {
  const result: Record<string, any> = { ...obj };

  for (const field of sensitiveFields) {
    if (obj[field] !== undefined && obj[field] !== null) {
      // 加密该字段
      const encrypted = encrypt(obj[field]);

      // 存储为JSON字符串（方便数据库存储）
      result[field] = JSON.stringify(encrypted);
    }
  }

  return result;
}

/**
 * 解密对象中的敏感字段
 * @param obj - 加密后的对象
 * @param sensitiveFields - 敏感字段列表
 * @returns 解密后的对象
 */
export function decryptFields(
  obj: Record<string, any>,
  sensitiveFields: string[]
): Record<string, any> {
  const result: Record<string, any> = { ...obj };

  for (const field of sensitiveFields) {
    if (obj[field] !== undefined && obj[field] !== null) {
      try {
        // 解析JSON并解密
        const encryptedData: EncryptedData =
          typeof obj[field] === 'string'
            ? JSON.parse(obj[field])
            : obj[field];

        result[field] = decrypt(encryptedData);

        // 尝试解析为JSON对象（如果原始数据是对象）
        try {
          result[field] = JSON.parse(result[field]);
        } catch {
          // 不是JSON，保持字符串
        }
      } catch (error: any) {
        console.error(
          `[CRYPTO] 解密字段"${field}"失败: ${error.message}`
        );
        // 保留加密数据（不要丢失）
        result[field] = obj[field];
      }
    }
  }

  return result;
}

/**
 * 生成新的主密钥（用于密钥轮换）
 * 艹，生产环境慎用！需要配合数据迁移！
 * @returns Base64编码的密钥
 */
export function generateMasterKey(): string {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('base64');
}

/**
 * 添加新密钥版本（用于密钥轮换）
 * @param version - 版本号
 * @param keyBase64 - Base64编码的密钥
 */
export function addKeyVersion(version: number, keyBase64: string): void {
  const key = Buffer.from(keyBase64, 'base64');
  keyManager.addKey(version, key);
}

/**
 * 获取当前密钥版本号
 */
export function getCurrentKeyVersion(): number {
  return keyManager.getCurrentKey().version;
}

/**
 * 获取所有可用密钥版本
 */
export function getAvailableKeyVersions(): number[] {
  return keyManager.getVersions();
}

/**
 * 重新加密数据（用于密钥轮换）
 * @param encryptedData - 旧密钥加密的数据
 * @param newKeyVersion - 新密钥版本（可选，默认使用当前版本）
 * @returns EncryptedData - 新密钥加密的数据
 */
export function reencrypt(
  encryptedData: EncryptedData,
  newKeyVersion?: number
): EncryptedData {
  // 1. 用旧密钥解密
  const plaintext = decrypt(encryptedData);

  // 2. 用新密钥加密
  return encrypt(plaintext, newKeyVersion);
}
