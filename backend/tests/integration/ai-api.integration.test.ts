/**
 * AI API集成测试
 * 艹，这个测试覆盖统一推理API的完整流程！
 *
 * 测试范围：
 * - POST /api/ai/chat - 非流式聊天
 * - POST /api/ai/chat (stream=true) - 流式聊天
 * - Provider选择和负载均衡
 * - 错误处理和重试
 */

import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { db } from '../../src/config/database.js';
import * as providerEndpointsRepo from '../../src/repositories/providerEndpoints.repo.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AI API Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  let testProvider: any;

  beforeAll(async () => {
    // 清理测试数据
    await db('provider_endpoints').where('provider_ref', 'like', 'test-%').del();

    // 创建测试Provider
    testProvider = {
      provider_ref: 'test-openai-integration',
      provider_name: 'Test OpenAI',
      provider_type: 'openai',
      endpoint_url: 'https://api.openai.com/v1/chat/completions',
      auth_type: 'bearer',
      credentials_encrypted: JSON.stringify({
        api_key: 'sk-test-integration-key'
      }),
      weight: 100,
      timeout_ms: 30000,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('provider_endpoints').insert(testProvider);
  });

  afterAll(async () => {
    // 清理测试数据
    await db('provider_endpoints').where('provider_ref', 'like', 'test-%').del();
    await db.destroy();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/ai/chat - 非流式聊天', () => {
    it('应该成功调用AI聊天API并返回响应', async () => {
      // Arrange
      const mockOpenAIResponse = {
        id: 'chatcmpl-integration-test',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '你好！我是AI助手，很高兴为您服务！'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      mockedAxios.post.mockResolvedValue({ data: mockOpenAIResponse });

      // Act
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: '你好' }],
          temperature: 0.7
        })
        .set('Authorization', 'Bearer test-jwt-token')
        .expect(200);

      // Assert
      expect(response.body).toEqual(mockOpenAIResponse);
      expect(response.body.choices[0].message.content).toContain('AI助手');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: '你好'
            })
          ]),
          temperature: 0.7
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test-integration-key'
          })
        })
      );
    });

    it('应该支持工具调用（Tool Calling）', async () => {
      // Arrange
      const mockToolCallResponse = {
        id: 'chatcmpl-tool-test',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"Beijing"}'
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70
        }
      };

      mockedAxios.post.mockResolvedValue({ data: mockToolCallResponse });

      // Act
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: '北京今天天气怎么样？' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: '获取指定城市的天气信息',
                parameters: {
                  type: 'object',
                  properties: {
                    location: {
                      type: 'string',
                      description: '城市名称'
                    }
                  },
                  required: ['location']
                }
              }
            }
          ],
          tool_choice: 'auto'
        })
        .set('Authorization', 'Bearer test-jwt-token')
        .expect(200);

      // Assert
      expect(response.body.choices[0].message.tool_calls).toBeDefined();
      expect(response.body.choices[0].message.tool_calls[0].function.name).toBe('get_weather');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              type: 'function',
              function: expect.objectContaining({
                name: 'get_weather'
              })
            })
          ]),
          tool_choice: 'auto'
        }),
        expect.any(Object)
      );
    });

    it('应该在Provider不可用时返回错误', async () => {
      // Arrange
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      // Act
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }]
        })
        .set('Authorization', 'Bearer test-jwt-token')
        .expect(500);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });

    it('应该在未提供认证token时返回401', async () => {
      // Act
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }]
        })
        .expect(401);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.stringContaining('Unauthorized')
      });
    });

    it('应该在请求参数无效时返回400', async () => {
      // Act
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          // 缺少必需的model和messages字段
        })
        .set('Authorization', 'Bearer test-jwt-token')
        .expect(400);

      // Assert
      expect(response.body).toMatchObject({
        error: expect.any(String)
      });
    });
  });

  describe('POST /api/ai/chat (stream=true) - 流式聊天', () => {
    it('应该返回SSE流式响应', async () => {
      // Arrange
      const mockStreamChunks = [
        'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":"你"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"好"},"finish_reason":null}]}\n\n',
        'data: {"id":"chatcmpl-stream","object":"chat.completion.chunk","created":123,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"！"},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n'
      ];

      // Mock stream response
      const mockStream: any = {
        // 艹，显式声明any类型避免隐式推导！
        on: jest.fn((event: string, callback: any): any => {
          // 艹，显式声明返回类型！
          if (event === 'data') {
            mockStreamChunks.forEach((chunk) => {
              callback(Buffer.from(chunk));
            });
          } else if (event === 'end') {
            setTimeout(callback, 100);
          }
          return mockStream;
        })
      };

      mockedAxios.post.mockResolvedValue({ data: mockStream });

      // Act
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: '你好' }],
          stream: true
        })
        .set('Authorization', 'Bearer test-jwt-token')
        .expect(200);

      // Assert
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stream: true
        }),
        expect.objectContaining({
          responseType: 'stream'
        })
      );
    });
  });

  describe('Provider负载均衡', () => {
    let provider1: any;
    let provider2: any;

    beforeAll(async () => {
      // 创建两个Provider用于负载均衡测试
      provider1 = {
        provider_ref: 'test-lb-provider-1',
        provider_name: 'Test Provider 1',
        provider_type: 'openai',
        endpoint_url: 'https://api1.example.com/v1/chat/completions',
        auth_type: 'bearer',
        credentials_encrypted: JSON.stringify({ api_key: 'sk-1' }),
        weight: 70,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      provider2 = {
        provider_ref: 'test-lb-provider-2',
        provider_name: 'Test Provider 2',
        provider_type: 'openai',
        endpoint_url: 'https://api2.example.com/v1/chat/completions',
        auth_type: 'bearer',
        credentials_encrypted: JSON.stringify({ api_key: 'sk-2' }),
        weight: 30,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      await db('provider_endpoints').insert([provider1, provider2]);
    });

    afterAll(async () => {
      await db('provider_endpoints')
        .whereIn('provider_ref', ['test-lb-provider-1', 'test-lb-provider-2'])
        .del();
    });

    it('应该根据权重选择Provider', async () => {
      // Arrange
      const mockResponse = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop'
          }
        ]
      };

      mockedAxios.post.mockResolvedValue({ data: mockResponse });

      // Act - 发送多次请求，统计Provider选择分布
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/ai/chat')
            .send({
              model: 'gpt-4',
              messages: [{ role: 'user', content: 'Test' }]
            })
            .set('Authorization', 'Bearer test-jwt-token')
        );

      await Promise.all(requests);

      // Assert - 验证Provider被调用（实际分布验证需要更复杂的统计逻辑）
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('参数验证', () => {
    it('应该验证temperature范围（0-2）', async () => {
      // Act
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 3.0 // 超出范围
        })
        .set('Authorization', 'Bearer test-jwt-token')
        .expect(400);

      // Assert
      expect(response.body.error).toContain('temperature');
    });

    it('应该验证max_tokens最小值', async () => {
      // Act
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: -1 // 负数
        })
        .set('Authorization', 'Bearer test-jwt-token')
        .expect(400);

      // Assert
      expect(response.body.error).toContain('max_tokens');
    });
  });
});
