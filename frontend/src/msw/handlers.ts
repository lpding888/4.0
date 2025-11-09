/**
 * MSW Mock处理器
 * 艹，本地开发必须用Mock，别总依赖后端！
 *
 * @author 老王
 */

import { http, HttpResponse } from 'msw';
import dayjs from 'dayjs';

export const handlers = [
  // Bootstrap配置
  http.get('/api/ui/bootstrap', () => {
    return HttpResponse.json({
      version: 1,
      menus: [],
      tools: [],
      uiSchema: {},
      templates: []
    });
  }),

  // 模板列表（空数据）
  http.get('/api/templates', () => {
    return HttpResponse.json({
      items: [],
      page: 1,
      total: 0,
      pageSize: 20
    });
  }),

  // 测试环境性能指标上报
  http.post('/__metrics', () => {
    return HttpResponse.json({ success: true });
  }),

  // 获取可用模型列表
  http.get('/api/ai/models', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const provider = url.searchParams.get('provider');
    const includeStats = url.searchParams.get('includeStats') === 'true';

    const models = [
      { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', maxTokens: 8192, status: 'available', enabled: true },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', maxTokens: 4096, status: 'available', enabled: true },
      { id: 'claude-3-sonnet', name: 'Claude-3 Sonnet', provider: 'Anthropic', maxTokens: 4096, status: 'available', enabled: true },
      { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', maxTokens: 8192, status: 'testing', enabled: false }
    ];

    let filteredModels = models;

    if (status && status !== 'all') {
      filteredModels = filteredModels.filter(model => model.status === status);
    }

    if (provider) {
      filteredModels = filteredModels.filter(model => model.provider === provider);
    }

    if (includeStats) {
      const stats: Record<string, { totalCalls: number; avgResponseTime: number; successRate: number; lastUsed: string | null }> = {
        'gpt-4': { totalCalls: 1250, avgResponseTime: 2.3, successRate: 98.5, lastUsed: '2分钟前' },
        'gpt-3.5-turbo': { totalCalls: 3420, avgResponseTime: 1.1, successRate: 99.2, lastUsed: '刚刚' },
        'claude-3-sonnet': { totalCalls: 890, avgResponseTime: 1.8, successRate: 97.8, lastUsed: '15分钟前' },
        'gemini-pro': { totalCalls: 45, avgResponseTime: 3.2, successRate: 95.5, lastUsed: '2小时前' }
      };

      filteredModels = filteredModels.map(model => ({
        ...model,
        stats: stats[model.id] || { totalCalls: 0, avgResponseTime: 0, successRate: 0, lastUsed: null }
      }));
    }

    return HttpResponse.json({
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
  }),

  // 聊天SSE接口（主要聊天接口）
  http.post('/api/ai/chat', async ({ request }) => {
    const body = await request.json() as any;
    const { message, model = 'gpt-3.5-turbo', sessionId } = body;

    // 模拟错误情况（10%概率）
    if (Math.random() < 0.1) {
      return HttpResponse.json({
        code: 'MODEL_UNAVAILABLE',
        message: '模型暂时不可用，请稍后重试',
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }, { status: 503 });
    }

    // 根据不同模型生成不同的回复
    const responses: Record<string, string[]> = {
      'gpt-4': [
        '这是一个复杂的问题，让我仔细分析一下...',
        '基于我的理解，我认为可以从以下几个角度来看待这个问题...',
        '总的来说，这需要综合考虑多个因素。'
      ],
      'gpt-3.5-turbo': [
        '你好！我是AI助手，很高兴为您服务。',
        '关于您提到的内容，我想说的是...',
        '希望我的回答对您有帮助！'
      ],
      'claude-3-sonnet': [
        '我理解您的问题。让我来详细解答...',
        '从技术角度来看，这个问题涉及到...',
        '我的分析就到这里，希望对您有用。'
      ],
      'gemini-pro': [
        '感谢您的提问！让我来帮助您解决这个问题。',
        '根据我的分析，建议您可以考虑以下方案...',
        '如果您还有其他问题，随时可以问我。'
      ]
    };

    const responseText = (responses[model] || responses['gpt-3.5-turbo']) as string[];

    // 返回SSE流
    const stream = new ReadableStream({
      start(controller) {
        // 模拟逐字输出
        responseText.forEach((text, index) => {
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(`data: {"text": "${text}", "sessionId": "${sessionId}"}\n\n`));

            // 最后一条消息
            if (index === responseText.length - 1) {
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                controller.close();
              }, 500);
            }
          }, (index + 1) * 800 + Math.random() * 500);
        });
      }
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

  // 停止生成接口
  http.post('/api/ai/chat/stop', async ({ request }) => {
    return HttpResponse.json({ success: true });
  }),

  // 模型管理接口 - 创建/更新模型配置
  http.post('/api/ai/models', async ({ request }) => {
    const body = await request.json() as any;
    const { id, ...config } = body;

    // 模拟保存配置
    console.log('保存模型配置:', id, config);

    return HttpResponse.json({
      success: true,
      message: id ? '模型配置已更新' : '新模型已创建',
      data: {
        id: id || `model_${Date.now()}`,
        ...config,
        status: 'testing',
        enabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  }),

  // 模型管理接口 - 批量更新状态
  http.put('/api/ai/models', async ({ request }) => {
    const body = await request.json() as any;
    const { modelIds, action } = body;

    if (!modelIds || !Array.isArray(modelIds)) {
      return HttpResponse.json({
        success: false,
        code: 'INVALID_PARAMS',
        message: '模型ID列表不能为空'
      }, { status: 400 });
    }

    console.log('批量更新模型状态:', modelIds, action);

    return HttpResponse.json({
      success: true,
      message: `成功${action === 'enable' ? '启用' : action === 'disable' ? '禁用' : '删除'} ${modelIds.length} 个模型`,
      updatedCount: modelIds.length
    });
  }),

  // 模型管理接口 - 删除模型
  http.delete('/api/ai/models', ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return HttpResponse.json({
        success: false,
        code: 'INVALID_PARAMS',
        message: '模型ID不能为空'
      }, { status: 400 });
    }

    console.log('删除模型:', id);

    return HttpResponse.json({
      success: true,
      message: '模型已删除',
      deleted: 1
    });
  }),

  // 知识库文档列表
  http.get('/api/admin/kb/documents', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');

    const documents = [
      {
        id: 'doc_001',
        name: 'AI产品设计规范.pdf',
        type: 'pdf',
        size: 2048576,
        status: 'completed',
        progress: 100,
        chunks: 156,
        uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        processedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
        metadata: { pageCount: 45, wordCount: 12500, language: 'zh-CN' }
      },
      {
        id: 'doc_002',
        name: '用户体验设计指南.docx',
        type: 'docx',
        size: 1024000,
        status: 'completed',
        progress: 100,
        chunks: 89,
        uploadedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        processedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
        metadata: { pageCount: 32, wordCount: 8900, language: 'zh-CN' }
      },
      {
        id: 'doc_003',
        name: 'API接口文档.md',
        type: 'md',
        size: 512000,
        status: 'processing',
        progress: 75,
        chunks: 45,
        uploadedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        metadata: { wordCount: 5600, language: 'zh-CN' }
      },
      {
        id: 'doc_004',
        name: '系统架构说明.txt',
        type: 'txt',
        size: 256000,
        status: 'failed',
        progress: 30,
        chunks: 0,
        uploadedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        errorMessage: '文件格式不支持或文件损坏'
      }
    ];

    let filteredDocuments = documents;

    if (search) {
      const searchLower = search.toLowerCase();
      filteredDocuments = filteredDocuments.filter(doc =>
        doc.name.toLowerCase().includes(searchLower)
      );
    }

    if (status) {
      filteredDocuments = filteredDocuments.filter(doc => doc.status === status);
    }

    const total = filteredDocuments.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

    return HttpResponse.json({
      success: true,
      data: {
        documents: paginatedDocuments,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      }
    });
  }),

  // 知识库统计
  http.get('/api/admin/kb/stats', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'queue';

    if (type === 'queue') {
      return HttpResponse.json({
        success: true,
        data: {
          pending: 3,
          processing: 2,
          completed: 156,
          failed: 2,
          avgProcessingTime: 45.6,
          throughput: 12.5
        }
      });
    } else if (type === 'system') {
      return HttpResponse.json({
        success: true,
        data: {
          totalDocuments: 163,
          totalChunks: 2456,
          totalSize: 52428800,
          avgChunksPerDoc: 15.1,
          processingRate: 89.5,
          successRate: 95.2
        }
      });
    } else {
      return HttpResponse.json({
        success: true,
        data: {
          queue: { pending: 3, processing: 2, completed: 156, failed: 2, avgProcessingTime: 45.6, throughput: 12.5 },
          system: { totalDocuments: 163, totalChunks: 2456, totalSize: 52428800, avgChunksPerDoc: 15.1, processingRate: 89.5, successRate: 95.2 }
        }
      });
    }
  }),

  // COS配置获取
  http.get('/api/admin/kb/cos-config', () => {
    return HttpResponse.json({
      success: true,
      data: {
        region: 'ap-shanghai',
        bucket: 'my-kb-bucket',
        sessionId: `cos_session_${Date.now()}`,
        startTime: Date.now(),
        expiredTime: Date.now() + 3600000,
        credentials: {
          tmpSecretId: 'mock_secret_id',
          tmpSecretKey: 'mock_secret_key',
          sessionToken: 'mock_session_token'
        }
      }
    });
  }),

  // 上传回调处理
  http.post('/api/admin/kb/upload-callback', async ({ request }) => {
    const body = await request.json() as any;
    console.log('上传回调:', body);

    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return HttpResponse.json({
      success: true,
      message: '文件处理已开始',
      data: { documentId }
    });
  }),

  // 知识库检索
  http.post('/api/admin/kb/search', async ({ request }) => {
    const body = await request.json() as any;
    const { query, topK = 5, threshold = 0.7 } = body;

    const knowledgeChunks = [
      {
        content: '人工智能（AI）是计算机科学的一个分支，致力于创建能够执行通常需要人类智能的任务的系统。',
        documentName: 'AI产品设计规范.pdf',
        chunkIndex: 0
      },
      {
        content: '机器学习是人工智能的核心技术之一，通过算法让计算机从数据中学习规律。',
        documentName: 'AI产品设计规范.pdf',
        chunkIndex: 1
      },
      {
        content: '用户体验设计是以用户为中心的设计方法，旨在创造有用、可用且令人愉快的产品。',
        documentName: '用户体验设计指南.docx',
        chunkIndex: 5
      }
    ];

    const queryLower = query.toLowerCase();
    const results = knowledgeChunks
      .map(chunk => {
        let score = 0;
        const queryWords = queryLower.split(/\s+/);
        const contentWords = chunk.content.toLowerCase().split(/\s+/);
        const overlap = queryWords.filter((word: string) =>
          contentWords.some((contentWord: string) => contentWord.includes(word))
        ).length;
        score = overlap / queryWords.length + Math.random() * 0.2;

        return { ...chunk, score: Math.min(score, 1.0) };
      })
      .filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return HttpResponse.json({
      success: true,
      data: { results, query, totalFound: results.length, searchTime: Math.random() * 100 + 50, threshold }
    });
  }),

  // ========== BILL-F-01: 配额&套餐 Mock接口 ==========

  /**
   * 获取用户配额信息
   */
  http.get('/api/account/quota', () => {
    return HttpResponse.json({
      success: true,
      quota: {
        plan_type: 'free',
        plan_name: '免费版',
        total_quota: 100,
        used_quota: 35,
        remaining_quota: 65,
        quota_reset_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15天后重置
        plan_expires_at: null, // 免费版不过期
        is_trial: false,
        can_upgrade: true,
      },
    });
  }),

  /**
   * 消费配额
   */
  http.post('/api/account/quota/consume', async ({ request }) => {
    const body = (await request.json()) as any;
    const { action_type, quota_cost = 1 } = body;

    // 模拟配额消费成功
    return HttpResponse.json({
      success: true,
      message: '配额消费成功',
      quota: {
        plan_type: 'free',
        plan_name: '免费版',
        total_quota: 100,
        used_quota: 36, // 消费后的值
        remaining_quota: 64,
        quota_reset_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        plan_expires_at: null,
        is_trial: false,
        can_upgrade: true,
      },
      action_type,
      quota_cost,
    });
  }),

  /**
   * 获取套餐列表
   */
  http.get('/api/billing/plans', () => {
    return HttpResponse.json({
      success: true,
      plans: [
        {
          plan_type: 'free',
          plan_name: '免费版',
          price: 0,
          quota: 100,
          features: [
            '每月 100 次生成额度',
            '基础 AI 模型',
            '标准图片质量',
            '社区支持',
            '基础模板库',
          ],
          color: '#52c41a',
        },
        {
          plan_type: 'pro',
          plan_name: '专业版',
          price: 99,
          original_price: 199,
          quota: 1000,
          features: [
            '每月 1000 次生成额度',
            '高级 AI 模型',
            '高清图片质量',
            '优先客服支持',
            '完整模板库',
            '无水印导出',
            '批量处理功能',
          ],
          is_popular: true,
          color: '#1890ff',
        },
        {
          plan_type: 'enterprise',
          plan_name: '企业版',
          price: 999,
          quota: 10000,
          features: [
            '每月 10000 次生成额度',
            '顶级 AI 模型',
            '超清图片质量',
            '专属客服支持',
            '定制模板开发',
            'API 接口访问',
            '团队协作功能',
            '数据统计分析',
            '私有化部署',
          ],
          color: '#722ed1',
        },
      ],
    });
  }),

  /**
   * 购买套餐
   */
  http.post('/api/billing/purchase', async ({ request }) => {
    const body = (await request.json()) as any;
    const { plan_type } = body;

    // 模拟购买成功，返回新的配额信息
    const quotaMap: Record<string, any> = {
      free: {
        plan_type: 'free',
        plan_name: '免费版',
        total_quota: 100,
        used_quota: 0,
        remaining_quota: 100,
      },
      pro: {
        plan_type: 'pro',
        plan_name: '专业版',
        total_quota: 1000,
        used_quota: 0,
        remaining_quota: 1000,
      },
      enterprise: {
        plan_type: 'enterprise',
        plan_name: '企业版',
        total_quota: 10000,
        used_quota: 0,
        remaining_quota: 10000,
      },
    };

    return HttpResponse.json({
      success: true,
      message: '购买成功',
      quota: {
        ...quotaMap[plan_type],
        quota_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        is_trial: false,
        can_upgrade: plan_type !== 'enterprise',
      },
      order_id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
  }),

  // ========== BILL-F-02: 订单/发票 Mock接口 ==========

  /**
   * 获取订单列表
   */
  http.get('/api/billing/orders', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // Mock订单数据
    const allOrders = [
      {
        order_id: 'order_1701234567890_abc123',
        plan_type: 'pro',
        plan_name: '专业版',
        amount: 99,
        status: 'paid',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        paid_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
        payment_method: '微信支付',
        invoice_url: '/invoices/order_1701234567890_abc123.pdf',
        has_invoice: true,
      },
      {
        order_id: 'order_1701134567890_def456',
        plan_type: 'pro',
        plan_name: '专业版',
        amount: 99,
        status: 'paid',
        created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        paid_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
        payment_method: '支付宝',
        invoice_url: '/invoices/order_1701134567890_def456.pdf',
        has_invoice: true,
      },
      {
        order_id: 'order_1700934567890_ghi789',
        plan_type: 'enterprise',
        plan_name: '企业版',
        amount: 999,
        status: 'pending',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        payment_method: undefined,
        invoice_url: undefined,
        has_invoice: false,
      },
      {
        order_id: 'order_1700834567890_jkl012',
        plan_type: 'pro',
        plan_name: '专业版',
        amount: 99,
        status: 'failed',
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        payment_method: undefined,
        invoice_url: undefined,
        has_invoice: false,
      },
      {
        order_id: 'order_1700734567890_mno345',
        plan_type: 'pro',
        plan_name: '专业版',
        amount: 99,
        status: 'refunded',
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        paid_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
        payment_method: '微信支付',
        invoice_url: undefined,
        has_invoice: false,
      },
    ];

    // 筛选订单
    let filteredOrders = allOrders;

    if (status && status !== 'all') {
      filteredOrders = filteredOrders.filter((order) => order.status === status);
    }

    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      filteredOrders = filteredOrders.filter((order) => {
        const created = new Date(order.created_at).getTime();
        return created >= start && created <= end;
      });
    }

    // 计算统计数据
    const stats = {
      total_orders: allOrders.length,
      total_amount: allOrders.reduce((sum, order) => sum + order.amount, 0),
      paid_orders: allOrders.filter((order) => order.status === 'paid').length,
      pending_orders: allOrders.filter((order) => order.status === 'pending').length,
    };

    return HttpResponse.json({
      success: true,
      orders: filteredOrders,
      stats,
      total: filteredOrders.length,
    });
  }),

  /**
   * 下载发票PDF
   */
  http.get('/api/billing/invoice/:orderId', async ({ params }) => {
    const { orderId } = params;

    // 模拟生成PDF（实际应返回PDF Blob）
    // 这里返回一个简单的文本文件作为演示
    const pdfContent = `
发票编号: ${orderId}
开票日期: ${new Date().toLocaleDateString('zh-CN')}
购买方: AI衣柜用户
金额: ¥99.00
套餐: 专业版

本发票为电子发票，与纸质发票具有同等法律效力。

AI衣柜科技有限公司
联系电话: 400-XXX-XXXX
    `.trim();

    const blob = new Blob([pdfContent], { type: 'application/pdf' });

    return new HttpResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice_${orderId}.pdf"`,
      },
    });
  }),

  // ========== GROW-F-03: 邀请/分销闭环 Mock接口 ==========

  /**
   * 获取邀请统计数据
   */
  http.get('/api/referral/stats', () => {
    return HttpResponse.json({
      success: true,
      stats: {
        total_invites: 25, // 总邀请数
        successful_invites: 18, // 成功邀请数
        total_commission: 1580.5, // 总佣金
        available_balance: 860.3, // 可提现余额
        pending_commission: 420.2, // 待结算佣金
        withdrawn_amount: 300.0, // 已提现金额
      },
      referral_code: 'REF2024ABC123',
      referral_link: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/register?ref=REF2024ABC123`,
    });
  }),

  /**
   * 获取佣金记录
   */
  http.get('/api/referral/commissions', () => {
    const records = [
      {
        id: 'comm_001',
        invited_user_email: 'user1@example.com',
        order_id: 'order_1701234567890_abc123',
        order_amount: 99,
        commission_amount: 9.9,
        commission_rate: 10,
        status: 'withdrawn',
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        settled_at: new Date(Date.now() - 53 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'comm_002',
        invited_user_email: 'user2@example.com',
        order_id: 'order_1701234567891_def456',
        order_amount: 999,
        commission_amount: 99.9,
        commission_rate: 10,
        status: 'settled',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        settled_at: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'comm_003',
        invited_user_email: 'user3@example.com',
        order_id: 'order_1701234567892_ghi789',
        order_amount: 99,
        commission_amount: 9.9,
        commission_rate: 10,
        status: 'settled',
        created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        settled_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'comm_004',
        invited_user_email: 'user4@example.com',
        order_id: 'order_1701234567893_jkl012',
        order_amount: 99,
        commission_amount: 9.9,
        commission_rate: 10,
        status: 'pending',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'comm_005',
        invited_user_email: 'user5@example.com',
        order_id: 'order_1701234567894_mno345',
        order_amount: 999,
        commission_amount: 99.9,
        commission_rate: 10,
        status: 'pending',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    return HttpResponse.json({
      success: true,
      records,
      total: records.length,
    });
  }),

  /**
   * 获取提现记录
   */
  http.get('/api/referral/withdrawals', () => {
    const records = [
      {
        id: 'withdraw_001',
        amount: 300.0,
        status: 'completed',
        payment_method: '支付宝',
        payment_account: 'user@example.com',
        created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        processed_at: new Date(Date.now() - 37 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'withdraw_002',
        amount: 500.0,
        status: 'processing',
        payment_method: '微信',
        payment_account: 'wxid_abc123',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'withdraw_003',
        amount: 150.0,
        status: 'rejected',
        payment_method: '银行卡',
        payment_account: '6222 **** **** 1234',
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        processed_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        reject_reason: '账户信息有误',
      },
    ];

    return HttpResponse.json({
      success: true,
      records,
      total: records.length,
    });
  }),

  /**
   * 提交提现申请
   */
  http.post('/api/referral/withdraw', async ({ request }) => {
    const body = (await request.json()) as any;
    const { amount, payment_method, payment_account, real_name, bank_name } = body;

    // 模拟提现申请成功
    return HttpResponse.json({
      success: true,
      message: '提现申请已提交',
      withdrawal: {
        id: `withdraw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        status: 'pending',
        payment_method: payment_method === 'alipay' ? '支付宝' : payment_method === 'wechat' ? '微信' : '银行卡',
        payment_account,
        created_at: new Date().toISOString(),
      },
    });
  }),

  // ==================== A/B实验接口 ====================

  /**
   * 获取实验列表
   */
  http.get('/api/admin/experiments', () => {
    const experiments = [
      {
        id: 'template_sort_experiment',
        name: '模板排序实验',
        description: '测试不同排序方式对用户模板点击率和使用率的影响',
        status: 'running',
        traffic_allocation: 100,
        variants: [
          { id: 'control', name: '对照组（时间排序）', weight: 34, config: { sort_method: 'time' } },
          { id: 'variant_a', name: '实验组A（热门排序）', weight: 33, config: { sort_method: 'popularity' } },
          { id: 'variant_b', name: '实验组B（推荐排序）', weight: 33, config: { sort_method: 'recommendation' } },
        ],
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        creator: 'admin',
        metrics: {
          exposure_count: 15823,
          conversion_count: 2347,
          conversion_rate: 0.1483,
        },
      },
      {
        id: 'pricing_page_test',
        name: '定价页面文案实验',
        description: '测试不同文案对用户购买转化率的影响',
        status: 'completed',
        traffic_allocation: 50,
        variants: [
          { id: 'control', name: '原始文案', weight: 50, config: {} },
          { id: 'variant_a', name: '强调价值', weight: 50, config: {} },
        ],
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        creator: 'admin',
        metrics: {
          exposure_count: 8456,
          conversion_count: 678,
          conversion_rate: 0.0802,
        },
      },
      {
        id: 'onboarding_flow_test',
        name: '新手引导流程优化',
        description: '测试简化版新手引导对用户完成率的影响',
        status: 'paused',
        traffic_allocation: 80,
        variants: [
          { id: 'control', name: '完整引导', weight: 50, config: {} },
          { id: 'variant_a', name: '简化引导', weight: 50, config: {} },
        ],
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        creator: 'admin',
        metrics: {
          exposure_count: 3421,
          conversion_count: 1876,
          conversion_rate: 0.5485,
        },
      },
      {
        id: 'button_color_test',
        name: '按钮颜色测试',
        description: '测试不同按钮颜色对点击率的影响',
        status: 'draft',
        traffic_allocation: 100,
        variants: [
          { id: 'control', name: '蓝色按钮', weight: 50, config: { button_color: 'blue' } },
          { id: 'variant_a', name: '绿色按钮', weight: 50, config: { button_color: 'green' } },
        ],
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        creator: 'admin',
      },
    ];

    return HttpResponse.json({
      success: true,
      experiments,
      total: experiments.length,
    });
  }),

  /**
   * 创建实验
   */
  http.post('/api/admin/experiments', async ({ request }) => {
    const body = (await request.json()) as any;

    // 模拟创建成功
    return HttpResponse.json({
      success: true,
      message: '实验创建成功',
      experiment: {
        id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        creator: 'admin',
      },
    });
  }),

  /**
   * 更新实验
   */
  http.put('/api/admin/experiments/:experimentId', async ({ request, params }) => {
    const body = (await request.json()) as any;
    const { experimentId } = params;

    // 模拟更新成功
    return HttpResponse.json({
      success: true,
      message: '实验更新成功',
      experiment: {
        id: experimentId,
        ...body,
        updated_at: new Date().toISOString(),
      },
    });
  }),

  /**
   * 删除实验
   */
  http.delete('/api/admin/experiments/:experimentId', ({ params }) => {
    const { experimentId } = params;

    // 模拟删除成功
    return HttpResponse.json({
      success: true,
      message: '实验已删除',
    });
  }),

  /**
   * 启动实验
   */
  http.post('/api/admin/experiments/:experimentId/start', ({ params }) => {
    const { experimentId } = params;

    // 模拟启动成功
    return HttpResponse.json({
      success: true,
      message: '实验已启动',
      experiment: {
        id: experimentId,
        status: 'running',
        start_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  }),

  /**
   * 暂停实验
   */
  http.post('/api/admin/experiments/:experimentId/pause', ({ params }) => {
    const { experimentId } = params;

    // 模拟暂停成功
    return HttpResponse.json({
      success: true,
      message: '实验已暂停',
      experiment: {
        id: experimentId,
        status: 'paused',
        updated_at: new Date().toISOString(),
      },
    });
  }),

  /**
   * 完成实验
   */
  http.post('/api/admin/experiments/:experimentId/complete', ({ params }) => {
    const { experimentId } = params;

    // 模拟完成成功
    return HttpResponse.json({
      success: true,
      message: '实验已完成',
      experiment: {
        id: experimentId,
        status: 'completed',
        end_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  }),

  /**
   * 获取实验详细数据
   */
  http.get('/api/admin/experiments/:experimentId/metrics', ({ params }) => {
    const { experimentId } = params;

    // 模拟实验数据
    const metrics = {
      experiment: {
        id: experimentId,
        name: '模板排序实验',
        description: '测试不同排序方式对用户模板点击率和使用率的影响',
        status: 'running',
        traffic_allocation: 100,
        variants: [
          { id: 'control', name: '对照组（时间排序）', weight: 34 },
          { id: 'variant_a', name: '实验组A（热门排序）', weight: 33 },
          { id: 'variant_b', name: '实验组B（推荐排序）', weight: 33 },
        ],
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        start_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
      variants_metrics: [
        {
          variant_id: 'control',
          variant_name: '对照组（时间排序）',
          exposure_count: 5380,
          conversion_count: 754,
          conversion_rate: 0.1401,
          avg_value: 58.32,
          confidence: 0,
          is_winner: false,
        },
        {
          variant_id: 'variant_a',
          variant_name: '实验组A（热门排序）',
          exposure_count: 5221,
          conversion_count: 823,
          conversion_rate: 0.1576,
          avg_value: 62.45,
          confidence: 96.8,
          is_winner: true,
        },
        {
          variant_id: 'variant_b',
          variant_name: '实验组B（推荐排序）',
          exposure_count: 5222,
          conversion_count: 770,
          conversion_rate: 0.1474,
          avg_value: 59.87,
          confidence: 72.3,
          is_winner: false,
        },
      ],
      total_exposure: 15823,
      total_conversion: 2347,
      duration_days: 15,
      statistical_significance: 96.8,
    };

    return HttpResponse.json({
      success: true,
      ...metrics,
    });
  }),

  /**
   * 上报实验曝光
   */
  http.post('/api/experiments/exposure', async ({ request }) => {
    const body = (await request.json()) as any;
    const { experiment_id, variant_id, user_id, session_id } = body;

    // 模拟上报成功
    return HttpResponse.json({
      success: true,
    });
  }),

  /**
   * 上报实验转化
   */
  http.post('/api/experiments/conversion', async ({ request }) => {
    const body = (await request.json()) as any;
    const { experiment_id, variant_id, event_name, event_value, user_id, session_id } = body;

    // 模拟上报成功
    return HttpResponse.json({
      success: true,
    });
  }),

  // ==================== 用户反馈接口 ====================

  /**
   * 提交反馈
   */
  http.post('/api/feedback/submit', async ({ request }) => {
    const formData = await request.formData();
    const nps_score = formData.get('nps_score');
    const feedback_type = formData.get('feedback_type');
    const title = formData.get('title');
    const content = formData.get('content');
    const contact = formData.get('contact');

    // 模拟提交成功
    return HttpResponse.json({
      success: true,
      message: '反馈提交成功',
      feedback: {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        nps_score: nps_score ? parseInt(nps_score as string) : undefined,
        feedback_type,
        title,
        content,
        contact,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    });
  }),

  /**
   * 获取NPS统计
   */
  http.get('/api/admin/feedback/nps-stats', () => {
    // 模拟NPS统计数据
    const stats = {
      total_responses: 485, // 总回复数
      promoters: 312, // 推荐者（9-10分）
      passives: 98, // 中立者（7-8分）
      detractors: 75, // 贬损者（0-6分）
      promoter_percentage: 64.3, // 推荐者百分比
      passive_percentage: 20.2, // 中立者百分比
      detractor_percentage: 15.5, // 贬损者百分比
      nps_score: 48.8, // NPS = 64.3 - 15.5 = 48.8
      avg_score: 7.8, // 平均分
      trend: 'up', // 趋势
      trend_percentage: 5.2, // 趋势百分比（相比上月）
    };

    return HttpResponse.json({
      success: true,
      stats,
    });
  }),

  /**
   * 获取反馈记录
   */
  http.get('/api/admin/feedback/records', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const allRecords = [
      {
        id: 'fb_001',
        user_id: 'user_123',
        user_email: 'user@example.com',
        nps_score: 10,
        feedback_type: 'praise',
        title: '产品非常好用！',
        content: '界面美观，功能强大，使用体验非常棒！希望继续保持！',
        contact: 'user@example.com',
        screenshots: [],
        status: 'resolved',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        resolved_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        resolver: 'admin',
        resolution: '感谢您的肯定！',
      },
      {
        id: 'fb_002',
        user_id: 'user_456',
        user_email: 'feedback@example.com',
        nps_score: 3,
        feedback_type: 'bug',
        title: '模板加载失败',
        content: '点击模板后一直显示加载中，无法正常使用。浏览器：Chrome 最新版。',
        contact: '13800138000',
        screenshots: [],
        status: 'processing',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'fb_003',
        user_id: 'user_789',
        user_email: 'suggest@example.com',
        nps_score: 8,
        feedback_type: 'feature',
        title: '建议增加批量导出功能',
        content: '希望能支持批量选择模板进行导出，而不是一个一个下载。',
        status: 'pending',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'fb_004',
        user_id: 'user_321',
        user_email: 'improve@example.com',
        nps_score: 7,
        feedback_type: 'improvement',
        title: '模板分类可以更细致',
        content: '当前分类比较粗糙，建议增加二级分类，方便用户查找。',
        contact: 'improve@example.com',
        screenshots: [],
        status: 'pending',
        created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'fb_005',
        user_id: 'user_654',
        user_email: 'complaint@example.com',
        nps_score: 5,
        feedback_type: 'complaint',
        title: '会员价格偏高',
        content: '相比同类产品，会员价格偏高，希望能推出更多优惠活动。',
        status: 'pending',
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
    ];

    // 过滤
    let filteredRecords = allRecords;
    if (status && status !== 'all') {
      filteredRecords = filteredRecords.filter((r) => r.status === status);
    }

    return HttpResponse.json({
      success: true,
      records: filteredRecords,
      total: filteredRecords.length,
    });
  }),

  /**
   * 标记反馈为已解决
   */
  http.post('/api/admin/feedback/:feedbackId/resolve', async ({ request, params }) => {
    const { feedbackId } = params;
    const body = (await request.json()) as any;
    const { resolution } = body;

    // 模拟标记成功
    return HttpResponse.json({
      success: true,
      message: '已标记为已解决',
      feedback: {
        id: feedbackId,
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolver: 'admin',
        resolution,
      },
    });
  }),

  // ==================== 转化漏斗分析接口 ====================

  /**
   * 获取转化漏斗数据
   */
  http.get('/api/admin/analytics/funnel', ({ request }) => {
    const url = new URL(request.url);
    const funnelType = url.searchParams.get('funnel_type') || 'purchase';
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // 购买转化漏斗数据
    const purchaseFunnel = {
      funnel_name: '购买转化漏斗',
      date_range: {
        start_date: startDate || dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
        end_date: endDate || dayjs().format('YYYY-MM-DD'),
      },
      steps: [
        {
          name: '访问首页',
          count: 12580,
          conversion_rate: 100,
          overall_conversion_rate: 100,
          drop_count: 0,
          drop_rate: 0,
          avg_time: 45,
        },
        {
          name: '浏览模板',
          count: 8934,
          conversion_rate: 71.01,
          overall_conversion_rate: 71.01,
          drop_count: 3646,
          drop_rate: 28.99,
          avg_time: 125,
        },
        {
          name: '点击生成',
          count: 5245,
          conversion_rate: 58.71,
          overall_conversion_rate: 41.69,
          drop_count: 3689,
          drop_rate: 41.29,
          avg_time: 180,
        },
        {
          name: '查看结果',
          count: 4123,
          conversion_rate: 78.61,
          overall_conversion_rate: 32.77,
          drop_count: 1122,
          drop_rate: 21.39,
          avg_time: 95,
        },
        {
          name: '点击导出',
          count: 2876,
          conversion_rate: 69.76,
          overall_conversion_rate: 22.86,
          drop_count: 1247,
          drop_rate: 30.24,
          avg_time: 60,
        },
        {
          name: '完成支付',
          count: 1523,
          conversion_rate: 52.95,
          overall_conversion_rate: 12.11,
          drop_count: 1353,
          drop_rate: 47.05,
          avg_time: 120,
        },
      ],
      total_conversion_rate: 12.11,
      total_users: 12580,
      converted_users: 1523,
    };

    // 注册转化漏斗数据
    const signupFunnel = {
      funnel_name: '注册转化漏斗',
      date_range: {
        start_date: startDate || dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
        end_date: endDate || dayjs().format('YYYY-MM-DD'),
      },
      steps: [
        {
          name: '访问登录页',
          count: 8520,
          conversion_rate: 100,
          overall_conversion_rate: 100,
          drop_count: 0,
          drop_rate: 0,
          avg_time: 30,
        },
        {
          name: '点击注册',
          count: 6234,
          conversion_rate: 73.17,
          overall_conversion_rate: 73.17,
          drop_count: 2286,
          drop_rate: 26.83,
          avg_time: 15,
        },
        {
          name: '填写信息',
          count: 4567,
          conversion_rate: 73.26,
          overall_conversion_rate: 53.60,
          drop_count: 1667,
          drop_rate: 26.74,
          avg_time: 90,
        },
        {
          name: '验证邮箱',
          count: 3789,
          conversion_rate: 82.96,
          overall_conversion_rate: 44.47,
          drop_count: 778,
          drop_rate: 17.04,
          avg_time: 60,
        },
        {
          name: '完成注册',
          count: 3456,
          conversion_rate: 91.21,
          overall_conversion_rate: 40.56,
          drop_count: 333,
          drop_rate: 8.79,
          avg_time: 20,
        },
      ],
      total_conversion_rate: 40.56,
      total_users: 8520,
      converted_users: 3456,
    };

    // 模板使用漏斗数据
    const templateUsageFunnel = {
      funnel_name: '模板使用漏斗',
      date_range: {
        start_date: startDate || dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
        end_date: endDate || dayjs().format('YYYY-MM-DD'),
      },
      steps: [
        {
          name: '浏览模板库',
          count: 15234,
          conversion_rate: 100,
          overall_conversion_rate: 100,
          drop_count: 0,
          drop_rate: 0,
          avg_time: 60,
        },
        {
          name: '查看模板详情',
          count: 9876,
          conversion_rate: 64.83,
          overall_conversion_rate: 64.83,
          drop_count: 5358,
          drop_rate: 35.17,
          avg_time: 45,
        },
        {
          name: '点击使用模板',
          count: 6543,
          conversion_rate: 66.25,
          overall_conversion_rate: 42.95,
          drop_count: 3333,
          drop_rate: 33.75,
          avg_time: 30,
        },
        {
          name: '编辑内容',
          count: 5234,
          conversion_rate: 79.99,
          overall_conversion_rate: 34.35,
          drop_count: 1309,
          drop_rate: 20.01,
          avg_time: 180,
        },
        {
          name: '完成生成',
          count: 4567,
          conversion_rate: 87.26,
          overall_conversion_rate: 29.98,
          drop_count: 667,
          drop_rate: 12.74,
          avg_time: 120,
        },
      ],
      total_conversion_rate: 29.98,
      total_users: 15234,
      converted_users: 4567,
    };

    // 根据类型返回对应漏斗
    let funnel;
    if (funnelType === 'signup') {
      funnel = signupFunnel;
    } else if (funnelType === 'template_usage') {
      funnel = templateUsageFunnel;
    } else {
      funnel = purchaseFunnel;
    }

    return HttpResponse.json({
      success: true,
      funnel,
    });
  }),

  // ==================== 租户管理 Mock API (ENT-G-01) ====================

  /**
   * 获取当前用户可访问的租户列表
   * GET /api/tenants
   */
  http.get('/api/tenants', () => {
    const tenants = [
      {
        id: 'tenant-personal-001',
        name: '个人空间',
        type: 'personal' as const,
        role: 'owner' as const,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=personal',
        member_count: 1,
        created_at: '2024-01-15T10:30:00Z',
      },
      {
        id: 'tenant-team-002',
        name: '设计团队',
        type: 'team' as const,
        role: 'admin' as const,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=design-team',
        member_count: 8,
        created_at: '2024-02-20T14:20:00Z',
      },
      {
        id: 'tenant-team-003',
        name: '营销部门',
        type: 'team' as const,
        role: 'member' as const,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marketing',
        member_count: 15,
        created_at: '2024-03-10T09:00:00Z',
      },
      {
        id: 'tenant-enterprise-004',
        name: 'ABC科技有限公司',
        type: 'enterprise' as const,
        role: 'owner' as const,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=abc-tech',
        member_count: 120,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'tenant-enterprise-005',
        name: '蓝海集团',
        type: 'enterprise' as const,
        role: 'viewer' as const,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=blue-ocean',
        member_count: 350,
        created_at: '2023-12-01T00:00:00Z',
      },
    ];

    return HttpResponse.json({
      success: true,
      tenants,
    });
  }),

  /**
   * 获取租户详情
   * GET /api/tenants/:tenantId
   */
  http.get('/api/tenants/:tenantId', ({ params }) => {
    const { tenantId } = params;

    // 模拟租户数据
    const tenantMap: Record<string, any> = {
      'tenant-personal-001': {
        id: 'tenant-personal-001',
        name: '个人空间',
        type: 'personal',
        role: 'owner',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=personal',
        member_count: 1,
        created_at: '2024-01-15T10:30:00Z',
        settings: {
          storage_quota: 10 * 1024 * 1024 * 1024, // 10GB
          used_storage: 2.5 * 1024 * 1024 * 1024, // 2.5GB
          allowed_features: ['templates', 'ai_generation', 'basic_export'],
        },
      },
      'tenant-enterprise-004': {
        id: 'tenant-enterprise-004',
        name: 'ABC科技有限公司',
        type: 'enterprise',
        role: 'owner',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=abc-tech',
        member_count: 120,
        created_at: '2024-01-01T00:00:00Z',
        settings: {
          storage_quota: 1 * 1024 * 1024 * 1024 * 1024, // 1TB
          used_storage: 450 * 1024 * 1024 * 1024, // 450GB
          allowed_features: [
            'templates',
            'ai_generation',
            'advanced_export',
            'team_collaboration',
            'sso',
            'audit_logs',
            'api_access',
          ],
        },
      },
    };

    const tenant = tenantMap[tenantId as string];

    if (!tenant) {
      return HttpResponse.json(
        {
          success: false,
          code: 'TENANT_NOT_FOUND',
          message: '租户不存在',
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      tenant,
    });
  }),

  // ==================== 审计日志 Mock API (ENT-G-02) ====================

  /**
   * 批量上报审计事件
   * POST /api/admin/audit/batch
   */
  http.post('/api/admin/audit/batch', async ({ request }) => {
    const body = (await request.json()) as any;
    const { events } = body;

    console.log(`[Audit] 接收到 ${events?.length || 0} 条审计事件`);

    return HttpResponse.json({
      success: true,
      message: '审计事件上报成功',
      count: events?.length || 0,
    });
  }),

  /**
   * 查询审计日志
   * GET /api/admin/audit/logs
   */
  http.get('/api/admin/audit/logs', ({ request }) => {
    const url = new URL(request.url);
    const eventType = url.searchParams.get('event_type');
    const status = url.searchParams.get('status');
    const userEmail = url.searchParams.get('user_email');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '20');

    // 生成模拟日志数据
    const mockLogs = [
      {
        id: 'audit-001',
        event_type: 'user.login',
        user_id: 'user-001',
        user_email: 'admin@example.com',
        tenant_id: 'tenant-enterprise-004',
        action: 'user.login',
        details: { method: 'email', device: 'Chrome on Windows' },
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0...',
        timestamp: dayjs().subtract(1, 'hour').valueOf(),
        status: 'success' as const,
      },
      {
        id: 'audit-002',
        event_type: 'template.create',
        user_id: 'user-002',
        user_email: 'designer@example.com',
        tenant_id: 'tenant-team-002',
        resource_type: 'template',
        resource_id: 'tpl-001',
        action: 'template.create',
        details: { name: '产品展示模板', category: '电商' },
        ip_address: '192.168.1.101',
        timestamp: dayjs().subtract(2, 'hour').valueOf(),
        status: 'success' as const,
      },
      {
        id: 'audit-003',
        event_type: 'user.delete',
        user_id: 'user-001',
        user_email: 'admin@example.com',
        tenant_id: 'tenant-enterprise-004',
        resource_type: 'user',
        resource_id: 'user-999',
        action: 'user.delete',
        details: { reason: '账号违规' },
        ip_address: '192.168.1.100',
        timestamp: dayjs().subtract(3, 'hour').valueOf(),
        status: 'success' as const,
      },
      {
        id: 'audit-004',
        event_type: 'billing.purchase',
        user_id: 'user-003',
        user_email: 'customer@example.com',
        tenant_id: 'tenant-personal-001',
        resource_type: 'order',
        resource_id: 'order-001',
        action: 'billing.purchase',
        details: { plan: 'Pro', amount: 299, currency: 'CNY' },
        ip_address: '192.168.1.102',
        timestamp: dayjs().subtract(5, 'hour').valueOf(),
        status: 'success' as const,
      },
      {
        id: 'audit-005',
        event_type: 'config.update',
        user_id: 'user-001',
        user_email: 'admin@example.com',
        tenant_id: 'tenant-enterprise-004',
        resource_type: 'config',
        resource_id: 'cfg-api',
        action: 'config.update',
        details: { key: 'api.rate_limit', old_value: 100, new_value: 200 },
        ip_address: '192.168.1.100',
        timestamp: dayjs().subtract(1, 'day').valueOf(),
        status: 'success' as const,
      },
      {
        id: 'audit-006',
        event_type: 'tenant.switch',
        user_id: 'user-002',
        user_email: 'designer@example.com',
        tenant_id: 'tenant-team-003',
        action: 'tenant.switch',
        details: { from: 'tenant-team-002', to: 'tenant-team-003' },
        ip_address: '192.168.1.101',
        timestamp: dayjs().subtract(2, 'day').valueOf(),
        status: 'success' as const,
      },
      {
        id: 'audit-007',
        event_type: 'template.delete',
        user_id: 'user-002',
        user_email: 'designer@example.com',
        tenant_id: 'tenant-team-002',
        resource_type: 'template',
        resource_id: 'tpl-999',
        action: 'template.delete',
        details: { name: '旧模板' },
        ip_address: '192.168.1.101',
        timestamp: dayjs().subtract(3, 'day').valueOf(),
        status: 'failure' as const,
        error_message: '模板正在使用中，无法删除',
      },
      {
        id: 'audit-008',
        event_type: 'data.export',
        user_id: 'user-001',
        user_email: 'admin@example.com',
        tenant_id: 'tenant-enterprise-004',
        action: 'data.export',
        details: { type: 'user_list', format: 'csv', count: 1250 },
        ip_address: '192.168.1.100',
        timestamp: dayjs().subtract(4, 'day').valueOf(),
        status: 'success' as const,
      },
    ];

    // 筛选
    let filteredLogs = [...mockLogs];

    if (eventType && eventType !== 'all') {
      filteredLogs = filteredLogs.filter((log) => log.event_type === eventType);
    }

    if (status && status !== 'all') {
      filteredLogs = filteredLogs.filter((log) => log.status === status);
    }

    if (userEmail) {
      filteredLogs = filteredLogs.filter((log) =>
        log.user_email.toLowerCase().includes(userEmail.toLowerCase())
      );
    }

    // 统计
    const stats = {
      total: mockLogs.length,
      success: mockLogs.filter((log) => log.status === 'success').length,
      failure: mockLogs.filter((log) => log.status === 'failure').length,
      today: mockLogs.filter((log) =>
        dayjs(log.timestamp).isAfter(dayjs().startOf('day'))
      ).length,
    };

    // 分页
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedLogs = filteredLogs.slice(start, end);

    return HttpResponse.json({
      success: true,
      logs: paginatedLogs,
      total: filteredLogs.length,
      page,
      page_size: pageSize,
      stats,
    });
  }),

  /**
   * 导出审计日志为CSV
   * GET /api/admin/audit/export
   */
  http.get('/api/admin/audit/export', () => {
    // 生成CSV内容
    const csv = `时间,事件类型,操作用户,租户ID,资源类型,资源ID,状态,IP地址,详情
2025-11-04 10:30:00,用户登录,admin@example.com,tenant-enterprise-004,,,成功,192.168.1.100,"method: email"
2025-11-04 09:15:00,创建模板,designer@example.com,tenant-team-002,template,tpl-001,成功,192.168.1.101,"name: 产品展示模板"
2025-11-04 08:00:00,删除用户,admin@example.com,tenant-enterprise-004,user,user-999,成功,192.168.1.100,"reason: 账号违规"
2025-11-03 15:30:00,购买套餐,customer@example.com,tenant-personal-001,order,order-001,成功,192.168.1.102,"plan: Pro, amount: 299"
2025-11-03 10:00:00,更新配置,admin@example.com,tenant-enterprise-004,config,cfg-api,成功,192.168.1.100,"api.rate_limit: 100 -> 200"
2025-11-02 14:20:00,切换租户,designer@example.com,tenant-team-003,,,成功,192.168.1.101,"from: tenant-team-002"
2025-11-01 16:45:00,删除模板,designer@example.com,tenant-team-002,template,tpl-999,失败,192.168.1.101,"模板正在使用中"
2025-10-31 11:30:00,导出数据,admin@example.com,tenant-enterprise-004,,,成功,192.168.1.100,"type: user_list, count: 1250"`;

    return new HttpResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit_logs_${dayjs().format('YYYYMMDD')}.csv"`,
      },
    });
  }),

  // ==================== 规则引擎 API ====================

  /**
   * 获取规则列表
   */
  http.get('/api/admin/rules', () => {
    const mockRules = [
      {
        id: 'rule-001',
        name: '低配额用户自动通知',
        description: '当用户配额低于10%时，自动发送通知提醒续费',
        status: 'enabled',
        trigger: {
          type: 'event',
          event_name: 'quota.check',
          throttle: 3600000, // 1小时节流
        },
        conditions: [
          {
            type: 'quota',
            field: 'event_data.usage_percent',
            operator: 'gte',
            value: 90,
          },
        ],
        actions: [
          {
            type: 'notification',
            channel: 'email',
            recipients: ['{{user_email}}'],
            template: 'quota_low_warning',
            data: {
              usage_percent: '{{event_data.usage_percent}}',
              remaining: '{{event_data.remaining}}',
            },
          },
        ],
        priority: 10,
        created_at: Date.now() - 86400000 * 7,
        updated_at: Date.now() - 86400000,
        created_by: 'admin@example.com',
        version: 2,
      },
      {
        id: 'rule-002',
        name: 'NPS低分自动创建工单',
        description: '当用户提交NPS评分 ≤ 3分时，自动创建客服工单',
        status: 'enabled',
        trigger: {
          type: 'event',
          event_name: 'nps.submitted',
        },
        conditions: [
          {
            type: 'attribute',
            field: 'event_data.score',
            operator: 'lte',
            value: 3,
          },
        ],
        actions: [
          {
            type: 'webhook',
            url: 'https://api.example.com/tickets/create',
            method: 'POST',
            headers: {
              'Authorization': 'Bearer {{api_key}}',
            },
            body: {
              title: '低NPS评分用户反馈',
              priority: 'high',
              user_id: '{{user_id}}',
              score: '{{event_data.score}}',
              feedback: '{{event_data.feedback}}',
            },
            timeout: 5000,
            retries: 3,
          },
          {
            type: 'notification',
            channel: 'push',
            recipients: ['support-team'],
            template: 'nps_low_alert',
            data: {
              user_email: '{{user_email}}',
              score: '{{event_data.score}}',
            },
          },
        ],
        priority: 20,
        created_at: Date.now() - 86400000 * 14,
        updated_at: Date.now() - 86400000 * 2,
        created_by: 'admin@example.com',
        version: 3,
      },
      {
        id: 'rule-003',
        name: '高峰期自动降级模型',
        description: '凌晨2点到6点高峰期，自动将默认模型切换到更便宜的版本',
        status: 'enabled',
        trigger: {
          type: 'schedule',
          cron: '0 2 * * *', // 每天凌晨2点
          timezone: 'Asia/Shanghai',
        },
        conditions: [],
        actions: [
          {
            type: 'experiment_toggle',
            experiment_id: 'exp-cheaper-model',
            enabled: true,
          },
          {
            type: 'notification',
            channel: 'webhook',
            recipients: ['ops-team'],
            template: 'model_downgrade_alert',
          },
        ],
        priority: 5,
        created_at: Date.now() - 86400000 * 30,
        updated_at: Date.now() - 86400000 * 5,
        created_by: 'ops@example.com',
        version: 1,
      },
      {
        id: 'rule-004',
        name: '实验自动恢复',
        description: '高峰期结束后，恢复到标准模型配置',
        status: 'enabled',
        trigger: {
          type: 'schedule',
          cron: '0 6 * * *', // 每天早上6点
          timezone: 'Asia/Shanghai',
        },
        conditions: [],
        actions: [
          {
            type: 'experiment_toggle',
            experiment_id: 'exp-cheaper-model',
            enabled: false,
          },
        ],
        priority: 5,
        created_at: Date.now() - 86400000 * 30,
        updated_at: Date.now() - 86400000 * 5,
        created_by: 'ops@example.com',
        version: 1,
      },
      {
        id: 'rule-005',
        name: '新用户欢迎配额奖励',
        description: '新用户首次登录时，自动赠送100次生成配额',
        status: 'disabled',
        trigger: {
          type: 'event',
          event_name: 'user.first_login',
        },
        conditions: [
          {
            type: 'attribute',
            field: 'event_data.is_first_login',
            operator: 'eq',
            value: true,
          },
        ],
        actions: [
          {
            type: 'quota_adjust',
            quota_type: 'generation',
            adjustment: 100,
            reason: '新用户欢迎奖励',
          },
          {
            type: 'notification',
            channel: 'email',
            recipients: ['{{user_email}}'],
            template: 'welcome_bonus',
            data: {
              bonus_amount: 100,
            },
          },
        ],
        priority: 15,
        created_at: Date.now() - 86400000 * 60,
        updated_at: Date.now() - 86400000 * 10,
        created_by: 'marketing@example.com',
        version: 1,
      },
    ];

    return HttpResponse.json({
      success: true,
      rules: mockRules,
    });
  }),

  /**
   * 创建规则
   */
  http.post('/api/admin/rules', async ({ request }) => {
    const rule = (await request.json()) as Record<string, any>;
    console.log('[Rules] 创建规则:', rule);

    return HttpResponse.json({
      success: true,
      rule: {
        ...rule,
        id: rule.id || `rule-${Date.now()}`,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    });
  }),

  /**
   * 更新规则
   */
  http.put('/api/admin/rules', async ({ request }) => {
    const rule = (await request.json()) as Record<string, any>;
    console.log('[Rules] 更新规则:', rule);

    return HttpResponse.json({
      success: true,
      rule: {
        ...rule,
        updated_at: Date.now(),
        version: (rule.version || 0) + 1,
      },
    });
  }),

  /**
   * 删除规则
   */
  http.delete('/api/admin/rules/:ruleId', ({ params }) => {
    const { ruleId } = params;
    console.log('[Rules] 删除规则:', ruleId);

    return HttpResponse.json({
      success: true,
    });
  }),

  /**
   * 批量导入规则
   */
  http.post('/api/admin/rules/batch', async ({ request }) => {
    const { rules } = (await request.json()) as { rules?: any[] };
    console.log(`[Rules] 批量导入 ${rules?.length || 0} 条规则`);

    return HttpResponse.json({
      success: true,
      imported: rules?.length || 0,
    });
  }),

  /**
   * 触发规则测试
   */
  http.post('/api/admin/rules/:ruleId/test', async ({ params, request }) => {
    const { ruleId } = params;
    const context = (await request.json()) as Record<string, any>;
    console.log('[Rules] 测试规则:', ruleId, context);

    return HttpResponse.json({
      success: true,
      result: {
        rule_id: ruleId,
        triggered: true,
        conditions_met: true,
        actions_executed: 2,
        actions_failed: 0,
        duration_ms: 123,
        timestamp: Date.now(),
      },
    });
  }),

  // ==================== 个性化推荐 API ====================

  /**
   * 获取推荐候选
   */
  http.post('/api/reco/candidates', async ({ request }) => {
    const {
      scene,
      limit = 10,
      strategy = 'personalized',
      context
    } = (await request.json()) as {
      scene?: string;
      limit?: number;
      strategy?: string;
      context?: Record<string, any>;
    };

    console.log('[Reco] 获取推荐候选:', { scene, limit, strategy });

    // 根据场景返回不同的Mock数据
    const mockTemplates = [
      { id: 'tpl-001', name: '商业摄影风格', category: '摄影', tags: ['商业', '高端', '简约'], popularity: 950 },
      { id: 'tpl-002', name: '时尚街拍风格', category: '摄影', tags: ['街拍', '时尚', '都市'], popularity: 820 },
      { id: 'tpl-003', name: '复古胶片风格', category: '摄影', tags: ['复古', '胶片', '温暖'], popularity: 760 },
      { id: 'tpl-004', name: '极简主义风格', category: '设计', tags: ['极简', '现代', '几何'], popularity: 890 },
      { id: 'tpl-005', name: '自然光人像', category: '人像', tags: ['自然光', '清新', '柔和'], popularity: 710 },
      { id: 'tpl-006', name: '暗黑哥特风格', category: '艺术', tags: ['暗黑', '哥特', '神秘'], popularity: 650 },
      { id: 'tpl-007', name: '日系小清新', category: '人像', tags: ['日系', '清新', '温柔'], popularity: 880 },
      { id: 'tpl-008', name: '工业风产品摄影', category: '产品', tags: ['工业', '金属', '酷炫'], popularity: 720 },
      { id: 'tpl-009', name: '赛博朋克风格', category: '概念', tags: ['赛博', '未来', '霓虹'], popularity: 910 },
      { id: 'tpl-010', name: '水彩艺术风格', category: '艺术', tags: ['水彩', '梦幻', '柔美'], popularity: 780 },
    ];

    // 根据策略生成推荐
    let items = [];

    if (strategy === 'popular') {
      // 热门推荐：按人气排序
      items = mockTemplates
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit)
        .map((tpl, index) => ({
          id: tpl.id,
          type: 'template',
          score: 1.0 - index * 0.05,
          reason: '热门推荐',
          metadata: tpl,
        }));
    } else if (strategy === 'trending') {
      // 趋势推荐：最近上升快的
      items = mockTemplates
        .filter((tpl) => tpl.tags.includes('时尚') || tpl.tags.includes('赛博') || tpl.tags.includes('未来'))
        .slice(0, limit)
        .map((tpl, index) => ({
          id: tpl.id,
          type: 'template',
          score: 0.95 - index * 0.05,
          reason: '趋势上升',
          metadata: tpl,
        }));
    } else if (strategy === 'embedding') {
      // 基于向量相似度
      items = mockTemplates
        .slice(0, limit)
        .map((tpl, index) => ({
          id: tpl.id,
          type: 'template',
          score: 0.92 - index * 0.03,
          reason: '风格相似',
          metadata: tpl,
        }));
    } else if (strategy === 'collaborative') {
      // 协同过滤：喜欢这个的人也喜欢
      items = mockTemplates
        .slice(2, 2 + limit)
        .map((tpl, index) => ({
          id: tpl.id,
          type: 'template',
          score: 0.88 - index * 0.04,
          reason: '相似用户喜欢',
          metadata: tpl,
        }));
    } else {
      // 个性化推荐：综合策略
      items = mockTemplates
        .slice(0, limit)
        .map((tpl, index) => ({
          id: tpl.id,
          type: 'template',
          score: 0.90 - index * 0.02,
          reason: index < 2 ? '为你推荐' : index < 5 ? '可能喜欢' : '热门推荐',
          metadata: tpl,
        }));
    }

    return HttpResponse.json({
      items,
      strategy,
      timestamp: Date.now(),
      session_id: `reco-session-${Date.now()}`,
    });
  }),

  /**
   * 追踪用户行为
   */
  http.post('/api/reco/track', async ({ request }) => {
    const { events } = (await request.json()) as { events?: any[] };
    console.log(`[Reco] 接收追踪事件: ${events?.length || 0} 条`);

    // 统计事件类型
    const eventStats: Record<string, number> = {};
    events?.forEach((event: any) => {
      const type = event.event_type;
      eventStats[type] = (eventStats[type] || 0) + 1;
    });

    console.log('[Reco] 事件统计:', eventStats);

    return HttpResponse.json({
      success: true,
      received: events?.length || 0,
      stats: eventStats,
    });
  }),

  /**
   * 获取推荐统计
   */
  http.get('/api/reco/stats', () => {
    return HttpResponse.json({
      success: true,
      stats: {
        total_requests: 12543,
        total_tracks: 45678,
        avg_ctr: 0.082, // 点击率 8.2%
        avg_conversion: 0.034, // 转化率 3.4%
        top_scenes: [
          { scene: 'template', requests: 6789, ctr: 0.085 },
          { scene: 'lookbook', requests: 3456, ctr: 0.092 },
          { scene: 'product', requests: 2298, ctr: 0.068 },
        ],
        top_strategies: [
          { strategy: 'personalized', usage: 0.56, ctr: 0.089 },
          { strategy: 'popular', usage: 0.22, ctr: 0.075 },
          { strategy: 'embedding', usage: 0.15, ctr: 0.091 },
          { strategy: 'collaborative', usage: 0.07, ctr: 0.083 },
        ],
      },
    });
  }),

  // ==================== 团队协作 API ====================

  /**
   * 获取评论列表
   */
  http.get('/api/collab/comments', ({ request }) => {
    const url = new URL(request.url);
    const resourceType = url.searchParams.get('resource_type');
    const resourceId = url.searchParams.get('resource_id');

    console.log('[Collab] 获取评论:', { resourceType, resourceId });

    const mockComments = [
      {
        id: 'comment-001',
        user_id: 'user-001',
        user_name: '张三',
        content: '这个模板设计得不错！👍',
        created_at: Date.now() - 3600000,
      },
      {
        id: 'comment-002',
        user_id: 'user-002',
        user_name: '李四',
        content: '@张三 同意，建议优化一下配色方案',
        mentions: ['user-001'],
        created_at: Date.now() - 1800000,
      },
      {
        id: 'comment-003',
        user_id: 'user-003',
        user_name: '王五',
        content: '已经完成优化，请查看最新版本 ✨',
        attachments: [
          { name: 'design-v2.png', url: '/uploads/design-v2.png', size: 1024000 },
        ],
        created_at: Date.now() - 900000,
      },
    ];

    return HttpResponse.json({
      success: true,
      comments: mockComments,
    });
  }),

  /**
   * 创建评论
   */
  http.post('/api/collab/comments', async ({ request }) => {
    const body = (await request.json()) as Record<string, any>;
    console.log('[Collab] 创建评论:', body);

    return HttpResponse.json({
      success: true,
      comment: {
        id: `comment-${Date.now()}`,
        user_id: 'current-user',
        user_name: '当前用户',
        ...body,
        created_at: Date.now(),
      },
    });
  }),

  /**
   * 获取任务分配列表
   */
  http.get('/api/collab/assignments', ({ request }) => {
    const url = new URL(request.url);
    const resourceType = url.searchParams.get('resource_type');
    const resourceId = url.searchParams.get('resource_id');

    console.log('[Collab] 获取任务分配:', { resourceType, resourceId });

    const mockAssignments = [
      {
        id: 'assignment-001',
        assignee_id: 'user-002',
        assignee_name: '李四',
        assigner_id: 'user-001',
        assigner_name: '张三',
        title: '优化模板配色方案',
        status: 'in_progress',
        priority: 'high',
        created_at: Date.now() - 86400000,
      },
      {
        id: 'assignment-002',
        assignee_id: 'user-003',
        assignee_name: '王五',
        assigner_id: 'user-001',
        assigner_name: '张三',
        title: '编写使用文档',
        status: 'pending',
        priority: 'medium',
        created_at: Date.now() - 43200000,
      },
    ];

    return HttpResponse.json({
      success: true,
      assignments: mockAssignments,
    });
  }),

  /**
   * 创建任务分配
   */
  http.post('/api/collab/assignments', async ({ request }) => {
    const body = (await request.json()) as Record<string, any>;
    console.log('[Collab] 创建任务分配:', body);

    return HttpResponse.json({
      success: true,
      assignment: {
        id: `assignment-${Date.now()}`,
        assigner_id: 'current-user',
        assigner_name: '当前用户',
        ...body,
        status: 'pending',
        created_at: Date.now(),
      },
    });
  }),

  /**
   * 更新任务分配
   */
  http.put('/api/collab/assignments/:assignmentId', async ({ params, request }) => {
    const { assignmentId } = params;
    const body = (await request.json()) as Record<string, any>;
    console.log('[Collab] 更新任务分配:', assignmentId, body);

    return HttpResponse.json({
      success: true,
      assignment: {
        id: assignmentId,
        ...body,
        updated_at: Date.now(),
      },
    });
  }),

  /**
   * 获取审批列表
   */
  http.get('/api/collab/approvals', ({ request }) => {
    const url = new URL(request.url);
    const resourceType = url.searchParams.get('resource_type');
    const resourceId = url.searchParams.get('resource_id');

    console.log('[Collab] 获取审批:', { resourceType, resourceId });

    const mockApprovals = [
      {
        id: 'approval-001',
        requester_id: 'user-001',
        requester_name: '张三',
        approvers: [
          { user_id: 'user-004', user_name: '赵六', status: 'approved', updated_at: Date.now() - 3600000 },
          { user_id: 'user-005', user_name: '孙七', status: 'pending' },
        ],
        title: '模板发布审批',
        description: '请审批新模板发布',
        status: 'pending',
        created_at: Date.now() - 86400000,
      },
    ];

    return HttpResponse.json({
      success: true,
      approvals: mockApprovals,
    });
  }),

  /**
   * 获取审批流列表
   */
  http.get('/api/admin/collab/flows', () => {
    const mockFlows = [
      {
        id: 'flow-001',
        name: '模板审批流程',
        description: '模板发布前需要设计主管和产品经理审批',
        resource_type: 'template',
        enabled: true,
        nodes: [
          {
            id: 'node-001',
            name: '设计主管审批',
            type: 'single',
            approvers: ['user-002'],
            timeout_hours: 24,
          },
          {
            id: 'node-002',
            name: '产品经理审批',
            type: 'single',
            approvers: ['user-001'],
            timeout_hours: 48,
          },
        ],
        created_at: Date.now() - 86400000 * 7,
        updated_at: Date.now() - 86400000,
      },
      {
        id: 'flow-002',
        name: '配置变更审批',
        description: '重要配置变更需要技术负责人和运维审批',
        resource_type: 'config',
        enabled: true,
        nodes: [
          {
            id: 'node-003',
            name: '技术负责人审批',
            type: 'single',
            approvers: ['user-003'],
            timeout_hours: 12,
          },
          {
            id: 'node-004',
            name: '运维审批',
            type: 'any',
            approvers: ['user-004', 'user-005'],
            timeout_hours: 6,
          },
        ],
        created_at: Date.now() - 86400000 * 14,
        updated_at: Date.now() - 86400000 * 3,
      },
    ];

    return HttpResponse.json({
      success: true,
      flows: mockFlows,
    });
  }),

  /**
   * 创建审批流
   */
  http.post('/api/admin/collab/flows', async ({ request }) => {
    const flow = (await request.json()) as Record<string, any>;
    console.log('[Collab] 创建审批流:', flow);

    return HttpResponse.json({
      success: true,
      flow: {
        ...flow,
        id: flow.id || `flow-${Date.now()}`,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    });
  }),

  /**
   * 更新审批流
   */
  http.put('/api/admin/collab/flows', async ({ request }) => {
    const flow = (await request.json()) as Record<string, any>;
    console.log('[Collab] 更新审批流:', flow);

    return HttpResponse.json({
      success: true,
      flow: {
        ...flow,
        updated_at: Date.now(),
      },
    });
  }),

  /**
   * 删除审批流
   */
  http.delete('/api/admin/collab/flows/:flowId', ({ params }) => {
    const { flowId } = params;
    console.log('[Collab] 删除审批流:', flowId);

    return HttpResponse.json({
      success: true,
    });
  }),

  // ==================== 插件体系 API ====================

  /**
   * 获取插件清单列表
   */
  http.get('/api/plugins/manifest', () => {
    const mockPlugins = [
      {
        id: 'image-optimizer',
        name: '图片优化器',
        version: '1.2.0',
        description: '自动优化上传的图片，支持压缩、裁剪、格式转换',
        author: '老王工作室',
        homepage: 'https://github.com/example/image-optimizer',
        entry: 'https://cdn.example.com/plugins/image-optimizer.js',
        permissions: ['storage', 'ui', 'file'],
        category: '图片处理',
        icon: undefined,
        enabled: true,
      },
      {
        id: 'ai-assistant',
        name: 'AI智能助手',
        version: '2.0.1',
        description: '基于GPT-4的智能对话助手，帮助生成创意文案',
        author: 'AI Labs',
        homepage: 'https://ai-labs.com/assistant',
        entry: 'https://cdn.example.com/plugins/ai-assistant.js',
        permissions: ['ai', 'storage', 'network', 'ui'],
        category: 'AI工具',
        icon: undefined,
        enabled: true,
      },
      {
        id: 'export-pdf',
        name: 'PDF导出',
        version: '1.0.3',
        description: '将模板和作品导出为高质量PDF文件',
        author: '文档工具团队',
        entry: 'https://cdn.example.com/plugins/export-pdf.js',
        permissions: ['file', 'storage', 'ui'],
        category: '导出工具',
        icon: undefined,
        enabled: false,
      },
      {
        id: 'analytics',
        name: '高级分析',
        version: '1.5.0',
        description: '详细的用户行为分析和数据可视化',
        author: '数据团队',
        entry: 'https://cdn.example.com/plugins/analytics.js',
        permissions: ['network', 'storage', 'ui'],
        category: '数据分析',
        icon: undefined,
        enabled: false,
      },
      {
        id: 'notification-hub',
        name: '通知中心',
        version: '1.1.0',
        description: '集中管理所有通知，支持邮件、短信、推送',
        author: '通知服务',
        entry: 'https://cdn.example.com/plugins/notification-hub.js',
        permissions: ['notification', 'network', 'ui'],
        category: '通知工具',
        icon: undefined,
        enabled: true,
      },
    ];

    return HttpResponse.json({
      success: true,
      plugins: mockPlugins,
    });
  }),

  /**
   * CDN追踪
   */
  http.post('/api/cdn/track', async ({ request }) => {
    const body = (await request.json()) as Record<string, any>;
    console.log('[CDN] 追踪:', body);

    return HttpResponse.json({
      success: true,
    });
  }),

  // ==================== H-07: 向量搜索 ====================

  /**
   * 生成文本embedding
   */
  http.post('/api/vec/embed', async ({ request }) => {
    const body = (await request.json()) as any;
    const { texts, model = 'text-embedding-ada-002' } = body;

    // 模拟embedding生成（实际应调用OpenAI API）
    const embeddings = texts.map(() => {
      return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
    });

    return HttpResponse.json({
      embeddings,
      model,
      dimension: 1536,
      usage: {
        prompt_tokens: texts.join(' ').length,
        total_tokens: texts.join(' ').length,
      },
    });
  }),

  /**
   * 提取图片embedding
   */
  http.post('/api/vec/embed/image', async ({ request }) => {
    const body = (await request.json()) as any;
    const { image_url } = body;

    // 模拟图片embedding
    const embedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

    return HttpResponse.json({
      embedding,
      image_url,
      model: 'clip-vit-base-patch32',
      dimension: 1536,
    });
  }),

  /**
   * 向量搜索
   */
  http.post('/api/vec/search', async ({ request }) => {
    const body = (await request.json()) as any;
    const {
      mode,
      query,
      query_vector,
      color,
      style,
      image_url,
      filters,
      top_k = 20,
      min_score = 0.0,
    } = body;

    // Mock搜索结果
    const mockAssets = [
      {
        id: 'asset-001',
        name: '现代简约商务PPT模板',
        resource_type: 'template',
        description: '适合企业汇报、产品发布的现代风格模板',
        thumbnail: 'https://via.placeholder.com/300x200/1890ff/ffffff?text=Modern+Business',
        image_url: 'https://via.placeholder.com/1200x800/1890ff/ffffff?text=Modern+Business',
        tags: ['现代简约', '商务专业', '蓝色'],
        created_at: Date.now() - 86400000 * 5,
      },
      {
        id: 'asset-002',
        name: '复古怀旧海报设计',
        resource_type: 'image',
        description: '70年代风格的复古海报，适合品牌营销',
        thumbnail: 'https://via.placeholder.com/300x200/ff6b6b/ffffff?text=Vintage+Poster',
        image_url: 'https://via.placeholder.com/1200x800/ff6b6b/ffffff?text=Vintage+Poster',
        tags: ['复古怀旧', '海报', '红色'],
        created_at: Date.now() - 86400000 * 10,
      },
      {
        id: 'asset-003',
        name: '科技未来UI套件',
        resource_type: 'asset',
        description: '包含按钮、图标、卡片等科技感UI组件',
        thumbnail: 'https://via.placeholder.com/300x200/52c41a/ffffff?text=Tech+UI+Kit',
        image_url: 'https://via.placeholder.com/1200x800/52c41a/ffffff?text=Tech+UI+Kit',
        tags: ['科技未来', '扁平化', '绿色'],
        created_at: Date.now() - 86400000 * 3,
      },
      {
        id: 'asset-004',
        name: '自然清新插画素材',
        resource_type: 'image',
        description: '手绘风格的自然主题插画，适合环保、健康类产品',
        thumbnail: 'https://via.placeholder.com/300x200/95de64/ffffff?text=Nature+Illustration',
        image_url: 'https://via.placeholder.com/1200x800/95de64/ffffff?text=Nature+Illustration',
        tags: ['自然清新', '手绘插画', '绿色'],
        created_at: Date.now() - 86400000 * 7,
      },
      {
        id: 'asset-005',
        name: '优雅高端品牌手册',
        resource_type: 'template',
        description: '奢侈品、高端品牌VI设计模板',
        thumbnail: 'https://via.placeholder.com/300x200/000000/ffffff?text=Luxury+Brand',
        image_url: 'https://via.placeholder.com/1200x800/000000/ffffff?text=Luxury+Brand',
        tags: ['优雅高端', '商务专业', '黑色'],
        created_at: Date.now() - 86400000 * 15,
      },
      {
        id: 'asset-006',
        name: '温馨可爱儿童绘本',
        resource_type: 'product',
        description: '适合儿童教育、亲子活动的温馨风格绘本',
        thumbnail: 'https://via.placeholder.com/300x200/ffadd2/ffffff?text=Kids+Book',
        image_url: 'https://via.placeholder.com/1200x800/ffadd2/ffffff?text=Kids+Book',
        tags: ['温馨可爱', '手绘插画', '粉色'],
        created_at: Date.now() - 86400000 * 2,
      },
      {
        id: 'asset-007',
        name: '炫酷动感运动海报',
        resource_type: 'image',
        description: '适合运动品牌、健身中心的动感海报',
        thumbnail: 'https://via.placeholder.com/300x200/ff4d4f/ffffff?text=Sports+Poster',
        image_url: 'https://via.placeholder.com/1200x800/ff4d4f/ffffff?text=Sports+Poster',
        tags: ['炫酷动感', '摄影写实', '红色'],
        created_at: Date.now() - 86400000 * 4,
      },
      {
        id: 'asset-008',
        name: '中国风传统元素',
        resource_type: 'asset',
        description: '水墨、祥云、青花瓷等中国传统元素素材包',
        thumbnail: 'https://via.placeholder.com/300x200/d4380d/ffffff?text=Chinese+Style',
        image_url: 'https://via.placeholder.com/1200x800/d4380d/ffffff?text=Chinese+Style',
        tags: ['中国风', '手绘插画', '红色'],
        created_at: Date.now() - 86400000 * 8,
      },
      {
        id: 'asset-009',
        name: '日系小清新摄影',
        resource_type: 'image',
        description: '日系风格的生活场景摄影作品',
        thumbnail: 'https://via.placeholder.com/300x200/ffa39e/ffffff?text=Japanese+Photo',
        image_url: 'https://via.placeholder.com/1200x800/ffa39e/ffffff?text=Japanese+Photo',
        tags: ['日系', '摄影写实', '自然清新'],
        created_at: Date.now() - 86400000 * 6,
      },
      {
        id: 'asset-010',
        name: '欧美风时尚杂志',
        resource_type: 'template',
        description: '欧美时尚杂志风格的排版模板',
        thumbnail: 'https://via.placeholder.com/300x200/722ed1/ffffff?text=Fashion+Magazine',
        image_url: 'https://via.placeholder.com/1200x800/722ed1/ffffff?text=Fashion+Magazine',
        tags: ['欧美风', '商务专业', '紫色'],
        created_at: Date.now() - 86400000 * 12,
      },
      {
        id: 'asset-011',
        name: '抽象几何艺术',
        resource_type: 'image',
        description: '现代艺术风格的抽象几何图形设计',
        thumbnail: 'https://via.placeholder.com/300x200/13c2c2/ffffff?text=Abstract+Art',
        image_url: 'https://via.placeholder.com/1200x800/13c2c2/ffffff?text=Abstract+Art',
        tags: ['抽象几何', '艺术创意', '青色'],
        created_at: Date.now() - 86400000 * 9,
      },
      {
        id: 'asset-012',
        name: '3D立体图标库',
        resource_type: 'asset',
        description: '高质量3D渲染图标，适合现代UI设计',
        thumbnail: 'https://via.placeholder.com/300x200/faad14/ffffff?text=3D+Icons',
        image_url: 'https://via.placeholder.com/1200x800/faad14/ffffff?text=3D+Icons',
        tags: ['3D立体', '科技未来', '黄色'],
        created_at: Date.now() - 86400000 * 1,
      },
      {
        id: 'asset-013',
        name: 'AI生成商拍场景',
        resource_type: 'product',
        description: 'AI生成的电商商品摄影场景',
        thumbnail: 'https://via.placeholder.com/300x200/eb2f96/ffffff?text=AI+Product+Photo',
        image_url: 'https://via.placeholder.com/1200x800/eb2f96/ffffff?text=AI+Product+Photo',
        tags: ['摄影写实', '现代简约', '粉色'],
        created_at: Date.now() - 86400000 * 11,
      },
      {
        id: 'asset-014',
        name: '趣味幽默表情包',
        resource_type: 'image',
        description: '适合社交媒体、营销活动的趣味表情包',
        thumbnail: 'https://via.placeholder.com/300x200/fadb14/ffffff?text=Funny+Emoji',
        image_url: 'https://via.placeholder.com/1200x800/fadb14/ffffff?text=Funny+Emoji',
        tags: ['趣味幽默', '手绘插画', '黄色'],
        created_at: Date.now() - 86400000 * 13,
      },
      {
        id: 'asset-015',
        name: '艺术创意字体',
        resource_type: 'asset',
        description: '富有创意的艺术字体设计',
        thumbnail: 'https://via.placeholder.com/300x200/2f54eb/ffffff?text=Creative+Font',
        image_url: 'https://via.placeholder.com/1200x800/2f54eb/ffffff?text=Creative+Font',
        tags: ['艺术创意', '现代简约', '蓝色'],
        created_at: Date.now() - 86400000 * 14,
      },
    ];

    // 根据模式过滤
    let filteredAssets = [...mockAssets];

    // 资源类型过滤
    if (filters?.resource_type && filters.resource_type !== 'all') {
      filteredAssets = filteredAssets.filter((a) => a.resource_type === filters.resource_type);
    }

    // 风格过滤（style模式或hybrid模式）
    if (style) {
      const styles = style.split(',');
      filteredAssets = filteredAssets.filter((a) =>
        styles.some((s: string) => a.tags.some((t: string) => t.includes(s)))
      );
    }

    // 颜色过滤（简单实现：匹配tags中的颜色）
    if (color && mode === 'color') {
      const colorMap: Record<string, string[]> = {
        '#1890ff': ['蓝色'],
        '#52c41a': ['绿色'],
        '#ff4d4f': ['红色'],
        '#faad14': ['黄色'],
        '#722ed1': ['紫色'],
        '#000000': ['黑色'],
        '#ffffff': ['白色'],
        '#ffadd2': ['粉色'],
      };
      const matchColors = colorMap[color] || [];
      if (matchColors.length > 0) {
        filteredAssets = filteredAssets.filter((a) =>
          a.tags.some((t) => matchColors.includes(t))
        );
      }
    }

    // 文本搜索（简单实现：匹配name和description）
    if (query && (mode === 'text' || mode === 'hybrid')) {
      const keywords = query.toLowerCase().split(' ');
      filteredAssets = filteredAssets.filter((a) =>
        keywords.some(
          (k: string) =>
            a.name.toLowerCase().includes(k) ||
            a.description.toLowerCase().includes(k) ||
            a.tags.some((t: string) => t.toLowerCase().includes(k))
        )
      );
    }

    // 计算相似度分数（模拟）
    const results = filteredAssets
      .map((asset) => {
        // 模拟相似度分数
        let score = 0.7 + Math.random() * 0.3;

        // 文本匹配度调整
        if (query) {
          const matchCount = query
            .toLowerCase()
            .split(' ')
            .filter(
              (k: string) =>
                asset.name.toLowerCase().includes(k) ||
                asset.description.toLowerCase().includes(k)
            ).length;
          score = Math.min(1.0, score + matchCount * 0.1);
        }

        // 风格匹配度调整
        if (style) {
          const styles = style.split(',');
          const matchCount = styles.filter((s: string) => asset.tags.some((t: string) => t.includes(s))).length;
          score = Math.min(1.0, score + matchCount * 0.1);
        }

        return {
          id: asset.id,
          score,
          metadata: asset,
        };
      })
      .filter((r) => r.score >= min_score)
      .sort((a, b) => b.score - a.score)
      .slice(0, top_k);

    return HttpResponse.json({
      results,
      total: results.length,
      mode,
      query_time_ms: 50 + Math.random() * 100,
    });
  }),

  /**
   * 创建异步embedding任务
   */
  http.post('/api/vec/tasks', async ({ request }) => {
    const body = (await request.json()) as any;
    const { resource_type, resource_id, content } = body;

    const task = {
      id: `task-${Date.now()}`,
      resource_type,
      resource_id,
      content,
      status: 'pending',
      created_at: Date.now(),
    };

    // 模拟异步处理
    setTimeout(() => {
      console.log('[Mock] Embedding任务完成:', task.id);
    }, 2000);

    return HttpResponse.json(task);
  }),

  /**
   * 批量创建embedding任务
   */
  http.post('/api/vec/tasks/batch', async ({ request }) => {
    const body = (await request.json()) as any;
    const { tasks } = body;

    const results = tasks.map((t: any) => ({
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      resource_type: t.resource_type,
      resource_id: t.resource_id,
      content: t.content,
      status: 'pending',
      created_at: Date.now(),
    }));

    return HttpResponse.json(results);
  }),

  /**
   * 查询embedding任务状态
   */
  http.get('/api/vec/tasks/:taskId', ({ params }) => {
    const { taskId } = params;

    // 模拟任务状态
    const statuses = ['pending', 'processing', 'completed', 'failed'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    return HttpResponse.json({
      id: taskId,
      resource_type: 'product',
      resource_id: 'prod-001',
      content: 'Sample content',
      status: randomStatus,
      created_at: Date.now() - 60000,
      completed_at: randomStatus === 'completed' ? Date.now() : undefined,
      error: randomStatus === 'failed' ? 'Embedding generation failed' : undefined,
    });
  }),

  // ==================== H-08: 流水线编排 ====================

  /**
   * 获取我的流水线列表
   */
  http.get('/api/workspace/pipelines', () => {
    const pipelines = [
      {
        id: 'pipeline-001',
        name: '商品图生成流水线',
        description: '从文案生成到图片优化的完整流程',
        steps: [
          {
            id: 'step-1',
            stepId: 'step-gen-scene',
            name: '生成商拍场景',
            params: { product: '运动鞋', scene: '户外', style: '自然光' },
            status: 'pending',
            progress: 0,
          },
          {
            id: 'step-2',
            stepId: 'step-enh-upscale',
            name: '图片超分',
            params: { scale: 2, model: 'real-esrgan' },
            status: 'pending',
            progress: 0,
          },
          {
            id: 'step-3',
            stepId: 'step-proc-watermark',
            name: '添加水印',
            params: { text: '© Brand', position: 'bottom-right', opacity: 0.5 },
            status: 'pending',
            progress: 0,
          },
          {
            id: 'step-4',
            stepId: 'step-exp-upload-cos',
            name: '上传到COS',
            params: { bucket: 'my-bucket', path: '/products/' },
            status: 'pending',
            progress: 0,
          },
        ],
        created_at: Date.now() - 86400000 * 7,
        updated_at: Date.now() - 86400000 * 3,
        last_run: Date.now() - 86400000 * 1,
        run_count: 15,
      },
      {
        id: 'pipeline-002',
        name: '营销素材批量处理',
        description: '批量调整尺寸、压缩、添加水印',
        steps: [
          {
            id: 'step-1',
            stepId: 'step-proc-resize',
            name: '调整尺寸',
            params: { width: 1024, height: 1024, mode: 'cover' },
            status: 'pending',
            progress: 0,
          },
          {
            id: 'step-2',
            stepId: 'step-proc-compress',
            name: '图片压缩',
            params: { quality: 85, format: 'jpeg' },
            status: 'pending',
            progress: 0,
          },
          {
            id: 'step-3',
            stepId: 'step-proc-watermark',
            name: '添加水印',
            params: { text: '© Marketing', position: 'bottom-right', opacity: 0.3 },
            status: 'pending',
            progress: 0,
          },
          {
            id: 'step-4',
            stepId: 'step-exp-download',
            name: '下载到本地',
            params: { format: 'zip' },
            status: 'pending',
            progress: 0,
          },
        ],
        created_at: Date.now() - 86400000 * 5,
        updated_at: Date.now() - 86400000 * 2,
        last_run: Date.now() - 86400000 * 2,
        run_count: 8,
      },
      {
        id: 'pipeline-003',
        name: 'AI文案+图片生成',
        description: '从零生成营销文案和配图',
        steps: [
          {
            id: 'step-1',
            stepId: 'step-gen-text',
            name: '生成文案',
            params: { prompt: '写一段运动鞋营销文案', model: 'gpt-4', max_tokens: 500 },
            status: 'pending',
            progress: 0,
          },
          {
            id: 'step-2',
            stepId: 'step-gen-image',
            name: '生成图片',
            params: { prompt: '运动鞋产品图', size: '1024x1024', quality: 'hd' },
            status: 'pending',
            progress: 0,
          },
          {
            id: 'step-3',
            stepId: 'step-enh-remove-bg',
            name: '去除背景',
            params: { model: 'u2net' },
            status: 'pending',
            progress: 0,
          },
          {
            id: 'step-4',
            stepId: 'step-exp-share',
            name: '生成分享链接',
            params: { expireDays: 7 },
            status: 'pending',
            progress: 0,
          },
        ],
        created_at: Date.now() - 86400000 * 10,
        updated_at: Date.now() - 86400000 * 4,
        last_run: Date.now() - 86400000 * 4,
        run_count: 22,
      },
    ];

    return HttpResponse.json({ pipelines });
  }),

  /**
   * 保存流水线
   */
  http.post('/api/workspace/pipelines', async ({ request }) => {
    const pipeline = (await request.json()) as any;
    console.log('[Mock] 保存流水线:', pipeline.name);

    return HttpResponse.json({
      success: true,
      pipeline,
    });
  }),

  /**
   * 更新流水线
   */
  http.put('/api/workspace/pipelines', async ({ request }) => {
    const pipeline = (await request.json()) as any;
    console.log('[Mock] 更新流水线:', pipeline.name);

    return HttpResponse.json({
      success: true,
      pipeline,
    });
  }),

  /**
   * 删除流水线
   */
  http.delete('/api/workspace/pipelines/:pipelineId', ({ params }) => {
    const { pipelineId } = params;
    console.log('[Mock] 删除流水线:', pipelineId);

    return HttpResponse.json({
      success: true,
    });
  }),

  /**
   * 执行流水线步骤
   */
  http.post('/api/workspace/pipelines/execute', async ({ request }) => {
    const body = (await request.json()) as any;
    const { stepId, params } = body;

    console.log('[Mock] 执行步骤:', stepId, params);

    // 模拟步骤执行
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    // 根据步骤类型返回不同的结果
    const results: Record<string, any> = {
      'step-gen-text': {
        text: '这款运动鞋采用顶级材质，轻盈透气，为您的运动生活带来极致体验！',
        tokens: 45,
      },
      'step-gen-image': {
        image_url: 'https://via.placeholder.com/1024x1024/52c41a/ffffff?text=AI+Generated',
        size: '1024x1024',
      },
      'step-gen-scene': {
        image_url: 'https://via.placeholder.com/1024x1024/1890ff/ffffff?text=Product+Scene',
        scene: '户外',
      },
      'step-enh-upscale': {
        image_url: 'https://via.placeholder.com/2048x2048/ff6b6b/ffffff?text=Upscaled',
        scale: 2,
      },
      'step-enh-remove-bg': {
        image_url: 'https://via.placeholder.com/1024x1024/ffffff/000000?text=No+BG',
        removed: true,
      },
      'step-enh-relight': {
        image_url: 'https://via.placeholder.com/1024x1024/faad14/ffffff?text=Relit',
        adjustments: params,
      },
      'step-proc-resize': {
        image_url: `https://via.placeholder.com/${params.width}x${params.height}/722ed1/ffffff?text=Resized`,
        size: `${params.width}x${params.height}`,
      },
      'step-proc-watermark': {
        image_url: 'https://via.placeholder.com/1024x1024/13c2c2/ffffff?text=Watermarked',
        watermark: params.text,
      },
      'step-proc-compress': {
        image_url: 'https://via.placeholder.com/1024x1024/eb2f96/ffffff?text=Compressed',
        original_size: 5242880, // 5MB
        compressed_size: 1048576, // 1MB
        quality: params.quality,
      },
      'step-exp-download': {
        download_url: 'https://example.com/download/results.zip',
        file_count: 10,
      },
      'step-exp-upload-cos': {
        cos_url: `https://my-bucket.cos.ap-shanghai.myqcloud.com${params.path}result.jpg`,
        uploaded: true,
      },
      'step-exp-share': {
        share_url: `https://share.example.com/${Math.random().toString(36).slice(2)}`,
        expire_days: params.expireDays,
      },
    };

    const result = results[stepId] || { success: true };

    return HttpResponse.json(result);
  }),
];
