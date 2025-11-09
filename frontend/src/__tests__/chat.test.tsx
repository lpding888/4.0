/**
 * 聊天功能单元测试
 * 艹，必须测试SSE Hook和会话存储！
 *
 * @author 老王
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { startSSE } from '@/lib/api/sse';
import { saveChat, getChat, getAllChats } from '@/lib/storage/chatDB';

// Mock fetch
global.fetch = jest.fn();

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  version: 1,
  name: 'test-db'
};

// Mock the indexedDB API
Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

describe('SSE Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('应该正确处理SSE连接和数据接收', async () => {
    const mockOnDelta = jest.fn();
    const mockOnDone = jest.fn();
    const mockOnError = jest.fn();

    // Mock fetch response
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"text": "测试消息"}\n\n'));
        setTimeout(() => {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        }, 100);
      }
    });

    const mockResponse = {
      ok: true,
      body: mockStream,
      status: 200
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    // 启动SSE连接
    await startSSE({
      url: '/api/ai/chat',
      body: { message: '测试', model: 'gpt-3.5-turbo' },
      onDelta: mockOnDelta,
      onDone: mockOnDone,
      onError: mockOnError
    });

    // 验证fetch调用
    expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ message: '测试', model: 'gpt-3.5-turbo' }),
      signal: expect.any(AbortSignal),
    });

    // 等待数据处理
    await waitFor(() => {
      expect(mockOnDelta).toHaveBeenCalledWith({ text: '测试消息' });
    });

    await waitFor(() => {
      expect(mockOnDone).toHaveBeenCalled();
    });

    expect(mockOnError).not.toHaveBeenCalled();
  });

  test('应该正确处理HTTP错误响应', async () => {
    const mockOnError = jest.fn();

    // Mock error response
    const mockResponse = {
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({
        code: 'MODEL_UNAVAILABLE',
        message: '模型暂时不可用',
        requestId: 'req_123'
      })
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    // 启动SSE连接
    await startSSE({
      url: '/api/ai/chat',
      body: { message: '测试', model: 'gpt-3.5-turbo' },
      onError: mockOnError
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith({
        code: 'MODEL_UNAVAILABLE',
        message: '模型暂时不可用',
        requestId: 'req_123'
      });
    });
  });

  test('应该支持AbortSignal取消连接', async () => {
    const mockOnDelta = jest.fn();
    const mockOnDone = jest.fn();
    const mockOnError = jest.fn();

    // Mock一个永远不会结束的流
    const mockStream = new ReadableStream({
      start() {
        // 不调用close，模拟长连接
      }
    });

    const mockResponse = {
      ok: true,
      body: mockStream,
      status: 200
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    // 创建AbortController
    const abortController = new AbortController();

    // 启动SSE连接
    startSSE({
      url: '/api/ai/chat',
      body: { message: '测试', model: 'gpt-3.5-turbo' },
      onDelta: mockOnDelta,
      onDone: mockOnDone,
      onError: mockOnError,
      signal: abortController.signal
    });

    // 立即取消连接
    abortController.abort();

    // 验证连接被取消（不会调用onDone或onError）
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockOnDone).not.toHaveBeenCalled();
    expect(mockOnError).not.toHaveBeenCalled();
  });
});

describe('IndexedDB聊天存储', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('应该能够保存和获取聊天会话', async () => {
    // Mock IndexedDB operations
    const mockDB = {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          put: jest.fn().mockImplementation((data, onSuccess) => {
            setTimeout(() => onSuccess?.({ result: data.id }), 10);
            return { onsuccess: { call: jest.fn() }, onerror: { call: jest.fn() } };
          })
        })
      })
    };

    mockIndexedDB.open = jest.fn().mockImplementation((dbName, version) => {
      const mockRequest = {
        result: mockDB,
        onsuccess: null as ((event: any) => void) | null,
        onerror: null as ((event: any) => void) | null,
        onupgradeneeded: null as ((event: any) => void) | null
      };

      setTimeout(() => {
        mockRequest.onsuccess?.({ target: mockRequest });
      }, 10);

      return mockRequest;
    });

    const chatSession = {
      id: 'test-session-1',
      title: '测试对话',
      messages: [
        { id: 'msg1', type: 'user', content: '你好', timestamp: Date.now() },
        { id: 'msg2', type: 'assistant', content: '你好！我是AI助手', timestamp: Date.now() }
      ]
    };

    // 保存会话
    await saveChat(chatSession);

    // Mock get operation
    mockDB.transaction = jest.fn().mockReturnValue({
      objectStore: jest.fn().mockReturnValue({
        get: jest.fn().mockImplementation((key) => {
          const mockRequest = {
            result: key === 'test-session-1' ? chatSession : undefined,
            onsuccess: null as ((event: any) => void) | null,
            onerror: null as ((event: any) => void) | null
          };

          setTimeout(() => {
            mockRequest.onsuccess?.({ target: mockRequest });
          }, 10);

          return mockRequest;
        })
      })
    });

    // 获取会话
    const retrievedSession = await getChat('test-session-1');

    expect(retrievedSession).toEqual(chatSession);
  });

  test('获取不存在的会话应该返回undefined', async () => {
    // Mock IndexedDB operations
    const mockDB = {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          get: jest.fn().mockImplementation((key) => {
            const mockRequest = {
              result: undefined,
              onsuccess: null as ((event: any) => void) | null,
              onerror: null as ((event: any) => void) | null
            };

            setTimeout(() => {
              mockRequest.onsuccess?.({ target: mockRequest });
            }, 10);

            return mockRequest;
          })
        })
      })
    };

    mockIndexedDB.open = jest.fn().mockImplementation((dbName, version) => {
      const mockRequest = {
        result: mockDB,
        onsuccess: null as ((event: any) => void) | null,
        onerror: null as ((event: any) => void) | null,
        onupgradeneeded: null as ((event: any) => void) | null
      };

      setTimeout(() => {
        mockRequest.onsuccess?.({ target: mockRequest });
      }, 10);

      return mockRequest;
    });

    const result = await getChat('non-existent-session');
    expect(result).toBeUndefined();
  });

  test('应该能够获取所有聊天会话', async () => {
    const mockSessions = [
      { id: 'session1', title: '对话1', messages: [] },
      { id: 'session2', title: '对话2', messages: [] }
    ];

    // Mock IndexedDB operations
    const mockDB = {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          getAll: jest.fn().mockImplementation(() => {
            const mockRequest = {
              result: mockSessions,
              onsuccess: null as ((event: any) => void) | null,
              onerror: null as ((event: any) => void) | null
            };

            setTimeout(() => {
              mockRequest.onsuccess?.({ target: mockRequest });
            }, 10);

            return mockRequest;
          })
        })
      })
    };

    mockIndexedDB.open = jest.fn().mockImplementation((dbName, version) => {
      const mockRequest = {
        result: mockDB,
        onsuccess: null as ((event: any) => void) | null,
        onerror: null as ((event: any) => void) | null,
        onupgradeneeded: null as ((event: any) => void) | null
      };

      setTimeout(() => {
        mockRequest.onsuccess?.({ target: mockRequest });
      }, 10);

      return mockRequest;
    });

    const result = await getAllChats();
    expect(result).toEqual(mockSessions);
  });
});

describe('聊天功能集成测试', () => {
  test('应该处理完整的聊天流程', async () => {
    // 这个测试可以验证聊天页面的主要功能
    // 由于需要渲染完整组件，这里只是示例结构

    // Mock所有必要的API
    const mockResponses = [
      { text: '你好！我是AI助手。' },
      { text: '很高兴为您服务！' }
    ];

    const mockStream = new ReadableStream({
      start(controller) {
        mockResponses.forEach((response, index) => {
          setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(response)}\n\n`));

            if (index === mockResponses.length - 1) {
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                controller.close();
              }, 100);
            }
          }, (index + 1) * 200);
        });
      }
    });

    const mockResponse = {
      ok: true,
      body: mockStream,
      status: 200
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    // 验证完整的聊天流程
    const onDelta = jest.fn();
    const onDone = jest.fn();

    await startSSE({
      url: '/api/ai/chat',
      body: { message: '你好', model: 'gpt-3.5-turbo', sessionId: 'test-session' },
      onDelta,
      onDone
    });

    await waitFor(() => {
      expect(onDelta).toHaveBeenCalledTimes(2);
      expect(onDelta).toHaveBeenNthCalledWith(1, { text: '你好！我是AI助手。' });
      expect(onDelta).toHaveBeenNthCalledWith(2, { text: '很高兴为您服务！' });
    });

    await waitFor(() => {
      expect(onDone).toHaveBeenCalled();
    });
  });
});