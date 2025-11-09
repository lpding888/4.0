/**
 * 聊天API路由
 * 艹，简单的Next.js API，用来测试聊天功能！
 *
 * @author 老王
 */

import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, model = 'gpt-3.5-turbo', sessionId } = body;

    console.log('🤖 收到聊天请求:', { message, model, sessionId });

    // 根据不同模型生成不同的回复
    const responses = {
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
    } as const;

    type SupportedModel = keyof typeof responses;
    const fallbackModel: SupportedModel = 'gpt-3.5-turbo';
    const modelKey: SupportedModel =
      typeof model === 'string' && model in responses ? (model as SupportedModel) : fallbackModel;
    const responseText = responses[modelKey];

    // 创建一个可读流
    const stream = new ReadableStream({
      start(controller) {
        // 模拟逐字输出
        responseText.forEach((text, index) => {
          setTimeout(() => {
            const chunk = `data: ${JSON.stringify({ text, sessionId })}\n\n`;
            controller.enqueue(new TextEncoder().encode(chunk));

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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('聊天API错误:', error);

    return Response.json({
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
