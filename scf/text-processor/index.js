/**
 * 文本处理云函数 - 主入口
 *
 * 功能：文案生成和格式化
 * 触发方式：HTTP POST
 *
 * 处理流程：
 * 1. 解析请求参数
 * 2. 加载并渲染模板
 * 3. 生成文案包（JSON格式）
 * 4. 上传到 COS
 * 5. 回调后端
 */

const path = require('path');
const config = require('./config');
const logger = require('../common/logger');
const { wrapHandler, SCFError } = require('../common/errorHandler');
const templateRenderer = require('./lib/templateRenderer');
const cosUploader = require('../video-compositor/lib/cosUploader'); // 复用
const callbackSender = require('../video-compositor/lib/callbackSender'); // 复用

/**
 * 主处理函数
 */
async function handler(event, context) {
  try {
    // 1. 解析请求
    const body = JSON.parse(event.body || '{}');
    const { task_id, step_index, input_files, params } = body;

    // 参数验证
    if (!task_id || step_index === undefined || !params) {
      throw new SCFError('缺少必要参数: task_id, step_index, params', 400);
    }

    if (!params.template) {
      throw new SCFError('缺少模板名称: params.template', 400);
    }

    logger.info('收到文本处理任务', {
      task_id,
      step_index,
      template: params.template,
      params
    });

    // 2. 渲染文案模板
    const textBundle = templateRenderer.render(params.template, {
      skuNames: params.sku_names || [],
      launchDate: params.launch_date || '',
      storeName: params.store_name || '店铺'
    }, config.templates.basePath);

    logger.info('文案渲染完成', { textBundle });

    // 3. 生成 JSON 文件并保存到临时目录
    const jsonContent = JSON.stringify(textBundle, null, 2);
    const tempFilePath = path.join(config.tmpDir, `text_bundle_${task_id}.json`);
    require('fs').writeFileSync(tempFilePath, jsonContent, 'utf-8');

    logger.debug('临时文件创建完成', { tempFilePath });

    // 4. 上传到 COS
    const cosPath = `tasks/${task_id}/step_${step_index}/text_bundle.json`;
    const outputUrl = await cosUploader.upload(tempFilePath, {
      bucket: config.cos.bucket,
      region: config.cos.region,
      path: cosPath,
      contentType: 'application/json'
    }, config.cos);

    logger.info('文案上传到COS完成', { outputUrl });

    // 5. 清理临时文件
    require('fs').unlinkSync(tempFilePath);
    logger.debug('临时文件已删除', { tempFilePath });

    // 6. 回调后端（成功）
    await callbackSender.send({
      task_id,
      step_index,
      status: 'success',
      output_url: outputUrl
    }, config.callback.apiUrl, config.callback.secret);

    logger.info('回调发送成功', { task_id, step_index });

    // 7. 返回成功响应
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        task_id,
        step_index,
        output_url: outputUrl,
        text_bundle: textBundle
      })
    };

  } catch (error) {
    logger.error('文本处理任务失败', {
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
  }
}

// 导出包装后的处理函数
exports.main_handler = wrapHandler(handler);
