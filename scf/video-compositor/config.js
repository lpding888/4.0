/**
 * 视频合成云函数配置
 * 所有敏感信息从环境变量读取，严格遵守安全规范
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

  // FFmpeg 配置
  ffmpeg: {
    // 在腾讯云SCF环境中，FFmpeg在Layer中提供
    binaryPath: process.env.FFMPEG_PATH || '/opt/bin/ffmpeg'
  },

  // 视频处理参数
  video: {
    // 转场效果
    transition: {
      type: 'fade',
      duration: 1 // 秒
    },
    // 输出视频参数
    output: {
      codec: 'libx264',
      videoBitrate: '2000k',
      audioBitrate: '128k',
      format: 'mp4',
      fps: 30
    }
  },

  // 字幕配置
  subtitle: {
    defaultFontSize: 48,
    defaultFontColor: '#FFFFFF',
    defaultBackgroundColor: 'rgba(0,0,0,0.5)',
    fontPath: '/opt/fonts/SourceHanSansCN-Regular.otf' // 思源黑体
  },

  // Logo水印配置
  logo: {
    defaultPosition: 'top-right',
    defaultScale: 0.15,
    defaultOpacity: 0.8
  },

  // 临时文件路径
  tmpDir: '/tmp'
};
