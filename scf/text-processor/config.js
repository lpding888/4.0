/**
 * 文本处理云函数配置
 */

module.exports = {
  // COS 配置
  cos: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
    bucket: process.env.COS_BUCKET,
    region: process.env.COS_REGION || 'ap-guangzhou'
  },

  // 后端回调配置
  callback: {
    apiUrl: process.env.BACKEND_API_URL,
    secret: process.env.INTERNAL_CALLBACK_SECRET
  },

  // 模板配置
  templates: {
    basePath: './templates'
  },

  // 临时文件路径
  tmpDir: '/tmp'
};
