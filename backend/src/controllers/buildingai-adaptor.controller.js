const logger = require('../utils/logger');
const buildingAIAdaptorService = require('../services/buildingai-adaptor.service');
const { body, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');

/**
 * BuildingAI适配层控制器
 *
 * 处理BuildingAI服务的API调用：
 * - 图片处理（增强、生成、编辑）
 * - 文本处理（生成、翻译、摘要）
 * - 音频处理（转录）
 * - 视频处理（分析）
 * - 数据分析
 */
class BuildingAIAdaptorController {
  /**
   * 图片增强
   * POST /api/ai/image/enhance
   */
  async enhanceImage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const { imageUrl, imageBase64, level = 'medium', outputFormat = 'png' } = req.body;

      const result = await buildingAIAdaptorService.callAPI('image_enhance', {
        imageUrl,
        imageBase64,
        level,
        outputFormat
      });

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('ai.image_enhanced') : 'Image enhanced successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to enhance image:', error);
      const appError = AppError.fromError(error, ERROR_CODES.AI_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 图片生成
   * POST /api/ai/image/generate
   */
  async generateImage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const { prompt, style = 'realistic', size = '1024x1024', quality = 'standard', count = 1 } = req.body;

      const result = await buildingAIAdaptorService.callAPI('image_generate', {
        prompt,
        style,
        size,
        quality,
        count
      });

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('ai.image_generated') : 'Image generated successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to generate image:', error);
      const appError = AppError.fromError(error, ERROR_CODES.AI_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 图片编辑
   * POST /api/ai/image/edit
   */
  async editImage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const { imageUrl, imageBase64, maskUrl, maskBase64, prompt, count = 1 } = req.body;

      const result = await buildingAIAdaptorService.callAPI('image_edit', {
        imageUrl,
        imageBase64,
        maskUrl,
        maskBase64,
        prompt,
        count
      });

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('ai.image_edited') : 'Image edited successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to edit image:', error);
      const appError = AppError.fromError(error, ERROR_CODES.AI_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 文本生成
   * POST /api/ai/text/generate
   */
  async generateText(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const { prompt, maxTokens = 500, temperature = 0.7, model = 'gpt-3.5-turbo' } = req.body;

      const result = await buildingAIAdaptorService.callAPI('text_generate', {
        prompt,
        maxTokens,
        temperature,
        model
      });

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('ai.text_generated') : 'Text generated successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to generate text:', error);
      const appError = AppError.fromError(error, ERROR_CODES.AI_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 文本翻译
   * POST /api/ai/text/translate
   */
  async translateText(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const { text, sourceLanguage = 'auto', targetLanguage, format = 'text' } = req.body;

      const result = await buildingAIAdaptorService.callAPI('text_translate', {
        text,
        sourceLanguage,
        targetLanguage,
        format
      });

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('ai.text_translated') : 'Text translated successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to translate text:', error);
      const appError = AppError.fromError(error, ERROR_CODES.AI_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 文本摘要
   * POST /api/ai/text/summarize
   */
  async summarizeText(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const { text, length = 'medium', style = 'professional' } = req.body;

      const result = await buildingAIAdaptorService.callAPI('text_summarize', {
        text,
        length,
        style
      });

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('ai.text_summarized') : 'Text summarized successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to summarize text:', error);
      const appError = AppError.fromError(error, ERROR_CODES.AI_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 音频转录
   * POST /api/ai/audio/transcribe
   */
  async transcribeAudio(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const { audioUrl, audioBase64, language = 'auto', outputFormat = 'text' } = req.body;

      const result = await buildingAIAdaptorService.callAPI('audio_transcribe', {
        audioUrl,
        audioBase64,
        language,
        outputFormat
      });

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('ai.audio_transcribed') : 'Audio transcribed successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to transcribe audio:', error);
      const appError = AppError.fromError(error, ERROR_CODES.AI_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 视频分析
   * POST /api/ai/video/analyze
   */
  async analyzeVideo(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const { videoUrl, videoBase64, analysisType = 'content', detailLevel = 'medium' } = req.body;

      const result = await buildingAIAdaptorService.callAPI('video_analyze', {
        videoUrl,
        videoBase64,
        analysisType,
        detailLevel
      });

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('ai.video_analyzed') : 'Video analyzed successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to analyze video:', error);
      const appError = AppError.fromError(error, ERROR_CODES.AI_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 数据分析
   * POST /api/ai/data/analyze
   */
  async analyzeData(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const { data, analysisType = 'statistical', outputFormat = 'json' } = req.body;

      const result = await buildingAIAdaptorService.callAPI('data_analyze', {
        data,
        analysisType,
        outputFormat
      });

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('ai.data_analyzed') : 'Data analyzed successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to analyze data:', error);
      const appError = AppError.fromError(error, ERROR_CODES.AI_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 获取支持的功能列表
   * GET /api/ai/features
   */
  async getSupportedFeatures(req, res) {
    try {
      const features = buildingAIAdaptorService.getSupportedFeatures();

      res.json({
        success: true,
        data: {
          features: features.map(feature => ({
            key: feature,
            name: this.getFeatureDisplayName(feature),
            description: this.getFeatureDescription(feature),
            category: this.getFeatureCategory(feature)
          })),
          count: features.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to get supported features:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 获取服务统计信息（管理员）
   * GET /api/admin/ai/stats
   */
  async getServiceStats(req, res) {
    try {
      const stats = buildingAIAdaptorService.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to get service stats:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 重置统计信息（管理员）
   * POST /api/admin/ai/reset-stats
   */
  async resetStats(req, res) {
    try {
      buildingAIAdaptorService.resetStats();

      res.json({
        success: true,
        message: req.i18n ? req.i18n.getMessage('ai.stats_reset') : 'AI service statistics reset successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[BuildingAIAdaptorController] Failed to reset stats:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 获取功能显示名称
   * @param {string} feature - 功能key
   * @returns {string} 显示名称
   */
  getFeatureDisplayName(feature) {
    const displayNames = {
      'image_enhance': '图片增强',
      'image_generate': '图片生成',
      'image_edit': '图片编辑',
      'text_generate': '文本生成',
      'text_translate': '文本翻译',
      'text_summarize': '文本摘要',
      'audio_transcribe': '音频转录',
      'video_analyze': '视频分析',
      'data_analyze': '数据分析'
    };
    return displayNames[feature] || feature;
  }

  /**
   * 获取功能描述
   * @param {string} feature - 功能key
   * @returns {string} 功能描述
   */
  getFeatureDescription(feature) {
    const descriptions = {
      'image_enhance': '增强图片质量，提高清晰度和细节',
      'image_generate': '根据文本描述生成高质量图片',
      'image_edit': '编辑和修改现有图片',
      'text_generate': '生成各种类型的文本内容',
      'text_translate': '翻译文本到多种语言',
      'text_summarize': '生成长文本的摘要和要点',
      'audio_transcribe': '将音频转换为文本',
      'video_analyze': '分析视频内容和特征',
      'data_analyze': '对数据进行分析和处理'
    };
    return descriptions[feature] || '';
  }

  /**
   * 获取功能分类
   * @param {string} feature - 功能key
   * @returns {string} 功能分类
   */
  getFeatureCategory(feature) {
    const categories = {
      'image_enhance': 'image_processing',
      'image_generate': 'ai_generation',
      'image_edit': 'image_processing',
      'text_generate': 'ai_generation',
      'text_translate': 'text_processing',
      'text_summarize': 'text_processing',
      'audio_transcribe': 'audio_processing',
      'video_analyze': 'video_processing',
      'data_analyze': 'data_analysis'
    };
    return categories[feature] || 'other';
  }
}

module.exports = new BuildingAIAdaptorController();