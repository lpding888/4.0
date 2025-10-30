/**
 * 图片拼接云函数 - 主入口
 *
 * 功能：九宫格/多图合成
 * 触发方式：HTTP POST
 *
 * 处理流程：
 * 1. 下载所有图片到 /tmp
 * 2. 使用 Sharp 生成九宫格布局
 * 3. 上传到 COS
 * 4. 回调后端
 * 5. 清理临时文件
 */

const path = require('path');
const config = require('./config');
const logger = require('../common/logger');
const { wrapHandler, SCFError } = require('../common/errorHandler');
const { downloadFiles, cleanupFiles } = require('../common/fileDownloader');
const gridLayout = require('./lib/gridLayout');
const cosUploader = require('../video-compositor/lib/cosUploader'); // 复用
const callbackSender = require('../video-compositor/lib/callbackSender'); // 复用

/**
 * 主处理函数
 */
async function handler(event, context) {
  let tempFiles = [];

  try {
    // 1. 解析请求
    const body = JSON.parse(event.body || '{}');
    const { task_id, step_index, input_files, params } = body;

    // 参数验证
    if (!task_id || step_index === undefined || !input_files || !Array.isArray(input_files)) {
      throw new SCFError('缺少必要参数: task_id, step_index, input_files', 400);
    }

    logger.info('收到图片拼接任务', {
      task_id,
      step_index,
      imageCount: input_files.length,
      params
    });

    // 2. 下载所有图片到 /tmp
    const downloadedFiles = await downloadFiles(input_files, config.tmpDir);
    tempFiles.push(...downloadedFiles);

    logger.info('图片下载完成', { count: downloadedFiles.length });

    // 3. 生成九宫格
    const layout = params.layout || '3x4';
    const spacing = params.spacing !== undefined ? params.spacing : config.image.defaultSpacing;
    const backgroundColor = params.background_color || config.image.defaultBackgroundColor;

    const gridImagePath = path.join(config.tmpDir, `grid_${task_id}.jpg`);
    await gridLayout.create(downloadedFiles, {
      layout: layout,
      spacing: spacing,
      backgroundColor: backgroundColor,
      imageWidth: config.image.defaultImageWidth,
      imageHeight: config.image.defaultImageHeight,
      outputPath: gridImagePath
    });
    tempFiles.push(gridImagePath);

    logger.info('九宫格生成完成', { outputPath: gridImagePath });

    // 4. 上传到 COS
    const cosPath = `tasks/${task_id}/step_${step_index}/grid.jpg`;
    const outputUrl = await cosUploader.upload(gridImagePath, {
      bucket: config.cos.bucket,
      region: config.cos.region,
      path: cosPath,
      contentType: 'image/jpeg'
    }, config.cos);

    logger.info('图片上传到COS完成', { outputUrl });

    // 5. 回调后端（成功）
    await callbackSender.send({
      task_id,
      step_index,
      status: 'success',
      output_url: outputUrl
    }, config.callback.apiUrl, config.callback.secret);

    logger.info('回调发送成功', { task_id, step_index });

    // 6. 返回成功响应
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        task_id,
        step_index,
        output_url: outputUrl
      })
    };

  } catch (error) {
    logger.error('图片拼接任务失败', {
      error: error.message,
      stack: error.stack
    });

    // 尝试发送失败回调
    try {
      const body = JSON.parse(event.body || '{}');
      const { task_id, step_index } = body;

      if (task_id && step_index !== undefined) {
        await callbackSender.send({
          task_id,
          step_index,
          status: 'failed',
          error_message: error.message
        }, config.callback.apiUrl, config.callback.secret);

        logger.info('失败回调已发送', { task_id, step_index });
      }
    } catch (callbackError) {
      logger.error('发送失败回调时出错', { error: callbackError.message });
    }

    // 返回错误响应
    return {
      statusCode: error.code || 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };

  } finally {
    // 7. 清理所有临时文件
    await cleanupFiles(tempFiles);
    logger.info('临时文件清理完成', { count: tempFiles.length });
  }
}

// 导出包装后的处理函数
exports.main_handler = wrapHandler(handler);
