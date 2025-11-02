/**
 * Logo 水印添加器
 * 使用 FFmpeg overlay 滤镜在视频上添加 Logo 水印
 */

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const logger = require('../../common/logger');
const { downloadFile } = require('../../common/fileDownloader');

/**
 * 在视频上添加 Logo 水印
 * @param {string} inputPath - 输入视频路径
 * @param {Object} options - 水印选项
 * @param {string} options.logoUrl - Logo 图片URL
 * @param {string} options.position - 位置: top-left | top-right | bottom-left | bottom-right | center
 * @param {number} options.scale - 缩放比例（相对于视频宽度，默认0.15）
 * @param {number} options.opacity - 透明度（0-1，默认0.8）
 * @param {string} options.outputPath - 输出文件路径
 * @param {string} ffmpegPath - FFmpeg 可执行文件路径
 * @returns {Promise<string>} 输出文件路径
 */
async function add(inputPath, options, ffmpegPath = '/opt/bin/ffmpeg') {
  const {
    logoUrl,
    position = 'top-right',
    scale = 0.15,
    opacity = 0.8,
    outputPath
  } = options;

  if (!logoUrl) {
    throw new Error('Logo URL 不能为空');
  }

  let logoPath;

  try {
    logger.info('开始添加Logo水印', {
      logoUrl,
      position,
      scale,
      opacity,
      outputPath
    });

    // 1. 下载 Logo 图片
    const logoFilename = `logo_${Date.now()}.png`;
    logoPath = path.join('/tmp', logoFilename);
    await downloadFile(logoUrl, logoPath);

    // 2. 设置 FFmpeg 路径
    ffmpeg.setFfmpegPath(ffmpegPath);

    // 3. 计算 Logo 位置
    let xPosition, yPosition;
    const padding = 20; // 边距

    switch (position) {
      case 'top-left':
        xPosition = padding;
        yPosition = padding;
        break;
      case 'top-right':
        xPosition = `W-w-${padding}`;
        yPosition = padding;
        break;
      case 'bottom-left':
        xPosition = padding;
        yPosition = `H-h-${padding}`;
        break;
      case 'bottom-right':
        xPosition = `W-w-${padding}`;
        yPosition = `H-h-${padding}`;
        break;
      case 'center':
        xPosition = '(W-w)/2';
        yPosition = '(H-h)/2';
        break;
      default:
        xPosition = `W-w-${padding}`;
        yPosition = padding;
    }

    // 4. 构建滤镜链
    // scale: 缩放 Logo
    // format: 确保格式兼容
    // colorchannelmixer: 调整透明度
    // overlay: 叠加到视频上
    const filterComplex = [
      `[1:v]scale=iw*${scale}:-1[logo]`, // 缩放Logo
      `[logo]format=rgba,colorchannelmixer=aa=${opacity}[logo_alpha]`, // 设置透明度
      `[0:v][logo_alpha]overlay=${xPosition}:${yPosition}[outv]` // 叠加
    ].join(';');

    // 5. 执行 FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputPath)
        .input(logoPath)
        .complexFilter(filterComplex)
        .outputOptions([
          '-map', '[outv]',
          '-map', '0:a?', // 音频（如果有）
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'copy'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.debug('FFmpeg命令', { commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('水印添加进度', {
            percent: progress.percent,
            timemark: progress.timemark
          });
        })
        .on('end', () => {
          logger.info('Logo水印添加完成', { outputPath });
          resolve(outputPath);
        })
        .on('error', (error) => {
          logger.error('Logo水印添加失败', { error: error.message });
          reject(error);
        })
        .run();
    });

    return outputPath;

  } catch (error) {
    logger.error('Logo水印添加异常', { error: error.message });
    throw new Error(`Logo水印添加失败: ${error.message}`);
  } finally {
    // 清理下载的 Logo 文件
    if (logoPath && require('fs').existsSync(logoPath)) {
      require('fs').unlinkSync(logoPath);
      logger.debug('Logo临时文件已删除', { logoPath });
    }
  }
}

module.exports = { add };
