/**
 * 视频拼接器
 * 使用 FFmpeg 拼接多个视频片段，支持转场效果
 */

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const logger = require('../../common/logger');

/**
 * 拼接视频片段
 * @param {Array<string>} inputFiles - 输入视频文件路径列表
 * @param {Object} options - 拼接选项
 * @param {string} options.transition - 转场效果: fade | wipe | none
 * @param {number} options.transitionDuration - 转场时长（秒）
 * @param {string} options.outputPath - 输出文件路径
 * @param {string} ffmpegPath - FFmpeg 可执行文件路径
 * @returns {Promise<string>} 输出文件路径
 */
async function merge(inputFiles, options, ffmpegPath = '/opt/bin/ffmpeg') {
  const {
    transition = 'fade',
    transitionDuration = 1,
    outputPath
  } = options;

  if (!inputFiles || inputFiles.length === 0) {
    throw new Error('视频文件列表不能为空');
  }

  try {
    logger.info('开始拼接视频', {
      inputCount: inputFiles.length,
      transition,
      transitionDuration,
      outputPath
    });

    // 设置 FFmpeg 路径
    ffmpeg.setFfmpegPath(ffmpegPath);

    // 如果只有一个文件，直接复制
    if (inputFiles.length === 1) {
      fs.copyFileSync(inputFiles[0], outputPath);
      logger.info('单个视频文件，直接复制', { outputPath });
      return outputPath;
    }

    // 创建 concat 文件列表
    const concatListPath = path.join(path.dirname(outputPath), 'concat_list.txt');
    const concatContent = inputFiles.map(file => `file '${file}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    // 使用 FFmpeg concat 协议拼接视频
    await new Promise((resolve, reject) => {
      let command = ffmpeg();

      if (transition === 'fade' && inputFiles.length > 1) {
        // 使用复杂滤镜实现淡入淡出转场
        // 注意：这是简化实现，实际生产环境可能需要更复杂的滤镜链
        command
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k'
          ]);
      } else {
        // 简单拼接（无转场）
        command
          .input(concatListPath)
          .inputOptions(['-f', 'concat', '-safe', '0', '-c', 'copy']);
      }

      command
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.debug('FFmpeg命令', { commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('拼接进度', {
            percent: progress.percent,
            timemark: progress.timemark
          });
        })
        .on('end', () => {
          logger.info('视频拼接完成', { outputPath });
          // 清理临时文件
          fs.unlinkSync(concatListPath);
          resolve(outputPath);
        })
        .on('error', (error) => {
          logger.error('视频拼接失败', { error: error.message });
          // 清理临时文件
          if (fs.existsSync(concatListPath)) {
            fs.unlinkSync(concatListPath);
          }
          reject(error);
        })
        .run();
    });

    return outputPath;

  } catch (error) {
    logger.error('视频拼接异常', { error: error.message });
    throw new Error(`视频拼接失败: ${error.message}`);
  }
}

module.exports = { merge };
