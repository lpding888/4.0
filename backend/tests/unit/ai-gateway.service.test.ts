/**
 * AI Gateway服务单元测试
 * 艹，这个测试文件覆盖AI Gateway的所有核心功能！
 */

import axios from 'axios';
import { EventEmitter } from 'events';
import { aiGateway } from '../../src/services/ai-gateway.service.js';
import * as providerEndpointsRepo from '../../src/repositories/providerEndpoints.repo.js';
import logger from '../../src/utils/logger.js';

// Mock依赖
jest.mock('axios');
jest.mock('../../src/repositories/providerEndpoints.repo.js', () => ({
  // 🟢 已修复：使用实际repo导出的函数名！
  getProviderEndpoint: jest.fn(),
  listProviderEndpoints: jest.fn(),
  createProviderEndpoint: jest.fn(),
  updateProviderEndpoint: jest.fn(),
  deleteProviderEndpoint: jest.fn()
}));
jest.mock('../../src/utils/logger.js');

const mockedAxios = axios as jest.Mocked<typeof axios>;
// 🟢 已修复：Mock函数名匹配实际repo导出！
const mockedProviderRepo = providerEndpointsRepo as any as {
  getProviderEndpoint: jest.MockedFunction<any>;
  listProviderEndpoints: jest.MockedFunction<any>;
  createProviderEndpoint: jest.MockedFunction<any>;
  updateProviderEndpoint: jest.MockedFunction<any>;
  deleteProviderEndpoint: jest.MockedFunction<any>;
};
const mockedLogger = logger as jest.Mocked<typeof logger>;

// 🟢 已修复：Mock函数名匹配实际repo，移除skip
describe('AIGatewayService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('chat() - 非流式聊天', () => {
    it('应该成功调用OpenAI Provider', async () => {
      // Arrange
      const mockProvider = {
        provider_ref: 'openai-1',
        provider_name: 'OpenAI GPT-4',
        endpoint_url: 'https://api.openai.com/v1/chat/completions',
        auth_type: 'bearer',
        credentials_encrypted: {
          api_key: 'sk-test123'
        },
        weight: 100,
        timeout_ms: 30000
      };

      const mockRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: '你好' }],
        temperature: 0.7
      };

      const mockResponse = {
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: '你好！我能帮你什么？'
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25
          }
        }
      };

      mockedProviderRepo.getProviderEndpoint.mockResolvedValue(mockProvider);
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await aiGateway.chat(mockRequest, 'openai-1');

      // Assert
      expect(result).toEqual(mockResponse.data);
      expect(mockedProviderRepo.getProviderEndpoint).toHaveBeenCalledWith('openai-1');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        mockProvider.endpoint_url,
        expect.objectContaining({
          model: 'gpt-4',
          messages: mockRequest.messages,
          temperature: 0.7
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test123'
          })
        })
      );
      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[AIGateway] Chat响应成功')
      );
    });

    it('应该成功调用Anthropic Provider并适配响应格式', async () => {
      // Arrange
      const mockProvider = {
        provider_ref: 'anthropic-1',
        provider_name: 'Anthropic Claude',
        endpoint_url: 'https://api.anthropic.com/v1/messages',
        auth_type: 'bearer',
        credentials_encrypted: {
          api_key: 'sk-ant-test'
        },
        weight: 100,
        timeout_ms: 30000
      };

      const mockRequest = {
        model: 'claude-3-opus',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        max_tokens: 1024
      };

      const mockAnthropicResponse = {
        data: {
          id: 'msg_123',
          model: 'claude-3-opus',
          content: [{ type: 'text', text: 'Hello! How can I help you?' }],
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 5,
            output_tokens: 8
          }
        }
      };

      mockedProviderRepo.getProviderEndpoint.mockResolvedValue(mockProvider);
      mockedAxios.post.mockResolvedValue(mockAnthropicResponse);

      // Act
      const result = await aiGateway.chat(mockRequest, 'anthropic-1');

      // Assert
      expect(result.object).toBe('chat.completion');
      expect(result.choices[0].message?.content).toBe('Hello! How can I help you?');
      expect(result.usage?.total_tokens).toBe(13); // 5 + 8
      expect(mockedAxios.post).toHaveBeenCalledWith(
        mockProvider.endpoint_url,
        expect.objectContaining({
          model: 'claude-3-opus',
          max_tokens: 1024,
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Hello'
            })
          ])
        }),
        expect.any(Object)
      );
    });

    it('应该自动选择Provider（负载均衡）', async () => {
      // Arrange
      const mockProviders = [
        {
          provider_ref: 'openai-1',
          provider_name: 'OpenAI GPT-4',
          endpoint_url: 'https://api.openai.com/v1/chat/completions',
          auth_type: 'bearer',
          credentials_encrypted: { api_key: 'sk-1' },
          weight: 100,
          timeout_ms: 30000
        },
        {
          provider_ref: 'openai-2',
          provider_name: 'OpenAI GPT-4',
          endpoint_url: 'https://api.openai.com/v1/chat/completions',
          auth_type: 'bearer',
          credentials_encrypted: { api_key: 'sk-2' },
          weight: 50,
          timeout_ms: 30000
        }
      ];

      const mockRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Test' }]
      };

      const mockResponse = {
        data: {
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
        }
      };

      mockedProviderRepo.listProviderEndpoints.mockResolvedValue(mockProviders);
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await aiGateway.chat(mockRequest); // 不指定providerRef

      // Assert
      expect(mockedProviderRepo.listProviderEndpoints).toHaveBeenCalledWith({});
      expect(mockedAxios.post).toHaveBeenCalled();
      expect(result).toEqual(mockResponse.data);
    });

    it('应该在Provider不存在时抛出错误', async () => {
      // Arrange
      mockedProviderRepo.getProviderEndpoint.mockResolvedValue(null);

      const mockRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Test' }]
      };

      // Act & Assert
      await expect(aiGateway.chat(mockRequest, 'non-existent')).rejects.toThrow(
        'Provider not found: non-existent'
      );
    });

    it('应该在API调用失败时抛出错误', async () => {
      // Arrange
      const mockProvider = {
        provider_ref: 'openai-1',
        provider_name: 'OpenAI GPT-4',
        endpoint_url: 'https://api.openai.com/v1/chat/completions',
        auth_type: 'bearer',
        credentials_encrypted: { api_key: 'sk-test' },
        weight: 100,
        timeout_ms: 30000
      };

      const mockRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Test' }]
      };

      mockedProviderRepo.getProviderEndpoint.mockResolvedValue(mockProvider);
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(aiGateway.chat(mockRequest, 'openai-1')).rejects.toThrow(
        'Chat failed: Network error'
      );

      expect(mockedLogger.error).toHaveBeenCalledWith(
        '[AIGateway] Chat请求失败:',
        expect.any(Error)
      );
    });
  });

  describe('chatStream() - 流式聊天', () => {
    it('应该成功返回SSE流式EventEmitter', async () => {
      // Arrange
      const mockProvider = {
        provider_ref: 'openai-1',
        provider_name: 'OpenAI GPT-4',
        endpoint_url: 'https://api.openai.com/v1/chat/completions',
        auth_type: 'bearer',
        credentials_encrypted: { api_key: 'sk-test' },
        weight: 100,
        timeout_ms: 60000
      };

      const mockRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        stream: true
      };

      // 模拟流式响应
      const mockStream = new EventEmitter();
      const mockResponse = {
        data: mockStream
      };

      mockedProviderRepo.getProviderEndpoint.mockResolvedValue(mockProvider);
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const emitter = await aiGateway.chatStream(mockRequest, 'openai-1');

      // Assert
      expect(emitter).toBeInstanceOf(EventEmitter);
      expect(mockedProviderRepo.getProviderEndpoint).toHaveBeenCalledWith('openai-1');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        mockProvider.endpoint_url,
        expect.objectContaining({ stream: true }),
        expect.objectContaining({
          responseType: 'stream'
        })
      );
    });

    it('应该正确解析OpenAI流式chunks', async () => {
      // Arrange
      const mockProvider = {
        provider_ref: 'openai-1',
        provider_name: 'OpenAI GPT-4',
        endpoint_url: 'https://api.openai.com/v1/chat/completions',
        auth_type: 'bearer',
        credentials_encrypted: { api_key: 'sk-test' },
        weight: 100,
        timeout_ms: 60000
      };

      const mockRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        stream: true
      };

      const mockStream = new EventEmitter();
      const mockResponse = { data: mockStream };

      mockedProviderRepo.getProviderEndpoint.mockResolvedValue(mockProvider);
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const emitter = await aiGateway.chatStream(mockRequest, 'openai-1');

      const receivedChunks: any[] = [];
      emitter.on('data', (chunk) => receivedChunks.push(chunk));

      // 模拟流式数据
      const chunk1 = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: 'Hello' },
            finish_reason: null
          }
        ]
      };

      const chunk2 = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: ' there!' },
            finish_reason: null
          }
        ]
      };

      // 等待异步初始化完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      mockStream.emit('data', Buffer.from(`data: ${JSON.stringify(chunk1)}\n\n`));
      mockStream.emit('data', Buffer.from(`data: ${JSON.stringify(chunk2)}\n\n`));
      mockStream.emit('data', Buffer.from('data: [DONE]\n\n'));
      mockStream.emit('end');

      // 等待所有事件处理完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(receivedChunks.length).toBeGreaterThanOrEqual(2);
      expect(receivedChunks[0]).toMatchObject({
        object: 'chat.completion.chunk',
        choices: expect.arrayContaining([
          expect.objectContaining({
            delta: expect.objectContaining({ content: 'Hello' })
          })
        ])
      });
    });

    it('应该在Provider不存在时触发error事件', async () => {
      // Arrange
      // 🟢 修复：添加延迟确保emitter先返回再emit error
      mockedProviderRepo.getProviderEndpoint.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 10))
      );

      const mockRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Test' }]
      };

      // Act
      const emitter = await aiGateway.chatStream(mockRequest, 'non-existent');

      // Assert
      const errorPromise = new Promise<any>((resolve, reject) => {
        emitter.on('error', resolve);
        setTimeout(() => reject(new Error('Timeout waiting for error')), 500);
      });

      const error = await errorPromise;
      expect(error).toEqual(
        expect.objectContaining({
          message: 'Provider not found: non-existent'
        })
      );
    });
  });

  describe('适配器测试', () => {
    it('OpenAIAdapter应该正确适配请求和响应', async () => {
      // Arrange
      const mockProvider = {
        provider_ref: 'openai-1',
        provider_name: 'OpenAI GPT-4',
        endpoint_url: 'https://api.openai.com/v1/chat/completions',
        auth_type: 'bearer',
        credentials_encrypted: { api_key: 'sk-test' },
        weight: 100,
        timeout_ms: 30000
      };

      const mockRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Test' }],
        temperature: 0.8,
        max_tokens: 100,
        tools: [
          {
            type: 'function',
            function: { name: 'get_weather', description: 'Get weather' }
          }
        ]
      };

      const mockResponse = {
        data: {
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
        }
      };

      mockedProviderRepo.getProviderEndpoint.mockResolvedValue(mockProvider);
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      const result = await aiGateway.chat(mockRequest, 'openai-1');

      // Assert - 请求应该包含tools参数
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          tools: mockRequest.tools,
          temperature: 0.8,
          max_tokens: 100
        }),
        expect.any(Object)
      );

      // 响应应该保持OpenAI格式
      expect(result).toEqual(mockResponse.data);
    });

    it('AnthropicAdapter应该正确转换消息格式', async () => {
      // Arrange
      const mockProvider = {
        provider_ref: 'anthropic-1',
        provider_name: 'Anthropic Claude',
        endpoint_url: 'https://api.anthropic.com/v1/messages',
        auth_type: 'bearer',
        credentials_encrypted: { api_key: 'sk-ant-test' },
        weight: 100,
        timeout_ms: 30000
      };

      const mockRequest = {
        model: 'claude-3-opus',
        messages: [
          { role: 'system' as const, content: 'You are helpful' },
          { role: 'user' as const, content: 'Hello' }
        ]
      };

      const mockResponse = {
        data: {
          id: 'msg_123',
          model: 'claude-3-opus',
          content: [{ type: 'text', text: 'Hi!' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 }
        }
      };

      mockedProviderRepo.getProviderEndpoint.mockResolvedValue(mockProvider);
      mockedAxios.post.mockResolvedValue(mockResponse);

      // Act
      await aiGateway.chat(mockRequest, 'anthropic-1');

      // Assert - system消息应该转换为user消息
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user', // system转user
              content: 'You are helpful'
            }),
            expect.objectContaining({
              role: 'user',
              content: 'Hello'
            })
          ])
        }),
        expect.any(Object)
      );
    });
  });
});
