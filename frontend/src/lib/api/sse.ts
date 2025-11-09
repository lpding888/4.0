/**
 * SSE Hook 实现
 * 艹，这个SSE必须支持自动重连、心跳超时、手动abort！
 *
 * @author 老王
 */

import type { ApiError } from './client';

type Opts<T> = {
  url: string;
  body?: any;
  token?: string;
  onDelta?: (chunk: T) => void;
  onDone?: (final?: T) => void;
  onError?: (e: ApiError) => void;
  signal?: AbortSignal;
};

export async function startSSE<T>({
  url,
  body,
  token,
  onDelta,
  onDone,
  onError,
  signal
}: Opts<T>) {
  console.log('🎯 SSE Hook 开始:', { url, body, signal: !!signal });

  let retries = 0;
  const maxRetries = 3;
  let retryTimeouts: NodeJS.Timeout[] = [];
  let externalAbortHandler: (() => void) | undefined;

  const clearRetryTimeouts = () => {
    retryTimeouts.forEach(timeout => clearTimeout(timeout));
    retryTimeouts = [];
  };

  const startConnection = async () => {
    try {
      console.log('🔗 开始连接...');
      const ctrl = new AbortController();

      // 如果外部提供了signal，监听abort事件
      if (signal) {
        externalAbortHandler = () => {
          ctrl.abort();
          clearRetryTimeouts();
        };
        signal.addEventListener('abort', externalAbortHandler);
      }

      console.log('📤 准备发送fetch请求:', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });

      // 检查HTTP响应状态
      if (!res.ok) {
        let errorMessage = `SSE连接失败(${res.status})`;
        let errorCode = `HTTP_${res.status}`;

        try {
          const errorData = await res.json();
          if (errorData.code) errorCode = errorData.code;
          if (errorData.message) errorMessage = errorData.message;
          if (errorData.requestId) {
            // 将requestId传递给错误处理
            onError && onError({
              code: errorCode,
              message: errorMessage,
              requestId: errorData.requestId
            });
            return;
          }
        } catch (e) {
          // JSON解析失败，使用默认错误信息
        }

        throw {
          code: errorCode,
          message: errorMessage
        };
      }

      if (!res.body) {
        throw {
          code: 'NO_RESPONSE_BODY',
          message: '响应体为空'
        };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';
      let lastBeat = Date.now();

      // 心跳超时检查：25秒
      const heartbeat = setInterval(() => {
        if (Date.now() - lastBeat > 25000) {
          clearInterval(heartbeat);
          clearRetryTimeouts();
          ctrl.abort(); // 心跳超时，主动断开

          // 触发重连逻辑
          if (retries < maxRetries) {
            retries++;
            const timeout = setTimeout(() => {
              console.log(`SSE心跳超时，第${retries}次重连...`);
              startConnection();
            }, 1000 * retries);
            retryTimeouts.push(timeout);
          } else {
            onError && onError({
              code: 'HEARTBEAT_TIMEOUT',
              message: '连接心跳超时，请检查网络连接'
            });
          }
        }
      }, 5000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lastBeat = Date.now();
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i]!.trim();
            if (!line) continue;

            if (line.startsWith('data:')) {
              const payload = line.slice(5).trim();

              // 检查结束标识
              if (payload === '[DONE]') {
                clearInterval(heartbeat);
                clearRetryTimeouts();
                onDone && onDone();
                return;
              }

              // 解析JSON数据
              try {
                const data = JSON.parse(payload);
                onDelta && onDelta(data);
              } catch (e) {
                console.warn('SSE数据解析失败:', payload, e);
                // 不中断流程，继续处理下一条数据
              }
            } else if (line.startsWith('event:')) {
              // 处理事件类型（如error, close等）
              const eventType = line.slice(6).trim();
              if (eventType === 'error') {
                clearInterval(heartbeat);
                clearRetryTimeouts();
                onError && onError({
                  code: 'SSE_EVENT_ERROR',
                  message: '服务器返回错误事件'
                });
                return;
              }
            }
          }
          buf = lines[lines.length - 1] ?? '';
        }
      } finally {
        clearInterval(heartbeat);
        clearRetryTimeouts();
      }

      // 正常结束
      onDone && onDone();

    } catch (e: any) {
      clearRetryTimeouts();

      // 检查是否被主动取消
      if (signal?.aborted || e.name === 'AbortError') {
        console.log('SSE连接被主动取消');
        return;
      }

      // 网络错误处理
      const isNetworkError = e.code === 'NETWORK_ERROR' ||
                           e.code === 'ECONNRESET' ||
                           e.code === 'ETIMEDOUT' ||
                           e.message?.includes('fetch') ||
                           e.message?.includes('network');

      if (isNetworkError && retries < maxRetries) {
        retries++;
        console.log(`SSE网络错误，第${retries}次重连...`, e.message);

        const timeout = setTimeout(() => {
          startConnection();
        }, 1000 * retries);
        retryTimeouts.push(timeout);
        return;
      }

      // 最终错误处理
      const finalError: ApiError = {
        code: e.code || 'SSE_ERROR',
        message: e.message || 'SSE连接异常'
      };

      if (e.requestId) {
        finalError.requestId = e.requestId;
      }

      onError && onError(finalError);
    }
  };

  // 启动连接
  startConnection();

  // 返回清理函数
  return () => {
    if (externalAbortHandler && signal) {
      signal.removeEventListener('abort', externalAbortHandler);
    }
    clearRetryTimeouts();
  };
}
