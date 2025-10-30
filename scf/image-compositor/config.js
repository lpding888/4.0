/**
 * 图片拼接云函数配置
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

  // 图片处理参数
  image: {
    // 默认单张图片尺寸
    defaultImageWidth: 512,
    defaultImageHeight: 512,
    // 默认间距
    defaultSpacing: 10,
    // 默认背景色
    defaultBackgroundColor: '#F5F5F5',
    // 输出质量
    outputQuality: 90,
    // 输出格式
    outputFormat: 'jpeg'
  },

  // 支持的布局
  layouts: {
    '2x2': { rows: 2, cols: 2 },
    '3x3': { rows: 3, cols: 3 },
    '3x4': { rows: 3, cols: 4 },
    '4x3': { rows: 4, cols: 3 },
    '4x4': { rows: 4, cols: 4 }
  },

  // 临时文件路径
  tmpDir: '/tmp'
};
