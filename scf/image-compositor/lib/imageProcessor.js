/**
 * 图片处理工具
 * 提供图片格式转换、压缩、裁剪等功能
 */

const sharp = require('sharp');
const logger = require('../../common/logger');

/**
 * 调整图片大小（保持宽高比）
 * @param {string} inputPath - 输入图片路径
 * @param {Object} options - 调整选项
 * @param {number} options.width - 目标宽度
 * @param {number} options.height - 目标高度
 * @param {string} options.fit - 适应模式: cover | contain | fill
 * @param {string} options.outputPath - 输出路径
 * @returns {Promise<string>} 输出路径
 */
async function resize(inputPath, options) {
  const { width, height, fit = 'cover', outputPath } = options;

  try {
    await sharp(inputPath)
      .resize(width, height, {
        fit: fit,
        position: 'center'
      })
      .toFile(outputPath);

    logger.info('图片调整完成', { inputPath, outputPath, width, height, fit });
    return outputPath;

  } catch (error) {
    logger.error('图片调整失败', { error: error.message });
    throw new Error(`图片调整失败: ${error.message}`);
  }
}

/**
 * 压缩图片
 * @param {string} inputPath - 输入图片路径
 * @param {Object} options - 压缩选项
 * @param {number} options.quality - 质量（1-100）
 * @param {string} options.format - 输出格式: jpeg | png | webp
 * @param {string} options.outputPath - 输出路径
 * @returns {Promise<string>} 输出路径
 */
async function compress(inputPath, options) {
  const { quality = 80, format = 'jpeg', outputPath } = options;

  try {
    let pipeline = sharp(inputPath);

    // 根据格式选择压缩方法
    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality });
        break;
      case 'png':
        pipeline = pipeline.png({ quality });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      default:
        throw new Error(`不支持的格式: ${format}`);
    }

    await pipeline.toFile(outputPath);

    logger.info('图片压缩完成', { inputPath, outputPath, quality, format });
    return outputPath;

  } catch (error) {
    logger.error('图片压缩失败', { error: error.message });
    throw new Error(`图片压缩失败: ${error.message}`);
  }
}

/**
 * 获取图片元数据
 * @param {string} imagePath - 图片路径
 * @returns {Promise<Object>} 元数据
 */
async function getMetadata(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size
    };
  } catch (error) {
    logger.error('获取图片元数据失败', { error: error.message });
    throw new Error(`获取图片元数据失败: ${error.message}`);
  }
}

module.exports = {
  resize,
  compress,
  getMetadata
};
