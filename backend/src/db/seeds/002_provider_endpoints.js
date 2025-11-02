/**
 * Seed: provider_endpoints 表数据
 * 初始化内部云函数服务的端点信息
 *
 * 说明：
 * 1. provider_ref: 服务标识符（唯一）
 * 2. endpoint_url: 从环境变量读取（部署后配置）
 * 3. credentials_encrypted: 使用 AES-256-CBC 加密存储
 * 4. auth_type: HMAC 签名验证
 */

const crypto = require('crypto');

/**
 * 加密敏感信息（AES-256-CBC）
 * @param {string} text - 明文
 * @returns {string} 加密后的文本（格式: iv:encrypted）
 */
function encrypt(text) {
  if (!text) {
    return null;
  }

  const algorithm = 'aes-256-cbc';

  // 从环境变量获取加密密钥（32字节hex）
  const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('缺少环境变量 CREDENTIALS_ENCRYPTION_KEY（用于加密 provider_endpoints 凭证）');
  }

  // 如果是普通字符串(不是hex),转换为sha256 hash后取前32字节
  let key;
  if (encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
    // 已经是64位hex格式
    key = Buffer.from(encryptionKey, 'hex');
  } else {
    // 普通字符串,使用sha256派生32字节密钥
    key = crypto.createHash('sha256').update(encryptionKey).digest();
  }

  if (key.length !== 32) {
    throw new Error('派生的加密密钥长度不正确');
  }

  // 生成随机 IV（16字节）
  const iv = crypto.randomBytes(16);

  // 创建加密器
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  // 加密数据
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 返回格式: iv:encrypted（都是 hex）
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * 解密敏感信息（AES-256-CBC）
 * @param {string} encryptedText - 加密文本（格式: iv:encrypted）
 * @returns {string} 明文
 */
function decrypt(encryptedText) {
  if (!encryptedText) {
    return null;
  }

  const algorithm = 'aes-256-cbc';
  const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('缺少环境变量 CREDENTIALS_ENCRYPTION_KEY');
  }

  // 如果是普通字符串(不是hex),转换为sha256 hash后取前32字节
  let key;
  if (encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
    // 已经是64位hex格式
    key = Buffer.from(encryptionKey, 'hex');
  } else {
    // 普通字符串,使用sha256派生32字节密钥
    key = crypto.createHash('sha256').update(encryptionKey).digest();
  }

  // 分离 IV 和加密数据
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = encryptedHex;

  // 创建解密器
  const decipher = crypto.createDecipheriv(algorithm, key, iv);

  // 解密数据
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Seed 数据
 */
exports.seed = async function(knex) {
  // 检查必要的环境变量
  const requiredEnvVars = [
    'INTERNAL_CALLBACK_SECRET',
    'SCF_VIDEO_COMPOSITOR_URL',
    'SCF_IMAGE_COMPOSITOR_URL',
    'SCF_TEXT_PROCESSOR_URL',
    'CREDENTIALS_ENCRYPTION_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn('⚠️  警告：缺少以下环境变量，将使用占位符：');
    missingVars.forEach(varName => console.warn(`   - ${varName}`));
    console.warn('');
    console.warn('请在部署云函数后，配置这些环境变量，然后重新运行 seed');
    console.warn('');
  }

  // 清空现有数据（谨慎操作）
  await knex('provider_endpoints').del();

  // 插入内部云函数服务端点
  const endpoints = [
    {
      provider_ref: 'internal_scf_video_compositor',
      provider_name: '内部视频合成服务',
      endpoint_url: process.env.SCF_VIDEO_COMPOSITOR_URL || 'https://placeholder-video-compositor.example.com',
      credentials_encrypted: encrypt(process.env.INTERNAL_CALLBACK_SECRET || 'placeholder-secret'),
      auth_type: 'hmac',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      provider_ref: 'internal_scf_image_compositor',
      provider_name: '内部图片拼接服务',
      endpoint_url: process.env.SCF_IMAGE_COMPOSITOR_URL || 'https://placeholder-image-compositor.example.com',
      credentials_encrypted: encrypt(process.env.INTERNAL_CALLBACK_SECRET || 'placeholder-secret'),
      auth_type: 'hmac',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      provider_ref: 'internal_scf_text_processor',
      provider_name: '内部文案处理服务',
      endpoint_url: process.env.SCF_TEXT_PROCESSOR_URL || 'https://placeholder-text-processor.example.com',
      credentials_encrypted: encrypt(process.env.INTERNAL_CALLBACK_SECRET || 'placeholder-secret'),
      auth_type: 'hmac',
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  await knex('provider_endpoints').insert(endpoints);

  console.log('✅ provider_endpoints 表数据初始化完成');
  console.log('');
  console.log('已插入的服务：');
  endpoints.forEach(ep => {
    const status = ep.is_active ? '✅ 激活' : '⚠️  未激活（占位符）';
    console.log(`  ${status} - ${ep.provider_name} (${ep.provider_ref})`);
  });
  console.log('');

  if (missingVars.length > 0) {
    console.log('⚠️  部分服务使用占位符URL，请在部署云函数后更新数据库：');
    console.log('');
    console.log('  UPDATE provider_endpoints SET');
    console.log('    endpoint_url = \'<实际云函数URL>\',');
    console.log('    is_active = true,');
    console.log('    updated_at = NOW()');
    console.log('  WHERE provider_ref = \'internal_scf_xxx\';');
    console.log('');
  }
};

// 导出加密/解密函数供其他模块使用
exports.encrypt = encrypt;
exports.decrypt = decrypt;
