/**
 * 模型管理API路由
 * 艹，必须提供完整的模型管理接口！
 *
 * @author 老王
 */

import { NextRequest } from 'next/server';

// 模拟数据库存储
let models = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    maxTokens: 8192,
    status: 'available',
    enabled: true,
    temperature: 0.7,
    maxContext: 8192,
    systemPrompt: 'You are a helpful AI assistant.',
    description: '最强大的通用AI模型，适合复杂任务',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    maxTokens: 4096,
    status: 'available',
    enabled: true,
    temperature: 0.7,
    maxContext: 4096,
    systemPrompt: 'You are a helpful AI assistant.',
    description: '快速可靠的模型，适合日常任务',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude-3 Sonnet',
    provider: 'Anthropic',
    maxTokens: 4096,
    status: 'available',
    enabled: true,
    temperature: 0.7,
    maxContext: 4096,
    systemPrompt: 'You are a helpful AI assistant.',
    description: '擅长推理和分析的AI助手',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    maxTokens: 8192,
    status: 'testing',
    enabled: false,
    temperature: 0.7,
    maxContext: 8192,
    systemPrompt: 'You are a helpful AI assistant.',
    description: 'Google的多模态AI模型',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// 模拟统计数据
const modelStats: Record<string, {
  totalCalls: number;
  avgResponseTime: number;
  successRate: number;
  lastUsed: string;
}> = {
  'gpt-4': {
    totalCalls: 1250,
    avgResponseTime: 2.3,
    successRate: 98.5,
    lastUsed: new Date(Date.now() - 2 * 60 * 1000).toISOString()
  },
  'gpt-3.5-turbo': {
    totalCalls: 3420,
    avgResponseTime: 1.1,
    successRate: 99.2,
    lastUsed: new Date().toISOString()
  },
  'claude-3-sonnet': {
    totalCalls: 890,
    avgResponseTime: 1.8,
    successRate: 97.8,
    lastUsed: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  'gemini-pro': {
    totalCalls: 45,
    avgResponseTime: 3.2,
    successRate: 95.5,
    lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  }
};

// GET - 获取模型列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const provider = searchParams.get('provider');
    const includeStats = searchParams.get('includeStats') === 'true';

    let filteredModels = [...models];

    // 状态筛选
    if (status && status !== 'all') {
      filteredModels = filteredModels.filter(model => model.status === status);
    }

    // 提供商筛选
    if (provider) {
      filteredModels = filteredModels.filter(model => model.provider === provider);
    }

    // 是否包含统计数据
    if (includeStats) {
      filteredModels = filteredModels.map(model => ({
        ...model,
        stats: modelStats[model.id] || {
          totalCalls: 0,
          avgResponseTime: 0,
          successRate: 0,
          lastUsed: null
        }
      }));
    }

    return Response.json({
      success: true,
      data: {
        models: filteredModels,
        total: filteredModels.length,
        stats: {
          total: models.length,
          available: models.filter(m => m.status === 'available').length,
          enabled: models.filter(m => m.enabled).length,
          testing: models.filter(m => m.status === 'testing').length
        }
      }
    });

  } catch (error) {
    console.error('获取模型列表失败:', error);

    return Response.json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '获取模型列表失败',
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }, {
      status: 500
    });
  }
}

// POST - 创建或更新模型配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...config } = body;

    if (!id) {
      return Response.json({
        success: false,
        code: 'INVALID_PARAMS',
        message: '模型ID不能为空'
      }, {
        status: 400
      });
    }

    // 查找现有模型
    const existingIndex = models.findIndex(model => model.id === id);

    if (existingIndex >= 0) {
      // 更新现有模型
      models[existingIndex] = {
        ...models[existingIndex],
        ...config,
        updatedAt: new Date().toISOString()
      };
    } else {
      // 创建新模型
      const newModel = {
        id,
        ...config,
        status: 'testing',
        enabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      models.push(newModel);
    }

    return Response.json({
      success: true,
      message: existingIndex >= 0 ? '模型配置已更新' : '新模型已创建',
      data: models[existingIndex >= 0 ? existingIndex : models.length - 1]
    });

  } catch (error) {
    console.error('保存模型配置失败:', error);

    return Response.json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '保存模型配置失败',
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }, {
      status: 500
    });
  }
}

// PUT - 批量更新模型状态
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelIds, action } = body;

    if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
      return Response.json({
        success: false,
        code: 'INVALID_PARAMS',
        message: '模型ID列表不能为空'
      }, {
        status: 400
      });
    }

    if (!['enable', 'disable', 'delete'].includes(action)) {
      return Response.json({
        success: false,
        code: 'INVALID_PARAMS',
        message: '无效的操作类型'
      }, {
        status: 400
      });
    }

    let updatedCount = 0;

    if (action === 'delete') {
      // 删除模型
      models = models.filter(model => !modelIds.includes(model.id));
      updatedCount = modelIds.length;
    } else {
      // 启用/禁用模型
      const enabled = action === 'enable';
      models.forEach(model => {
        if (modelIds.includes(model.id)) {
          model.enabled = enabled;
          model.updatedAt = new Date().toISOString();
          updatedCount++;
        }
      });
    }

    return Response.json({
      success: true,
      message: `成功${action === 'delete' ? '删除' : action === 'enable' ? '启用' : '禁用'} ${updatedCount} 个模型`,
      updatedCount
    });

  } catch (error) {
    console.error('批量更新模型状态失败:', error);

    return Response.json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '批量更新模型状态失败',
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }, {
      status: 500
    });
  }
}

// DELETE - 删除模型
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({
        success: false,
        code: 'INVALID_PARAMS',
        message: '模型ID不能为空'
      }, {
        status: 400
      });
    }

    const initialLength = models.length;
    models = models.filter(model => model.id !== id);
    const deleted = initialLength - models.length;

    if (deleted === 0) {
      return Response.json({
        success: false,
        code: 'NOT_FOUND',
        message: '模型不存在'
      }, {
        status: 404
      });
    }

    return Response.json({
      success: true,
      message: '模型已删除',
      deleted
    });

  } catch (error) {
    console.error('删除模型失败:', error);

    return Response.json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: '删除模型失败',
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }, {
      status: 500
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
