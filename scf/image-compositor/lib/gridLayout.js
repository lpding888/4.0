/**
 * 九宫格布局生成器
 * 使用 Sharp 库进行高性能图片处理
 */

const sharp = require('sharp');
const fs = require('fs');
const logger = require('../../common/logger');

/**
 * 创建九宫格布局
 * @param {Array<string>} imagePaths - 图片文件路径列表
 * @param {Object} options - 布局选项
 * @param {string} options.layout - 布局格式: 2x2, 3x3, 3x4, 4x4
 * @param {number} options.spacing - 图片间距（像素）
 * @param {string} options.backgroundColor - 背景颜色（hex）
 * @param {number} options.imageWidth - 单张图片宽度
 * @param {number} options.imageHeight - 单张图片高度
 * @param {string} options.outputPath - 输出文件路径
 * @returns {Promise<string>} 输出文件路径
 */
async function create(imagePaths, options) {
  const {
    layout = '3x4',
    spacing = 10,
    backgroundColor = '#F5F5F5',
    imageWidth = 512,
    imageHeight = 512,
    outputPath
  } = options;

  try {
    logger.info('开始创建九宫格布局', {
      layout,
      imageCount: imagePaths.length,
      spacing,
      backgroundColor,
      outputPath
    });

    // 解析布局（例如 "3x4" -> rows=3, cols=4）
    const [rows, cols] = layout.split('x').map(Number);
    const maxImages = rows * cols;

    if (imagePaths.length > maxImages) {
      logger.warn('图片数量超过布局容量，将截取前N张', {
        provided: imagePaths.length,
        max: maxImages
      });
      imagePaths = imagePaths.slice(0, maxImages);
    }

    // 计算画布尺寸
    const canvasWidth = cols * imageWidth + (cols + 1) * spacing;
    const canvasHeight = rows * imageHeight + (rows + 1) * spacing;

    logger.debug('画布尺寸', { canvasWidth, canvasHeight });

    // 创建背景画布
    let canvas = sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 3,
        background: backgroundColor
      }
    });

    // 处理每张图片并计算位置
    const compositeImages = [];

    for (let i = 0; i < imagePaths.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      // 计算位置
      const left = spacing + col * (imageWidth + spacing);
      const top = spacing + row * (imageHeight + spacing);

      // 读取并调整图片大小
      const resizedImage = await sharp(imagePaths[i])
        .resize(imageWidth, imageHeight, {
          fit: 'cover', // 裁剪并填充
          position: 'center'
        })
        .toBuffer();

      compositeImages.push({
        input: resizedImage,
        left: left,
        top: top
      });

      logger.debug('图片位置计算', { index: i, row, col, left, top });
    }

    // 合成所有图片到画布上
    await canvas
      .composite(compositeImages)
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    logger.info('九宫格创建完成', {
      outputPath,
      imageCount: imagePaths.length,
      canvasSize: `${canvasWidth}x${canvasHeight}`
    });

    return outputPath;

  } catch (error) {
    logger.error('九宫格创建失败', { error: error.message });
    throw new Error(`九宫格创建失败: ${error.message}`);
  }
}

module.exports = { create };
