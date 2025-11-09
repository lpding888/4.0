/**
 * 全局错误边界
 * 艹，出错必须优雅降级，不能白屏！
 *
 * @author 老王
 */

'use client';

import React from 'react';
import { Button, Result } from 'antd';
import { initSentry } from '@/lib/monitoring/sentry';

// 初始化Sentry监控
initSentry();

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div style={{ padding: 24, minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <Result
            status="500"
            title="出错了"
            subTitle={
              <div>
                <p>系统遇到了一些问题，我们正在努力修复。</p>
                <details style={{ marginTop: 12, color: '#666' }}>
                  <summary>错误详情（开发模式）</summary>
                  <pre style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    marginTop: 8,
                    fontSize: 12,
                    overflow: 'auto'
                  }}>
                    {error.message}
                    {error.stack && (
                      <>
                        <br />
                        {error.stack}
                      </>
                    )}
                    {error.digest && (
                      <>
                        <br />
                        Digest: {error.digest}
                      </>
                    )}
                  </pre>
                </details>
              </div>
            }
            extra={
              <Button
                type="primary"
                onClick={() => reset ? reset() : window.location.reload()}
              >
                重新加载
              </Button>
            }
          />
        </div>
      </body>
    </html>
  );
}