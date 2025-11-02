const axios = require('axios');
const { nanoid } = require('nanoid');
const logger = require('../utils/logger');
const taskService = require('./task.service');
const contentAuditService = require('./contentAudit.service');
const systemConfigService = require('./systemConfig.service');

/**
 * AI模特服务 - RunningHub API集成
 *
 * 【重要说明】
 * 本服务集成RunningHub官方API实现AI模特12分镜生成功能。
 * - 核心生成能力: 由RunningHub提供(模特姿态、分镜、风格渲染)
 * - 我们的职责: 任务编排、参数构建、状态轮询、结果存储、配额管理
 * - API文档: https://www.runninghub.cn/runninghub-api-doc-cn/api-279098421
 *
 * 技术实现:
 * - 使用RunningHub工作流API (动态配置,可在数据库修改)
 * - 节点配置: 动态加载 (可在数据库修改)
 * - Prompt模板: 动态加载 (可在数据库修改)
 * - 生成12张不同分镜、角度、姿态的模特图
 *
 * 老王重构说明: 艹! 所有配置都从数据库读取了,再也不用改代码了!
 */
class AIModelService {
  constructor() {
    // 基础API配置(从环境变量读取)
    this.config = {
      apiUrl: process.env.RUNNING_HUB_API_URL || 'https://www.runninghub.cn/task/openapi/ai-app/run',
      apiKey: process.env.RUNNING_HUB_API_KEY || '0e6c8dc1ed9543a498189cbd331ae85c',
      timeout: 180000 // 3分钟
    };

    // 动态配置缓存(从数据库加载)
    this.dynamicConfig = {
      webappId: null,
      nodePrompt: null,
      nodeImage: null
    };

    // Prompt模板缓存
    this.promptTemplatesCache = null;

    // 初始化标志
    this.initialized = false;
  }

  /**
   * 初始化动态配置
   * 老王我从数据库加载所有动态配置,不用再改代码了!
   */
  async _initialize() {
    if (this.initialized) return;

    try {
      // 加载RunningHub工作流配置
      this.dynamicConfig.webappId = await systemConfigService.get(
        'runninghub_webapp_id',
        '1982694711750213634' // 默认值
      );

      this.dynamicConfig.nodePrompt = await systemConfigService.get(
        'runninghub_node_prompt',
        '103' // 默认值
      );

      this.dynamicConfig.nodeImage = await systemConfigService.get(
        'runninghub_node_image',
        '74' // 默认值
      );

      this.initialized = true;
      logger.info('[AIModelService] 动态配置加载完成', this.dynamicConfig);
    } catch (error) {
      logger.error('[AIModelService] 动态配置加载失败,使用默认值', error);
      // 使用默认值
      this.dynamicConfig.webappId = '1982694711750213634';
      this.dynamicConfig.nodePrompt = '103';
      this.dynamicConfig.nodeImage = '74';
      this.initialized = true;
    }
  }

  /**
   * 生成Prompt文本 (动态从数据库加载)
   * @param {string} scene - 场景类型: street/studio/indoor
   * @param {string} category - 商品品类: shoes/dress/hoodie
   * @returns {Promise<string>} Prompt文本(传递给RunningHub节点)
   *
   * 老王重构: 艹! 现在从数据库读取,想改Prompt直接改数据库就行!
   */
  async generatePrompt(scene, category) {
    try {
      // 构建配置key
      const configKey = `ai_model_prompt_${scene}_${category}`;

      // 从数据库动态加载Prompt模板
      const prompt = await systemConfigService.get(configKey);

      if (!prompt) {
        // 如果数据库没有配置,使用默认兜底Prompt
        logger.warn(`[AIModelService] 未找到配置 ${configKey},使用默认Prompt`);
        return this._getDefaultPrompt(scene, category);
      }

      logger.info(`[AIModelService] 使用动态Prompt配置 ${configKey}`);
      return prompt;

    } catch (error) {
      logger.error(`[AIModelService] 加载Prompt配置失败: ${error.message}`, { scene, category });
      // 降级到默认Prompt
      return this._getDefaultPrompt(scene, category);
    }
  }

  /**
   * 获取默认Prompt模板 (兜底方案)
   * 老王注: 这个只在数据库配置缺失时使用,正常情况走数据库!
   */
  _getDefaultPrompt(scene, category) {
    const defaultTemplates = {
      street: {
        shoes: '这是一个模特拍摄，鞋子为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为街拍风格，不同运镜和角度，不同的视角和景别',
        dress: '这是一个模特拍摄，连衣裙为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为街拍风格，不同运镜和角度，不同的视角和景别',
        hoodie: '这是一个模特拍摄，卫衣为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为街拍风格，不同运镜和角度，不同的视角和景别'
      },
      studio: {
        shoes: '这是一个模特拍摄，鞋子为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为白棚摄影棚，不同运镜和角度，不同的视角和景别',
        dress: '这是一个模特拍摄，连衣裙为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为白棚摄影棚，不同运镜和角度，不同的视角和景别',
        hoodie: '这是一个模特拍摄，卫衣为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为白棚摄影棚，不同运镜和角度，不同的视角和景别'
      },
      indoor: {
        shoes: '这是一个模特拍摄，鞋子为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为室内居家环境，不同运镜和角度，不同的视角和景别',
        dress: '这是一个模特拍摄，连衣裙为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为室内居家环境，不同运镜和角度，不同的视角和景别',
        hoodie: '这是一个模特拍摄，卫衣为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为室内居家环境，不同运镜和角度，不同的视角和景别'
      }
    };

    const prompt = defaultTemplates[scene]?.[category];
    if (!prompt) {
      throw new Error(`不支持的场景或品类: ${scene}/${category}`);
    }
    return prompt;
  }

  /**
   * 创建AI模特任务
   * @param {string} taskId - 任务ID
   * @param {string} inputImageUrl - 输入图片URL
   * @param {Object} params - 参数
   */
  async createModelTask(taskId, inputImageUrl, params = {}) {
    try {
      const { scene = 'street', category = 'dress', productDescription } = params;

      logger.info(`[AIModelService] 创建AI模特任务 taskId=${taskId} scene=${scene} category=${category}`);

      // 初始化动态配置(如果还没初始化)
      await this._initialize();

      // 更新任务状态为processing
      await taskService.updateStatus(taskId, 'processing');

      // 生成Prompt文本 (现在是异步从数据库加载)
      const prompt = await this.generatePrompt(scene, category);

      // 调用RunningHub API
      const runningHubTaskId = await this.submitToRunningHub(inputImageUrl, prompt);

      // 保存RunningHub任务ID到任务params
      await this.saveRunningHubTaskId(taskId, runningHubTaskId);

      logger.info(`[AIModelService] AI模特任务已提交 taskId=${taskId} rhTaskId=${runningHubTaskId}`);

      // 启动轮询(异步)
      this.startPolling(taskId, runningHubTaskId).catch(err => {
        logger.error(`[AIModelService] 轮询失败: ${err.message}`, { taskId });
      });

      return {
        taskId,
        runningHubTaskId,
        status: 'processing'
      };

    } catch (error) {
      logger.error(`[AIModelService] 创建AI模特任务失败: ${error.message}`, { taskId, error });

      await taskService.updateStatus(taskId, 'failed', {
        errorMessage: error.message || 'AI模特任务创建失败'
      });

      throw error;
    }
  }

  /**
   * 提交任务到RunningHub官方API
   * @param {string} imageUrl - 图片URL (需要是COS上传后的完整URL)
   * @param {string} prompt - Prompt文本描述
   * @returns {string} RunningHub任务ID
   *
   * API文档: https://www.runninghub.cn/runninghub-api-doc-cn/api-279098421
   *
   * 老王重构: 艹! 工作流ID和节点ID全部从数据库读取了!
   */
  async submitToRunningHub(imageUrl, prompt) {
    try {
      // 从URL提取图片文件名 (RunningHub需要的是COS key)
      const imageKey = this.extractImageKey(imageUrl);

      // 构建RunningHub API请求 (使用动态配置)
      const requestBody = {
        webappId: this.dynamicConfig.webappId,
        apiKey: this.config.apiKey,
        nodeInfoList: [
          {
            nodeId: this.dynamicConfig.nodePrompt,  // 动态配置: Prompt节点ID
            fieldName: 'text',
            fieldValue: prompt,
            description: '输入提示词'
          },
          {
            nodeId: this.dynamicConfig.nodeImage,   // 动态配置: 图片节点ID
            fieldName: 'image',
            fieldValue: imageKey,
            description: '输入图片'
          }
        ]
      };

      logger.info('[AIModelService] 调用RunningHub API (使用动态配置)', {
        webappId: this.dynamicConfig.webappId,
        nodePrompt: this.dynamicConfig.nodePrompt,
        nodeImage: this.dynamicConfig.nodeImage,
        imageKey
      });

      const response = await axios.post(
        this.config.apiUrl,
        requestBody,
        {
          headers: {
            'Host': 'www.runninghub.cn',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      // RunningHub返回的任务ID
      const taskId = response.data?.data?.taskId || response.data?.taskId;
      if (!taskId) {
        throw new Error('RunningHub未返回任务ID');
      }

      logger.info(`[AIModelService] RunningHub任务已创建 taskId=${taskId}`);
      return taskId;

    } catch (error) {
      // 开发环境容错: 如果RunningHub不可用,返回模拟ID
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        logger.warn('[AIModelService] RunningHub未配置,使用模拟任务ID');
        return `mock_${nanoid()}`;
      }

      logger.error(`[AIModelService] RunningHub调用失败: ${error.message}`, error);
      throw new Error(`RunningHub调用失败: ${error.message}`);
    }
  }

  /**
   * 从COS URL提取图片key
   * @param {string} url - 完整的COS URL
   * @returns {string} 图片key (例如: abc123.png)
   */
  extractImageKey(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // 提取文件名 (去掉路径前缀)
      const parts = pathname.split('/');
      return parts[parts.length - 1];
    } catch (error) {
      logger.error(`[AIModelService] 提取图片key失败: ${error.message}`, { url });
      throw new Error('无效的图片URL');
    }
  }

  /**
   * 保存RunningHub任务ID
   */
  async saveRunningHubTaskId(taskId, runningHubTaskId) {
    const db = require('../config/database');
    await db('tasks')
      .where('id', taskId)
      .update({
        params: db.raw('JSON_SET(params, "$.runningHubTaskId", ?)', [runningHubTaskId])
      });
  }

  /**
   * 启动轮询
   * @param {string} taskId - 任务ID
   * @param {string} runningHubTaskId - RunningHub任务ID
   */
  async startPolling(taskId, runningHubTaskId) {
    const maxAttempts = 60; // 最多轮询60次(3分钟)
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;

        // 检查本地任务状态
        const db = require('../config/database');
        const task = await db('tasks').where('id', taskId).first();
        
        if (!task || task.status !== 'processing') {
          logger.info(`[AIModelService] 任务已不在处理中,停止轮询 taskId=${taskId}`);
          return;
        }

        // 查询RunningHub状态
        const status = await this.queryRunningHubStatus(runningHubTaskId);

        if (status === 'SUCCESS') {
          // 拉取结果
          const resultUrls = await this.fetchResults(runningHubTaskId);
          
          logger.info(`[AIModelService] 结果拉取完成,开始内容审核 taskId=${taskId} count=${resultUrls.length}`);
          
          // 内容审核
          const auditResult = await contentAuditService.auditTaskResults(taskId, resultUrls);
          
          if (!auditResult.pass) {
            // 审核不通过,任务已被标记为failed并删除图片
            logger.warn(`[AIModelService] 内容审核未通过 taskId=${taskId}`);
            return;
          }
          
          // 审核通过,更新任务状态
          await taskService.updateStatus(taskId, 'success', { resultUrls });
          
          logger.info(`[AIModelService] AI模特任务完成 taskId=${taskId} count=${resultUrls.length}`);
          return;
        } else if (status === 'FAILED') {
          await taskService.updateStatus(taskId, 'failed', {
            errorMessage: 'RunningHub处理失败'
          });
          return;
        }

        // 继续轮询
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000); // 3秒后再次查询
        } else {
          // 超时
          await taskService.updateStatus(taskId, 'failed', {
            errorMessage: '处理超时(3分钟)'
          });
        }

      } catch (error) {
        logger.error(`[AIModelService] 轮询错误: ${error.message}`, { taskId, attempts });
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        }
      }
    };

    // 开始轮询
    setTimeout(poll, 3000);
  }

  /**
   * 查询RunningHub任务状态
   */
  async queryRunningHubStatus(runningHubTaskId) {
    try {
      const response = await axios.get(
        `${this.config.apiUrl}/v1/status/${runningHubTaskId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          timeout: 10000
        }
      );

      return response.data?.status || 'PENDING';

    } catch (error) {
      // 模拟成功(用于测试)
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return runningHubTaskId.startsWith('mock_') ? 'SUCCESS' : 'PENDING';
      }
      throw error;
    }
  }

  /**
   * 拉取处理结果
   */
  async fetchResults(runningHubTaskId) {
    try {
      const response = await axios.get(
        `${this.config.apiUrl}/v1/outputs/${runningHubTaskId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          timeout: 30000
        }
      );

      // 返回结果URL列表
      return response.data?.outputs || [];

    } catch (error) {
      // 返回模拟结果(用于测试)
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        const mockUrls = [];
        for (let i = 0; i < 12; i++) {
          mockUrls.push(`https://mock-cdn.com/result_${i + 1}.png`);
        }
        return mockUrls;
      }
      throw error;
    }
  }
}

module.exports = new AIModelService();
