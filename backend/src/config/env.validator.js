/**
 * 环境变量验证和强制检查
 * 在服务启动前验证所有必要的环境变量是否已配置
 */

/**
 * 必需的环境变量列表
 * 如果这些变量没有配置，服务将无法启动
 *
 * 注意：API密钥相关变量现在是可选的，因为可以通过动态配置设置
 */
const REQUIRED_ENV_VARS = [
  // 数据库配置（必需）
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',

  // JWT配置（必需）
  'JWT_SECRET',

  // 腾讯云COS基础配置（必需，但密钥可通过动态配置设置）
  'COS_BUCKET',
  'COS_REGION'
];

/**
 * 可选的环境变量列表（有默认值）
 *
 * 注意：API密钥现在是可选的，可以通过动态配置系统设置
 */
const OPTIONAL_ENV_VARS = {
  // 服务器配置
  'PORT': '3000',
  'NODE_ENV': 'development',

  // JWT配置
  'JWT_EXPIRE': '7d',

  // 业务配置
  'PLAN_MONTHLY_QUOTA': '100',
  'QUOTA_COST_BASIC_CLEAN': '1',
  'QUOTA_COST_MODEL_POSE12': '1',
  'QUOTA_COST_VIDEO_GENERATE': '5',

  // 日志和性能配置
  'LOG_LEVEL': 'info',
  'RATE_LIMIT_WINDOW_MS': '60000',
  'RATE_LIMIT_MAX_REQUESTS': '100',
  'DATABASE_POOL_MIN': '5',
  'DATABASE_POOL_MAX': '20',

  // API密钥（可选，可通过动态配置设置）
  'TENCENT_SECRET_ID': '',
  'TENCENT_SECRET_KEY': '',
  'HUNYUAN_API_KEY': '',
  'HUNYUAN_API_SECRET': '',
  'KUAI_API_KEY': '',
  'RUNNINGHUB_API_KEY': ''
};

/**
 * 验证环境变量
 * @returns {Object} 验证结果
 */
function validateEnvironment() {
  const missing = [];
  const warnings = [];

  // 检查必需的环境变量
  REQUIRED_ENV_VARS.forEach(envVar => {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  });

  // 检查敏感配置的默认值
  const sensitiveDefaults = [
    'your_random_secret_key_change_this_in_production_min_32_chars',
    'your_tencent_secret_id_here',
    'your_tencent_secret_key_here',
    'your_database_password_here'
  ];

  Object.keys(process.env).forEach(key => {
    if (sensitiveDefaults.includes(process.env[key])) {
      warnings.push(`环境变量 ${key} 使用了默认值，请修改为实际配置`);
    }
  });

  // 检查JWT密钥长度
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET 长度建议至少32个字符以保证安全性');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    message: missing.length > 0
      ? `缺少必需的环境变量: ${missing.join(', ')}`
      : '环境变量验证通过'
  };
}

/**
 * 设置默认环境变量
 */
function setDefaults() {
  Object.entries(OPTIONAL_ENV_VARS).forEach(([key, defaultValue]) => {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
    }
  });
}

/**
 * 打印环境变量状态
 */
function printEnvironmentStatus() {
  const validation = validateEnvironment();

  console.log('🔧 环境变量检查结果:');
  console.log('='.repeat(50));

  if (validation.isValid) {
    console.log('✅ 所有必需的环境变量已配置');
  } else {
    console.log('❌', validation.message);
    validation.missing.forEach(envVar => {
      console.log(`   - ${envVar}`);
    });
  }

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  警告:');
    validation.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
  }

  console.log('='.repeat(50));

  return validation;
}

/**
 * 启动时环境变量检查
 * 如果验证失败，抛出异常阻止服务启动
 */
function checkEnvironmentOnStart() {
  // 设置默认值
  setDefaults();

  // 验证环境变量
  const validation = validateEnvironment();

  // 打印状态
  printEnvironmentStatus();

  // 如果有缺失的必需变量，阻止启动
  if (!validation.isValid) {
    const error = new Error('环境变量验证失败，服务无法启动');
    error.code = 'ENV_VALIDATION_ERROR';
    error.details = validation.missing;
    throw error;
  }

  // 如果有警告，在开发环境中提醒
  if (validation.warnings.length > 0 && process.env.NODE_ENV === 'development') {
    console.log('\n💡 提示: 请在生产环境部署前解决所有警告项');
  }
}

module.exports = {
  validateEnvironment,
  setDefaults,
  printEnvironmentStatus,
  checkEnvironmentOnStart,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS
};