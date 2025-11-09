'use client';

/**
 * Form.io FormRenderer封装组件
 * 艹，这个tm用来渲染表单并收集用户输入！
 */

import { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';

/**
 * FormRenderer组件Props
 */
export interface FormRendererProps {
  schema: any; // 表单Schema
  submission?: any; // 初始提交数据
  onSubmit?: (submission: any) => void; // 提交回调
  onChange?: (submission: any) => void; // 数据变化回调
  readOnly?: boolean; // 只读模式
}

/**
 * FormRenderer组件
 */
export default function FormRenderer({
  schema,
  submission,
  onSubmit,
  onChange,
  readOnly = false,
}: FormRendererProps) {
  const formRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 艹，确保只在客户端运行
    if (typeof window === 'undefined') {
      return;
    }

    let formInstance: any = null;

    const initFormioRenderer = async () => {
      try {
        // 动态导入formiojs
        const Formio = (await import('formiojs')).default as any;

        // 加载formio样式
        await import('formiojs/dist/formio.full.min.css');

        // 渲染选项
        const renderOptions = {
          readOnly,
          noAlerts: true, // 不显示内置提示
        };

        // 创建Form实例
        if (containerRef.current) {
          formInstance = await Formio.createForm(
            containerRef.current,
            schema,
            renderOptions
          );

          formRef.current = formInstance;

          // 设置初始数据
          if (submission) {
            formInstance.submission = submission;
          }

          // 监听提交事件
          if (onSubmit) {
            formInstance.on('submit', (sub: any) => {
              onSubmit(sub);
            });
          }

          // 监听数据变化
          if (onChange) {
            formInstance.on('change', (changed: any) => {
              onChange(changed);
            });
          }

          setLoading(false);
        }
      } catch (err: any) {
        console.error('[FormRenderer] 初始化失败:', err);
        setError(err.message || '加载表单失败');
        setLoading(false);
      }
    };

    initFormioRenderer();

    // 清理函数
    return () => {
      if (formInstance && formInstance.destroy) {
        formInstance.destroy();
      }
    };
  }, [schema, readOnly]); // schema或readOnly变化时重新初始化

  // 更新submission（外部变更）
  useEffect(() => {
    if (formRef.current && submission) {
      formRef.current.submission = submission;
    }
  }, [submission]);

  if (error) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: '#ff4d4f',
        }}
      >
        <h3>加载表单失败</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Spin size="large" tip="正在加载表单..." />
      </div>
    );
  }

  return (
    <div>
      {/* FormRenderer容器 */}
      <div
        ref={containerRef}
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: '8px',
          background: '#fff',
          padding: '24px',
        }}
      />
    </div>
  );
}
