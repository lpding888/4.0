/**
 * 视频合成云函数 - 主入口
 *
 * 功能：拼接多个视频片段 + 添加字幕 + 添加Logo水印
 * 触发方式：HTTP POST
 *
 * 处理流程：
 * 1. 下载输入文件到 /tmp
 * 2. 拼接视频片段（转场效果）
 * 3. 叠加字幕
 * 4. 添加 Logo 水印
 * 5. 上传到 COS
 * 6. 回调后端
 * 7. 清理临时文件
 */

const path = require('path');
const fs = require('fs');
const config = require('./config');
const logger = require('../common/logger');
const { wrapHandler, SCFError } = require('../common/errorHandler');
const { downloadFiles, cleanupFiles } = require('../common/fileDownloader');
const videoMerger = require('./lib/videoMerger');
const subtitleOverlay = require('./lib/subtitleOverlay');
const logoWatermark = require('./lib/logoWatermark');
const cosUploader = require('./lib/cosUploader');
const callbackSender = require('./lib/callbackSender');

/**
 * 主处理函数
 */
async function handler(event, context) {
  let tempFiles = []; // 记录所有临时文件，用于最后清理

  try {
    // 1. 解析请求
    const body = JSON.parse(event.body || '{}');
    const { task_id, step_index, input_files, params } = body;

    // 参数验证
    if (!task_id || step_index === undefined || !input_files || !Array.isArray(input_files)) {
      throw new SCFError('缺少必要参数: task_id, step_index, input_files', 400);
    }

    logger.info('收到视频合成任务', {
      task_id,
      step_index,
      inputCount: input_files.length,
      params
    });

    // 2. 下载输入文件到 /tmp
    const downloadedFiles = await downloadFiles(input_files, config.tmpDir);
    tempFiles.push(...downloadedFiles);

    logger.info('输入文件下载完成', { count: downloadedFiles.length });

    // 3. 拼接视频片段
    const mergedVideoPath = path.join(config.tmpDir, `merged_${task_id}.mp4`);
    await videoMerger.merge(downloadedFiles, {
      transition: params.transition || 'fade',
      transitionDuration: params.transition_duration || 1,
      outputPath: mergedVideoPath
    }, config.ffmpeg.binaryPath);
    tempFiles.push(mergedVideoPath);

    logger.info('视频拼接完成', { outputPath: mergedVideoPath });

    // 4. 叠加字幕（如果有）
    let currentVideoPath = mergedVideoPath;
    if (params.tagline || params.launch_date) {
      const subtitleText = [params.tagline, params.launch_date]
        .filter(Boolean)
        .join('\n');

      const subtitledVideoPath = path.join(config.tmpDir, `subtitled_${task_id}.mp4`);
      await subtitleOverlay.add(currentVideoPath, {
        text: subtitleText,
        position: params.subtitle_position || 'bottom',
        fontSize: params.subtitle_font_size || config.subtitle.defaultFontSize,
        fontColor: config.subtitle.defaultFontColor,
        backgroundColor: config.subtitle.defaultBackgroundColor,
        fontPath: config.subtitle.fontPath,
        outputPath: subtitledVideoPath
      }, config.ffmpeg.binaryPath);
      tempFiles.push(subtitledVideoPath);
      currentVideoPath = subtitledVideoPath;

      logger.info('字幕添加完成', { outputPath: subtitledVideoPath });
    }

    // 5. 添加 Logo 水印（如果有）
    let finalVideoPath = currentVideoPath;
    if (params.logo_url) {
      const watermarkedVideoPath = path.join(config.tmpDir, `final_${task_id}.mp4`);
      await logoWatermark.add(currentVideoPath, {
        logoUrl: params.logo_url,
        position: params.logo_position || config.logo.defaultPosition,
        scale: params.logo_scale || config.logo.defaultScale,
        opacity: params.logo_opacity || config.logo.defaultOpacity,
        outputPath: watermarkedVideoPath
      }, config.ffmpeg.binaryPath);
      tempFiles.push(watermarkedVideoPath);
      finalVideoPath = watermarkedVideoPath;

      logger.info('Logo水印添加完成', { outputPath: watermarkedVideoPath });
    }

    // 6. 上传到 COS
    const cosPath = `tasks/${task_id}/step_${step_index}/output.mp4`;
    const outputUrl = await cosUploader.upload(finalVideoPath, {
      bucket: config.cos.bucket,
      region: config.cos.region,
      path: cosPath,
      contentType: 'video/mp4'
    }, config.cos);

    logger.info('视频上传到COS完成', { outputUrl });

    // 7. 回调后端（成功）
    await callbackSender.send({
      task_id,
      step_index,
      status: 'success',
      output_url: outputUrl
    }, config.callback.apiUrl, config.callback.secret);

    logger.info('回调发送成功', { task_id, step_index });

    // 8. 返回成功响应
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
    logger.error('视频合成任务失败', {
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
    // 9. 清理所有临时文件
    await cleanupFiles(tempFiles);
    logger.info('临时文件清理完成', { count: tempFiles.length });
  }
}

// 导出包装后的处理函数
exports.main_handler = wrapHandler(handler);
