/**
 * 字幕叠加器
 * 使用 FFmpeg drawtext 滤镜在视频上添加字幕
 */

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const logger = require('../../common/logger');

/**
 * 在视频上叠加字幕
 * @param {string} inputPath - 输入视频路径
 * @param {Object} options - 字幕选项
 * @param {string} options.text - 字幕文本（支持 \n 换行）
 * @param {string} options.position - 位置: top | center | bottom
 * @param {number} options.fontSize - 字体大小（默认48）
 * @param {string} options.fontColor - 字体颜色（默认白色）
 * @param {string} options.backgroundColor - 背景颜色（默认半透明黑色）
 * @param {string} options.fontPath - 字体文件路径
 * @param {string} options.outputPath - 输出文件路径
 * @param {string} ffmpegPath - FFmpeg 可执行文件路径
 * @returns {Promise<string>} 输出文件路径
 */
async function add(inputPath, options, ffmpegPath = '/opt/bin/ffmpeg') {
  const {
    text,
    position = 'bottom',
    fontSize = 48,
    fontColor = '#FFFFFF',
    backgroundColor = 'rgba(0,0,0,0.5)',
    fontPath = '/opt/fonts/SourceHanSansCN-Regular.otf',
    outputPath
  } = options;

  if (!text) {
    throw new Error('字幕文本不能为空');
  }

  try {
    logger.info('开始添加字幕', {
      text,
      position,
      fontSize,
      outputPath
    });

    // 设置 FFmpeg 路径
    ffmpeg.setFfmpegPath(ffmpegPath);

    // 计算字幕位置
    let yPosition;
    switch (position) {
      case 'top':
        yPosition = 'h*0.1'; // 顶部 10%
        break;
      case 'center':
        yPosition = '(h-text_h)/2'; // 居中
        break;
      case 'bottom':
      default:
        yPosition = 'h*0.85'; // 底部 85%
        break;
    }

    // 转义特殊字符
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:');

    // 构建 drawtext 滤镜
    // 背景框：使用 box 参数
    const drawtextFilter = [
      `drawtext=text='${escapedText}'`,
      `fontfile=${fontPath}`,
      `fontsize=${fontSize}`,
      `fontcolor=${fontColor}`,
      `x=(w-text_w)/2`, // 水平居中
      `y=${yPosition}`,
      `box=1`,
      `boxcolor=${backgroundColor}`,
      `boxborderw=10`
    ].join(':');

    // 执行 FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-vf', drawtextFilter,
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'copy' // 音频不重新编码
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.debug('FFmpeg命令', { commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('字幕添加进度', {
            percent: progress.percent,
            timemark: progress.timemark
          });
        })
        .on('end', () => {
          logger.info('字幕添加完成', { outputPath });
          resolve(outputPath);
        })
        .on('error', (error) => {
          logger.error('字幕添加失败', { error: error.message });
          reject(error);
        })
        .run();
    });

    return outputPath;

  } catch (error) {
    logger.error('字幕叠加异常', { error: error.message });
    throw new Error(`字幕叠加失败: ${error.message}`);
  }
}

module.exports = { add };
