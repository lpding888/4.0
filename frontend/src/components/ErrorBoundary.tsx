'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result } from 'antd';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * ErrorBoundary - 全局错误边界组件
 *
 * 艹！这个组件能防止整个应用因为一个SB组件报错就白屏！
 * 捕获组件树中的错误，显示降级UI，保证用户体验
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新state，下次渲染显示降级UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息到结构化日志
    console.error('ErrorBoundary捕获到错误:', error, errorInfo);

    // 集成结构化日志系统
    try {
      // 动态导入logger（避免SSR问题）
      import('@/lib/monitoring/logger').then(({ logger }) => {
        logger.error('React Error Boundary捕获错误', error, {
          component: errorInfo.componentStack || undefined,
        });
      });
    } catch (err) {
      console.error('日志记录失败:', err);
    }

    // 上报到Sentry
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    // 刷新页面
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义降级UI，使用自定义的
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认降级UI - 青蓝玻璃拟态风格
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-500 via-teal-600 to-blue-700">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8 max-w-lg">
            <Result
              status="error"
              title={<span className="text-white text-2xl">页面出错了</span>}
              subTitle={
                <div className="text-white/70 space-y-2">
                  <p>抱歉，页面遇到了一些问题</p>
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <details className="mt-4 text-left">
                      <summary className="cursor-pointer text-cyan-300 hover:text-cyan-200">
                        查看错误详情（开发模式）
                      </summary>
                      <pre className="mt-2 p-4 bg-black/30 rounded-lg text-xs text-red-300 overflow-auto">
                        {this.state.error.toString()}
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              }
              extra={
                <div className="flex gap-4 justify-center">
                  <Button
                    type="primary"
                    onClick={this.handleReset}
                    className="bg-cyan-500/80 hover:bg-cyan-400/80 border-cyan-400/50"
                  >
                    刷新页面
                  </Button>
                  <Button
                    onClick={() => window.history.back()}
                    className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                  >
                    返回上一页
                  </Button>
                </div>
              }
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
